import { db } from "./db";
import { students } from "../shared/schema";
import { eq, and } from "drizzle-orm";

async function checkStudent() {
  try {
    console.log("Checking for student 'yugan' with roll number '23'...");
    const result = await db.select().from(students).where(
      and(
        eq(students.name, "yugan"),
        eq(students.rollNumber, "23")
      )
    );
    
    if (result.length > 0) {
      console.log("FOUND STUDENT:");
      console.log(JSON.stringify(result[0], null, 2));
    } else {
      // Try case-insensitive or partial search just in case
      console.log("Student not found with exact name 'yugan'. Searching for similar names...");
      const allStudents = await db.select().from(students);
      const similar = allStudents.filter(s => 
        s.name.toLowerCase().includes("yugan") || s.rollNumber === "23"
      );
      if (similar.length > 0) {
        console.log("SIMILAR STUDENTS FOUND:");
        console.log(JSON.stringify(similar, null, 2));
      } else {
        console.log("No student found with name 'yugan' or roll number '23'.");
      }
    }
  } catch (error) {
    console.error("Error querying database:", error);
  } finally {
    process.exit();
  }
}

checkStudent();
