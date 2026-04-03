import type { Express, Request } from "express";
import { type Server } from "http";
import { storage } from "./storage";
import { clerkMiddleware, getAuth, requireAuth, createClerkClient } from "@clerk/express";
import { insertStudentSchema, insertAttendanceSchema, insertTimetableSlotSchema, insertAuditLogSchema } from "@shared/schema";
import { z } from "zod";
import { seedTimetable } from "./seed";

const clerk = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY!,
  publishableKey: process.env.VITE_CLERK_PUBLISHABLE_KEY!,
});

function getDayOfWeekFromDate(dateStr: string): number {
  const date = new Date(dateStr + "T00:00:00");
  const jsDay = date.getDay();
  return jsDay === 0 ? 6 : jsDay - 1;
}

const ADMIN_EMAILS = ["naeem542005@gmail.com", "yugankamble@gmail.com", "yugan777@gmail.com"];

const VALID_SUBJECTS = [
  "Data Structures", "Database Mgmt (DBMS)", "Java Lab", "Maths III", "PCOM",
  "Internet Programming", "Network Security", "Software Engg", "Data Mining", "Wireless Tech",
  "AI & Machine Learning", "Big Data Analytics", "Infrastructure Security", "Major Project I"
];

async function cleanupOldSubjects(userId: string) {
  try {
    const user = await clerk.users.getUser(userId);
    const publicMetadata = user.publicMetadata as any;
    let changed = false;

    // Fetch all valid subjects (Merge DB + hardcoded)
    let dbSubs = await storage.getSubjects();
    const allValid = [...new Set([...dbSubs, ...VALID_SUBJECTS])];

    // 1. Clean up primary 'subject' - Remove if not in allValid
    if (publicMetadata.subject) {
      const isValid = allValid.some(s => s.toLowerCase() === publicMetadata.subject.toLowerCase());
      if (!isValid) {
        publicMetadata.subject = null;
        changed = true;
      } else {
        // Ensure Title Case matching
        const correctCase = allValid.find(s => s.toLowerCase() === publicMetadata.subject.toLowerCase());
        if (correctCase && correctCase !== publicMetadata.subject) {
          publicMetadata.subject = correctCase;
          changed = true;
        }
      }
    }

    // 2. Clean up 'subjects' array
    if (Array.isArray(publicMetadata.subjects)) {
      const originalCount = publicMetadata.subjects.length;
      publicMetadata.subjects = publicMetadata.subjects
        .map((s: string) => {
          const match = allValid.find(v => v.toLowerCase() === s.toLowerCase());
          return match || null;
        })
        .filter(Boolean);
      
      if (publicMetadata.subjects.length !== originalCount) {
        changed = true;
      }
    }

    if (changed) {
      await clerk.users.updateUserMetadata(userId, { publicMetadata });
      console.log(`Cleaned up subjects for user: ${userId}`);
    }
  } catch (error) {
    console.error(`Failed to cleanup subjects for ${userId}:`, error);
  }
}

