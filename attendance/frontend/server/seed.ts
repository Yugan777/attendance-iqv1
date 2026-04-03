import { db } from "./db";
import { students, timetableSlots, attendanceRecords } from "@shared/schema";
import { sql, eq } from "drizzle-orm";

export async function migrateSections() {
  console.log("Force migrating sections to simplified names (FY-IT, SE-IT, TE-IT, BE-IT)...");
  const sectionMappings = [
    { oldPrefix: "FY-IT", newName: "FY-IT" },
    { oldPrefix: "SE-IT", newName: "SE-IT" },
    { oldPrefix: "TE-IT", newName: "TE-IT" },
    { oldPrefix: "BE-IT", newName: "BE-IT" },
  ];

  for (const mapping of sectionMappings) {
    // Update students
    await db.execute(sql`
      UPDATE students 
      SET section = ${mapping.newName} 
      WHERE section LIKE ${mapping.oldPrefix + "%"} AND section != ${mapping.newName}
    `);
    
    // Update timetable slots
    await db.execute(sql`
      UPDATE timetable_slots 
      SET section = ${mapping.newName} 
      WHERE section LIKE ${mapping.oldPrefix + "%"} AND section != ${mapping.newName}
    `);
  }
  console.log("Section migration complete.");
}

export async function seedDatabase() {
  // Always run migration first
  await migrateSections();

  // Check if we already have students to avoid re-seeding/clearing
  const existingStudents = await db.select().from(students);
  
  if (existingStudents.length > 0) {
    // If students exist, we only want to keep the enrolled ones
    // and delete the "demo" students (those without embeddings)
    await db.delete(students).where(sql`${students.embedding} IS NULL`);
    console.log("Cleaned up demo students. Keeping only enrolled students with embeddings.");
    return;
  }

  console.log("Database is empty. Skipping demo student seeding.");
  
  // Note: We are no longer seeding demo students to keep the database clean
  // for the user's actual enrolled students.
}

export async function seedTimetable(teacherId: string) {
  const existing = await db.select().from(timetableSlots).where(eq(timetableSlots.teacherId, teacherId));
  // If we already seeded this teacher, don't duplicate (though we cleared global slots, this check is per-teacher)
  if (existing.length > 0) return;

  console.log("Seeding timetable with Mumbai University IT subjects...");

  // Subjects mapped to Year/Sem
  const seSubjects = ["Data Structures", "Database Mgmt (DBMS)", "Java Lab", "Maths III", "PCOM"];
  const teSubjects = ["Internet Programming", "Network Security", "Software Engg", "Data Mining", "Wireless Tech"];
  const beSubjects = ["AI & Machine Learning", "Big Data Analytics", "Infrastructure Security", "Major Project I"];

  const sections = ["FY-IT", "SE-IT", "TE-IT", "BE-IT"];
  const rooms = ["CR-101", "CR-102", "Lab-201", "Lab-202", "Seminar Hall"];

  const slots: Array<{
    teacherId: string;
    dayOfWeek: number;
    period: number;
    subject: string;
    section: string;
    room: string;
  }> = [];

  for (let day = 1; day <= 5; day++) { // Mon-Fri
    for (let period = 1; period <= 6; period++) { // 6 lectures per day
      // Randomly assign a section to this slot
      const section = sections[(day + period) % sections.length];
      let subject = "";

      // Assign subject based on section year
      if (section.startsWith("SE")) {
        subject = seSubjects[(day * 2 + period) % seSubjects.length];
      } else if (section.startsWith("TE")) {
        subject = teSubjects[(day * 2 + period) % teSubjects.length];
      } else {
        subject = beSubjects[(day * 2 + period) % beSubjects.length];
      }

      const room = rooms[(day + period) % rooms.length];

      slots.push({
        teacherId,
        dayOfWeek: day, // 1=Mon, 5=Fri
        period,
        subject,
        section,
        room,
      });
    }
  }

  await db.insert(timetableSlots).values(slots);
  console.log(`Seeded ${slots.length} timetable slots.`);
}
