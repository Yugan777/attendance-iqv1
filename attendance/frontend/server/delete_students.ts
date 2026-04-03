
import { db } from "./db";
import { students, attendanceRecords } from "../shared/schema";
import { eq, inArray } from "drizzle-orm";

async function deleteStudentsBySection(section: string) {
  try {
    console.log(`Deleting students from section: ${section}`);

    // First, find all students in the section
    const studentsToDelete = await db.select().from(students).where(eq(students.section, section));

    if (studentsToDelete.length === 0) {
      console.log(`No students found in section ${section}.`);
      return;
    }

    const studentIds = studentsToDelete.map(s => s.id);
    console.log(`Found ${studentIds.length} students to delete.`);

    // Delete attendance records for these students first (referential integrity)
    const deletedAttendance = await db.delete(attendanceRecords).where(inArray(attendanceRecords.studentId, studentIds)).returning();
    console.log(`Deleted ${deletedAttendance.length} attendance records.`);

    // Delete the students
    const deletedStudents = await db.delete(students).where(inArray(students.id, studentIds)).returning();
    console.log(`Successfully deleted ${deletedStudents.length} students from section ${section}.`);

  } catch (error) {
    console.error("Error deleting students:", error);
  } finally {
    process.exit();
  }
}

// Run the function for the specified section
deleteStudentsBySection("TE-IT-Sem5-A");