async function isAdmin(userId: string): Promise<boolean> {
  try {
    const user = await clerk.users.getUser(userId);
    const email = user.emailAddresses?.[0]?.emailAddress?.toLowerCase();
    
    if (email && ADMIN_EMAILS.includes(email)) {
      let changed = false;
      const metadata = { ...user.publicMetadata } as any;

      // 1. Ensure admin role and approved status
      if (metadata.role !== "admin" || metadata.status !== "approved") {
        metadata.role = "admin";
        metadata.status = "approved";
        changed = true;
      }

      if (changed) {
        await clerk.users.updateUserMetadata(userId, { publicMetadata: metadata });
        console.log(`Auto-updated metadata for admin: ${email}`);
      }
      return true;
    }
    
    return user.publicMetadata?.role === "admin";
  } catch (err: any) {
    console.error("Error in isAdmin check:", err.message);
    return false;
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.use(clerkMiddleware({
    publishableKey: process.env.VITE_CLERK_PUBLISHABLE_KEY,
    secretKey: process.env.CLERK_SECRET_KEY,
  }));

  // Middleware to proactively upgrade admin users if they are in the ADMIN_EMAILS list
  app.use(async (req, res, next) => {
    try {
      const auth = getAuth(req);
      if (auth.userId) {
        // Run in background to avoid slowing down requests
        isAdmin(auth.userId).catch(err => console.error("Proactive admin check failed:", err));
      }
    } catch (err) {
      // Ignore if not authenticated
    }
    next();
  });

  // --- DASHBOARD ANALYTICS (Moved to top for priority) ---
  app.get("/api/analytics/dashboard", requireAuth(), async (req, res) => {
    try {
      const section = req.query.section as string | undefined;
      const data = await storage.getAnalytics(section);
      res.json(data);
    } catch (e: any) {
      console.error("Dashboard Analytics Error:", e.message);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // --- PROXY ROUTES TO PI/VM BACKEND ---
  const getBackendUrl = (req: Request) => {
    const piIp = req.headers["x-pi-ip"] as string;
    if (piIp) return `http://${piIp}:5000`;
    
    return process.env.VM_BACKEND_URL || (process.env.VITE_VM_HOST ? `http://${process.env.VITE_VM_HOST}:5000` : "http://127.0.0.1:5000");
  };

  app.get("/api/health", async (req, res) => {
    try {
      const backendUrl = getBackendUrl(req);
      const response = await fetch(`${backendUrl}/api/health`, { signal: AbortSignal.timeout(5000) });
      if (!response.ok) {
        return res.status(response.status).json({ status: "error", message: "Pi backend error" });
      }
      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error("Pi backend unreachable:", error.message);
      res.status(503).json({ status: "offline", message: "Pi backend unreachable" });
    }
  });

  app.post("/api/enroll", requireAuth(), async (req, res) => {
    try {
      const backendUrl = getBackendUrl(req);
      console.log(`Forwarding /api/enroll to ${backendUrl}/api/enroll...`);
      const response = await fetch(`${backendUrl}/api/enroll`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req.body),
      });

      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const data = await response.json();
        res.status(response.status).json(data);
      } else {
        res.status(500).json({ message: "Pi backend returned invalid response" });
      }
    } catch (error: any) {
      res.status(500).json({ message: "Failed to communicate with Pi backend" });
    }
  });

  app.post("/api/detect", requireAuth(), async (req, res) => {
    try {
      const backendUrl = getBackendUrl(req);
      const response = await fetch(`${backendUrl}/api/detect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req.body),
      });
      const data = await response.json();
      res.status(response.status).json(data);
    } catch (error: any) {
      res.status(500).json({ message: "Failed to communicate with Pi backend" });
    }
  });

  app.post("/api/start-session", requireAuth(), async (req, res) => {
    try {
      const backendUrl = getBackendUrl(req);
      const response = await fetch(`${backendUrl}/api/start-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req.body),
      });
      const data = await response.json();
      res.status(response.status).json(data);
    } catch (error: any) {
      res.status(500).json({ message: "Failed to communicate with Pi backend" });
    }
  });

  app.post("/api/stop-session", requireAuth(), async (req, res) => {
    try {
      const backendUrl = getBackendUrl(req);
      const response = await fetch(`${backendUrl}/api/stop-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req.body),
      });
      const data = await response.json();
      res.status(response.status).json(data);
    } catch (error: any) {
      res.status(500).json({ message: "Failed to communicate with Pi backend" });
    }
  });

  // IMPORTANT: /enrolled must come BEFORE /:id to avoid "enrolled" matching as an id param
  app.get("/api/students/enrolled", requireAuth(), async (req, res) => {
    try {
      const section = req.query.section as string;
      if (!section) return res.status(400).json({ message: "section required" });
      const result = await storage.getStudentsWithEmbeddings(section);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/students", requireAuth(), async (req, res) => {
    try {
      const section = req.query.section as string | undefined;
      const result = section
        ? await storage.getStudentsBySection(section)
        : await storage.getStudents();
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/students/:id", requireAuth(), async (req: Request<{ id: string }>, res) => {
    try {
      const student = await storage.getStudent(req.params.id);
      if (!student) return res.status(404).json({ message: "Student not found" });
      res.json(student);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/students", requireAuth(), async (req, res) => {
    try {
      const data = insertStudentSchema.parse(req.body);
      try {
        const student = await storage.createStudent(data);

        // Create Audit Log for student creation
        const auth = getAuth(req);
        const clerkUser = await clerk.users.getUser(auth.userId!);
        try {
          await storage.createAuditLog({
            action: "student_created",
            description: `Created student: ${student.name} (${student.rollNumber}) in section ${student.section}`,
            actorId: auth.userId!,
            actorName: (clerkUser.publicMetadata as any)?.teacherName || clerkUser.fullName || "System",
            metadata: { studentId: student.id, section: student.section }
          });
        } catch (logErr: any) {
          console.error("Audit log error:", logErr.message);
        }

        res.status(201).json(student);
      } catch (error: any) {
        const message = String(error?.message || "");
        const isUniqueViolation =
          message.includes("roll_number_section_idx") ||
          message.includes("duplicate key value violates unique constraint");

        if (!isUniqueViolation) throw error;

        const existing = await storage.getStudentByRollAndSection(data.rollNumber, data.section);
        if (!existing) {
          return res.status(409).json({ message: "Student already exists, but could not be fetched." });
        }
        res.status(200).json(existing);
      }
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/students/:id", requireAuth(), async (req: Request<{ id: string }>, res) => {
    try {
      const data = insertStudentSchema.partial().parse(req.body);
      const student = await storage.updateStudent(req.params.id, data);
      if (!student) return res.status(404).json({ message: "Student not found" });

      // Create Audit Log
      const auth = getAuth(req);
      const clerkUser = await clerk.users.getUser(auth.userId!);
      try {
        await storage.createAuditLog({
          action: "student_updated",
          description: `Updated student: ${student.name} (${student.rollNumber}) in section ${student.section}`,
          actorId: auth.userId!,
          actorName: (clerkUser.publicMetadata as any)?.teacherName || clerkUser.fullName || "System",
          metadata: { studentId: student.id, section: student.section, changes: req.body }
        });
      } catch (logErr: any) {
        console.error("Audit log error:", logErr.message);
      }

      res.json(student);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/students/:id", requireAuth(), async (req: Request<{ id: string }>, res) => {
    try {
      const student = await storage.getStudent(req.params.id);
      if (!student) return res.status(404).json({ message: "Student not found" });

      await storage.deleteStudent(req.params.id);

      // Create Audit Log
      const auth = getAuth(req);
      const clerkUser = await clerk.users.getUser(auth.userId!);
      try {
        await storage.createAuditLog({
          action: "student_deleted",
          description: `Deleted student: ${student.name} (${student.rollNumber}) from section ${student.section}`,
          actorId: auth.userId!,
          actorName: (clerkUser.publicMetadata as any)?.teacherName || clerkUser.fullName || "System",
          metadata: { studentId: student.id, section: student.section }
        });
      } catch (logErr: any) {
        console.error("Audit log error:", logErr.message);
      }

      res.status(204).end();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/students/:id/enrollment", requireAuth(), async (req: Request<{ id: string }>, res) => {
    try {
      const { enrolled } = req.body;
      const student = await storage.updateStudentEnrollment(req.params.id, enrolled);
      if (!student) return res.status(404).json({ message: "Student not found" });
      res.json(student);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Store face embedding from Pi enrollment
  app.patch("/api/students/:id/embedding", requireAuth(), async (req: Request<{ id: string }>, res) => {
    try {
      const { embedding } = req.body;
      if (!embedding || !Array.isArray(embedding)) {
        return res.status(400).json({ message: "embedding array required" });
      }
      const student = await storage.updateStudentEmbedding(req.params.id, embedding);
      if (!student) return res.status(404).json({ message: "Student not found" });
      res.json(student);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/enroll-complete", requireAuth(), async (req, res) => {
    try {
      const { studentId, embedding } = req.body;
      if (!studentId || !embedding) {
        return res.status(400).json({ message: "studentId and embedding required" });
      }
      const student = await storage.updateStudentEmbedding(studentId, embedding);

      // Create Audit Log
      const auth = getAuth(req);
      const user = await clerk.users.getUser(auth.userId!);
      const actorName = (user.publicMetadata?.teacherName as string) || user.fullName || "System";
      await storage.createAuditLog({
        action: "enrollment_complete",
        description: `Completed enrollment for student: ${student?.name} (${student?.rollNumber})`,
        actorId: auth.userId!,
        actorName,
        metadata: { studentId, section: student?.section }
      });

      res.json(student);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // /api/students/enrolled route moved above /api/students/:id (see top of routes)

  app.get("/api/attendance", requireAuth(), async (req, res) => {
    try {
      const auth = getAuth(req);
      const teacherId = auth.userId!;
      const { date, period } = req.query;
      if (!date || !period) {
        return res.status(400).json({ message: "date and period required" });
      }
      const records = await storage.getAttendanceRecords(
        date as string,
        parseInt(period as string),
        teacherId
      );
      res.json(records);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/attendance/student/:studentId", requireAuth(), async (req: Request<{ studentId: string }>, res) => {
    try {
      const records = await storage.getAttendanceByStudent(req.params.studentId);
      res.json(records);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/attendance", requireAuth(), async (req, res) => {
    try {
      const auth = getAuth(req);
      const teacherId = auth.userId!;
      const data = insertAttendanceSchema.parse({
        ...req.body,
        teacherId,
      });

      const clerkUser = await clerk.users.getUser(teacherId);
      const userIsAdmin = await isAdmin(teacherId);
      const teacherSubject = (clerkUser.publicMetadata as any)?.subject as string | undefined;
      const teacherSubjects = (clerkUser.publicMetadata as any)?.subjects as string[] | undefined;
      const allTeacherSubjects = [...new Set([teacherSubject, ...(teacherSubjects || [])])].filter((s): s is string => !!s);

      if (allTeacherSubjects.length === 0 && !userIsAdmin) {
        return res.status(403).json({ message: "Your profile does not have any subjects assigned." });
      }

      // Section is on the student not the attendance record — pull from raw body
      const sectionFromBody = req.body.section as string | undefined;
      const dayOfWeek = getDayOfWeekFromDate(data.date);
      const teacherSlots = await storage.getTimetableSlots(teacherId);

      // Get the full timetable to see what is currently scheduled
      const allSlots = await storage.getAllTimetableSlots();
      const currentSlot = allSlots.find(
        (s) => s.section === sectionFromBody && s.period === data.period && s.dayOfWeek === dayOfWeek
      );

      const matchingSlot = teacherSlots.find(
        (s) =>
          s.dayOfWeek === dayOfWeek &&
          s.period === data.period &&
          allTeacherSubjects.some(ts => ts != null && ts.toLowerCase() === s.subject.toLowerCase())
      );

      // If no slot is scheduled at all for this time, allow teacher to mark for their subjects
      const isFreePeriod = !currentSlot;
      const canTeacherMark = matchingSlot || (isFreePeriod && allTeacherSubjects.length > 0);

      if (!canTeacherMark && !userIsAdmin) {
        const message = currentSlot 
          ? `It is currently ${currentSlot.subject} period for this section. You can only mark attendance for your assigned subjects (${allTeacherSubjects.join(", ")}).`
          : `No class is scheduled for this section right now. You can only mark attendance for your assigned subjects.`;
        return res.status(403).json({ message });
      }

      const record = await storage.upsertAttendance(data);

      // Create Audit Log for Attendance
      try {
        const student = await storage.getStudent(data.studentId);
        await storage.createAuditLog({
          action: "attendance_marked",
          description: `Marked attendance for ${student?.name} (${student?.rollNumber}) as ${data.status}`,
          actorId: teacherId,
          actorName: (clerkUser.publicMetadata as any)?.teacherName || clerkUser.fullName || "System",
          metadata: { studentId: data.studentId, date: data.date, period: data.period, status: data.status }
        });
        console.log(`Attendance audit log created for ${student?.name}`);
      } catch (logErr: any) {
        console.error("Attendance audit log error:", logErr.message);
      }

      res.json(record);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/attendance/bulk", requireAuth(), async (req, res) => {
    try {
      const auth = getAuth(req);
      const teacherId = auth.userId!;
      const schema = z.array(insertAttendanceSchema.omit({ teacherId: true }));
      const bodyData = schema.parse(req.body);

      const clerkUser = await clerk.users.getUser(teacherId);
      const userIsAdmin = await isAdmin(teacherId);
      const teacherSubject = (clerkUser.publicMetadata as any)?.subject as string | undefined;

      if (!teacherSubject && !userIsAdmin) {
        return res.status(403).json({ message: "Your profile does not have a subject assigned. Please complete onboarding." });
      }

      if (bodyData.length > 0) {
        const sampleRecord = bodyData[0];
        const dayOfWeek = getDayOfWeekFromDate(sampleRecord.date);
        const teacherSlots = await storage.getTimetableSlots(teacherId);
        const userIsAdmin = await isAdmin(teacherId);

        const clerkUser = await clerk.users.getUser(teacherId);
        const teacherSubject = (clerkUser.publicMetadata as any)?.subject as string | undefined;
        const teacherSubjects = (clerkUser.publicMetadata as any)?.subjects as string[] | undefined;
        const allTeacherSubjects = [...new Set([teacherSubject, ...(teacherSubjects || [])])].filter((s): s is string => !!s);

        // Get the full timetable to see what is currently scheduled
        const allSlots = await storage.getAllTimetableSlots();
        const firstStudent = await storage.getStudent(sampleRecord.studentId);
        const currentSlot = allSlots.find(
          (s) => s.section === firstStudent?.section && s.period === sampleRecord.period && s.dayOfWeek === dayOfWeek
        );

        const matchingSlot = teacherSlots.find(
          (s) =>
            s.dayOfWeek === dayOfWeek &&
            s.period === sampleRecord.period &&
            allTeacherSubjects.some(ts => ts != null && ts.toLowerCase() === s.subject.toLowerCase())
        );

        // If no slot is scheduled at all for this time, allow teacher to mark for their subjects
        const isFreePeriod = !currentSlot;
        const canTeacherMark = matchingSlot || (isFreePeriod && allTeacherSubjects.length > 0);

        if (!canTeacherMark && !userIsAdmin) {
          const message = currentSlot 
            ? `It is currently ${currentSlot.subject} period for section ${firstStudent?.section}. You can only mark attendance for your assigned subjects (${allTeacherSubjects.join(", ")}).`
            : `No class is scheduled for section ${firstStudent?.section} right now. You can only mark attendance for your assigned subjects.`;
          return res.status(403).json({ message });
        }
      }

      const records = bodyData.map(r => ({ ...r, teacherId }));
      const results = await storage.bulkUpsertAttendance(records);

      // Create Audit Log for Bulk Attendance
      if (bodyData.length > 0) {
        const sample = bodyData[0];
        const present = bodyData.filter(r => r.status === "present").length;
        const absent = bodyData.filter(r => r.status === "absent").length;
        const late = bodyData.filter(r => r.status === "late").length;
        const section = (await storage.getStudent(sample.studentId))?.section || "Unknown Section";
        const primarySub = (clerkUser.publicMetadata as any)?.subject;
        const otherSubs = (clerkUser.publicMetadata as any)?.subjects || [];
        const allSubs = [...new Set([primarySub, ...otherSubs])].filter(Boolean);
        const subDisplay = allSubs.length > 0 ? ` (${allSubs.join(", ")})` : "";

        try {
          await storage.createAuditLog({
            action: "bulk_attendance",
            description: `Attendance submitted for ${section} on ${sample.date}${subDisplay} — ${present} present, ${absent} absent, ${late} late`,
            actorId: teacherId,
            actorName: (clerkUser.publicMetadata as any)?.teacherName || clerkUser.fullName || "System",
            metadata: { count: bodyData.length, date: sample.date, period: sample.period, present, absent, late, section }
          });
          console.log(`Bulk attendance audit log created for ${section}`);
        } catch (logErr: any) {
          console.error("Bulk attendance audit log error:", logErr.message);
        }
      }

      res.json(results);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/timetable", requireAuth(), async (req, res) => {
    try {
      const auth = getAuth(req);
      const teacherId = auth.userId!;

      // Background cleanup of subjects - don't await to avoid slowing down the request
      cleanupOldSubjects(teacherId).catch(err => console.error("Background cleanup failed:", err));

      const userIsAdmin = await isAdmin(teacherId);
      let slots;

      if (userIsAdmin) {
        // Admins see all slots in the system to manage enrollment and attendance globally
        slots = await storage.getAllTimetableSlots();
      } else {
        // Teachers see only their own slots
        slots = await storage.getTimetableSlots(teacherId);
        if (slots.length === 0) {
          await seedTimetable(teacherId);
          slots = await storage.getTimetableSlots(teacherId);
        }
      }
      res.json(slots);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/timetable", requireAuth(), async (req, res) => {
    try {
      const auth = getAuth(req);
      const data = insertTimetableSlotSchema.parse({
        ...req.body,
        teacherId: auth.userId!,
      });
      const slot = await storage.createTimetableSlot(data);
      res.status(201).json(slot);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.put("/api/timetable/:id", requireAuth(), async (req: Request<{ id: string }>, res) => {
    try {
      const auth = getAuth(req);
      const { id } = req.params;
      const slots = await storage.getTimetableSlots(auth.userId!);
      const slot = slots.find((s) => s.id === id);
      if (!slot) return res.status(404).json({ message: "Slot not found" });
      const data = insertTimetableSlotSchema.partial().parse(req.body);
      const updated = await storage.updateTimetableSlot(id, data);
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/timetable/:id", requireAuth(), async (req: Request<{ id: string }>, res) => {
    try {
      const auth = getAuth(req);
      const { id } = req.params;
      const slots = await storage.getTimetableSlots(auth.userId!);
      const slot = slots.find((s) => s.id === id);
      if (!slot) return res.status(404).json({ message: "Slot not found" });
      await storage.deleteTimetableSlot(id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/timetable", requireAuth(), async (req, res) => {
    try {
      const auth = getAuth(req);
      await storage.clearTimetableSlots(auth.userId!);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/reports/defaulters", requireAuth(), async (req, res) => {
    try {
      const { threshold, startDate, endDate } = req.query;
      if (!threshold) return res.status(400).json({ message: "threshold required" });
      const result = await storage.getDefaulters(
        parseInt(threshold as string),
        startDate as string | undefined,
        endDate as string | undefined
      );
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/audit-logs", requireAuth(), async (req, res) => {
    try {
      const auth = getAuth(req);
      if (!(await isAdmin(auth.userId!))) {
        return res.status(403).json({ message: "Admin access required" });
      }
      const logs = await storage.getAuditLogs();
      res.json(logs);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/audit-logs", requireAuth(), async (req, res) => {
    try {
      const auth = getAuth(req);
      const user = await clerk.users.getUser(auth.userId!);
      const actorName = (user.publicMetadata?.teacherName as string) || user.fullName || "System";
      
      const data = insertAuditLogSchema.parse({
        ...req.body,
        actorId: auth.userId!,
        actorName,
      });
      const log = await storage.createAuditLog(data);
      res.status(201).json(log);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/admin/pending-users", requireAuth(), async (req, res) => {
    try {
      const auth = getAuth(req);
      if (!(await isAdmin(auth.userId!))) {
        return res.status(403).json({ message: "Admin access required" });
      }
      const users = await clerk.users.getUserList({ limit: 100 });
      const pending = users.data.filter(
        (u) => u.publicMetadata?.status === "pending"
      );
      res.json(pending.map(u => ({
        id: u.id,
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.emailAddresses[0]?.emailAddress,
        subject: u.publicMetadata?.subject,
        status: u.publicMetadata?.status,
        createdAt: u.createdAt,
      })));
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/admin/approve-user", requireAuth(), async (req, res) => {
    try {
      const auth = getAuth(req);
      if (!(await isAdmin(auth.userId!))) {
        return res.status(403).json({ message: "Admin access required" });
      }
      const { userId } = req.body;
      if (!userId) return res.status(400).json({ message: "userId required" });
      const user = await clerk.users.getUser(userId);
      await clerk.users.updateUserMetadata(userId, {
        publicMetadata: {
          ...user.publicMetadata,
          status: "approved",
        },
      });

      // Create Audit Log
      const adminUser = await clerk.users.getUser(auth.userId!);
      const actorName = (adminUser.publicMetadata?.teacherName as string) || adminUser.fullName || "System";
      await storage.createAuditLog({
        action: "user_approved",
        description: `Approved teacher: ${user.fullName || user.emailAddresses[0]?.emailAddress}`,
        actorId: auth.userId!,
        actorName,
        metadata: { targetUserId: userId }
      });

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/admin/reject-user", requireAuth(), async (req, res) => {
    try {
      const auth = getAuth(req);
      if (!(await isAdmin(auth.userId!))) {
        return res.status(403).json({ message: "Admin access required" });
      }
      const { userId } = req.body;
      if (!userId) return res.status(400).json({ message: "userId required" });
      const user = await clerk.users.getUser(userId);
      await clerk.users.updateUserMetadata(userId, {
        publicMetadata: {
          ...user.publicMetadata,
          status: "rejected",
        },
      });

      // Create Audit Log
      const adminUser = await clerk.users.getUser(auth.userId!);
      const actorName = (adminUser.publicMetadata?.teacherName as string) || adminUser.fullName || "System";
      await storage.createAuditLog({
        action: "user_rejected",
        description: `Rejected teacher: ${user.fullName || user.emailAddresses[0]?.emailAddress}`,
        actorId: auth.userId!,
        actorName,
        metadata: { targetUserId: userId }
      });

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/all-users", requireAuth(), async (req, res) => {
    try {
      const auth = getAuth(req);
      if (!(await isAdmin(auth.userId!))) {
        return res.status(403).json({ message: "Admin access required" });
      }
      const users = await clerk.users.getUserList({ limit: 500 });
      res.json(users.data.map(u => ({
        id: u.id,
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.emailAddresses[0]?.emailAddress,
        subject: u.publicMetadata?.subject,
        subjects: u.publicMetadata?.subjects,
        role: u.publicMetadata?.role || "teacher",
        status: u.publicMetadata?.status || "approved",
        teacherName: u.publicMetadata?.teacherName,
        createdAt: u.createdAt,
      })));
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/admin/update-user-subjects", requireAuth(), async (req, res) => {
    try {
      const auth = getAuth(req);
      if (!(await isAdmin(auth.userId!))) {
        return res.status(403).json({ message: "Admin access required" });
      }
      const { userId, subjects } = req.body;
      if (!userId || !Array.isArray(subjects)) {
        return res.status(400).json({ message: "userId and subjects array required" });
      }

      const user = await clerk.users.getUser(userId);
      await clerk.users.updateUserMetadata(userId, {
        publicMetadata: {
          ...user.publicMetadata,
          subjects,
        },
      });

      // Create Audit Log
      const adminUser = await clerk.users.getUser(auth.userId!);
      const actorName = (adminUser.publicMetadata?.teacherName as string) || adminUser.fullName || "System";
      try {
        await storage.createAuditLog({
          action: "subjects_updated",
          description: `Updated subjects for ${user.fullName || user.emailAddresses[0]?.emailAddress} to: ${subjects.join(", ") || "None"}`,
          actorId: auth.userId!,
          actorName,
          metadata: { targetUserId: userId, subjects }
        });
      } catch (logErr: any) {
        console.error("Audit log error:", logErr.message);
      }

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/onboarding", requireAuth(), async (req, res) => {
    try {
      const auth = getAuth(req);
      const userId = auth.userId!;
      const { subject, teacherName } = req.body;
      if (!subject) return res.status(400).json({ message: "subject required" });
      if (!teacherName) return res.status(400).json({ message: "teacher name required" });
      await clerk.users.updateUserMetadata(userId, {
        publicMetadata: {
          teacherName,
          subject,
          status: "pending",
          role: "teacher",
        },
      });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/admin/set-admin", requireAuth(), async (req, res) => {
    try {
      const auth = getAuth(req);
      if (!(await isAdmin(auth.userId!))) {
        return res.status(403).json({ message: "Admin access required" });
      }
      const { userId } = req.body;
      if (!userId) return res.status(400).json({ message: "userId required" });
      await clerk.users.updateUserMetadata(userId, {
        publicMetadata: {
          status: "approved",
          role: "admin",
        },
      });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/admin/cleanup-all-subjects", requireAuth(), async (req, res) => {
    try {
      const auth = getAuth(req);
      if (!(await isAdmin(auth.userId!))) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const users = await clerk.users.getUserList({ limit: 500 });
      let cleanedCount = 0;

      // Fetch all valid subjects (Merge DB + hardcoded)
      let dbSubs = await storage.getSubjects();
      const allValid = [...new Set([...dbSubs, ...VALID_SUBJECTS])];

      for (const user of users.data) {
        const metadata = user.publicMetadata as any;
        let changed = false;

        // Clean up primary subject - Remove if not valid
        if (metadata.subject && !allValid.includes(metadata.subject)) {
          metadata.subject = null;
          changed = true;
        }

        // Clean up subjects array
        if (Array.isArray(metadata.subjects)) {
          const original = metadata.subjects.length;
          metadata.subjects = metadata.subjects.filter((s: string) => allValid.includes(s));
          if (metadata.subjects.length !== original) changed = true;
        }

        if (changed) {
          await clerk.users.updateUserMetadata(user.id, { publicMetadata: metadata });
          cleanedCount++;
        }
      }

      // Create Audit Log
      const adminUser = await clerk.users.getUser(auth.userId!);
      const actorName = (adminUser.publicMetadata?.teacherName as string) || adminUser.fullName || "System";
      await storage.createAuditLog({
        action: "system_cleanup",
        description: `Cleaned up invalid subjects for ${cleanedCount} users.`,
        actorId: auth.userId!,
        actorName,
        metadata: { cleanedCount }
      });

      res.json({ success: true, cleanedCount });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/admin/users/:userId", requireAuth(), async (req, res) => {
    try {
      const auth = getAuth(req);
      if (!(await isAdmin(auth.userId!))) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const userId = req.params.userId as string;
      if (!userId) return res.status(400).json({ message: "userId required" });

      if (userId === auth.userId) {
        return res.status(400).json({ message: "You cannot delete your own account." });
      }

      const user = await clerk.users.getUser(userId);
      await clerk.users.deleteUser(userId);

      // Create Audit Log
      const adminUser = await clerk.users.getUser(auth.userId!);
      const actorName = (adminUser.publicMetadata?.teacherName as string) || (adminUser.fullName as string) || "System";
      await storage.createAuditLog({
        action: "user_deleted",
        description: `Deleted teacher account: ${user.fullName || (user.emailAddresses[0]?.emailAddress as string)}`,
        actorId: auth.userId!,
        actorName,
        metadata: { targetUserId: userId, deletedEmail: user.emailAddresses[0]?.emailAddress }
      });

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/subjects", requireAuth(), async (req, res) => {
    try {
      let subs = await storage.getSubjects();
      
      // Merge with hardcoded list
      const merged = [...new Set([...subs, ...VALID_SUBJECTS])].sort();
      res.json(merged);
    } catch (error: any) {
      console.error("Error in GET /api/admin/subjects:", error.message);
      res.json(VALID_SUBJECTS);
    }
  });

  app.post("/api/admin/subjects", requireAuth(), async (req, res) => {
    try {
      const auth = getAuth(req);
      if (!(await isAdmin(auth.userId!))) {
        return res.status(403).json({ message: "Admin access required" });
      }
      const { name } = req.body;
      if (!name) return res.status(400).json({ message: "Subject name required" });
      await storage.addSubject(name);

      // Create Audit Log
      const adminUser = await clerk.users.getUser(auth.userId!);
      const actorName = (adminUser.publicMetadata?.teacherName as string) || adminUser.fullName || "System";
      try {
        await storage.createAuditLog({
          action: "subject_added",
          description: `Added "${name}" to global subject list`,
          actorId: auth.userId!,
          actorName,
          metadata: { subjectName: name }
        });
      } catch (logErr: any) {
        console.error("Audit log error:", logErr.message);
      }

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/admin/subjects/:name", requireAuth(), async (req, res) => {
    try {
      const auth = getAuth(req);
      if (!(await isAdmin(auth.userId!))) {
        return res.status(403).json({ message: "Admin access required" });
      }
      const { name } = req.params;
      await storage.deleteSubject(name);

      // Create Audit Log
      const adminUser = await clerk.users.getUser(auth.userId!);
      const actorName = (adminUser.publicMetadata?.teacherName as string) || adminUser.fullName || "System";
      try {
        await storage.createAuditLog({
          action: "subject_removed",
          description: `Removed "${name}" from global subject list`,
          actorId: auth.userId!,
          actorName,
          metadata: { subjectName: name }
        });
      } catch (logErr: any) {
        console.error("Audit log error:", logErr.message);
      }

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  return httpServer;
}
