import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, pgEnum, json, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const attendanceStatusEnum = pgEnum("attendance_status", ["present", "absent", "late"]);

export const students = pgTable("students", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  rollNumber: text("roll_number").notNull(),
  section: text("section").notNull(),
  enrolled: boolean("enrolled").default(false),
  imageUrl: text("image_url"),
  embedding: json("embedding").$type<number[]>(),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => ({
  unq: uniqueIndex("roll_number_section_idx").on(t.rollNumber, t.section),
}));

export const attendanceRecords = pgTable("attendance_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  studentId: varchar("student_id").notNull().references(() => students.id),
  teacherId: text("teacher_id").notNull(),
  date: text("date").notNull(),
  period: integer("period").notNull(),
  status: attendanceStatusEnum("status").notNull().default("absent"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const timetableSlots = pgTable("timetable_slots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teacherId: text("teacher_id").notNull(),
  dayOfWeek: integer("day_of_week").notNull(),
  period: integer("period").notNull(),
  subject: text("subject").notNull(),
  section: text("section").notNull(),
  room: text("room"),
  startTime: text("start_time"),
  endTime: text("end_time"),
});

export const auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  action: text("action").notNull(), // e.g. "Role Change", "Attendance", "Student Delete"
  description: text("description").notNull(),
  actorId: text("actor_id").notNull(),
  actorName: text("actor_name").notNull(),
  metadata: json("metadata").$type<any>(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const subjects = pgTable("subjects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertStudentSchema = createInsertSchema(students, {
  embedding: z.array(z.number()).nullable().optional(),
}).omit({ id: true, createdAt: true });
export const insertAttendanceSchema = createInsertSchema(attendanceRecords).omit({ id: true, createdAt: true });
export const insertTimetableSlotSchema = createInsertSchema(timetableSlots).omit({ id: true });
export const insertAuditLogSchema = createInsertSchema(auditLogs, {
  metadata: z.any().optional(),
}).omit({ id: true, createdAt: true });

export type Student = typeof students.$inferSelect;
export type InsertStudent = z.infer<typeof insertStudentSchema>;
export type AttendanceRecord = typeof attendanceRecords.$inferSelect;
export type InsertAttendanceRecord = z.infer<typeof insertAttendanceSchema>;
export type TimetableSlot = typeof timetableSlots.$inferSelect;
export type InsertTimetableSlot = z.infer<typeof insertTimetableSlotSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;

export type AttendanceStatus = "present" | "absent" | "late";

export interface StudentWithAttendance extends Student {
  status: AttendanceStatus;
  attendancePercentage?: number;
  totalClasses?: number;
  presentClasses?: number;
}
