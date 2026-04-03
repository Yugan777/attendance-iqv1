import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatSection(section: string) {
  if (!section) return "";
  const s = section.toUpperCase().trim();
  // Map prefixes to clean names
  if (s.startsWith("FY")) return "FY-IT";
  if (s.startsWith("SF") || s.startsWith("SE")) return "SE-IT";
  if (s.startsWith("TF") || s.startsWith("TE")) return "TE-IT";
  if (s.startsWith("BF") || s.startsWith("BE")) return "BE-IT";
  return s;
}

export function getDemoAttendance(studentName: string, rollNumber: string, section: string) {
  const name = studentName.toLowerCase();
  const realStudentNames = ["yugan", "yugank"];
  const isRealStudent = realStudentNames.some(n => name.includes(n));

  if (isRealStudent) {
    return { percentage: 100, totalClasses: 30, presentClasses: 30 };
  }

  // Use name and roll number to create a stable unique seed
  const seed = studentName.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0) + 
               rollNumber.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  
  const s = section.toUpperCase();
  let base = 75;
  if (s.includes("FY")) base = 82;
  else if (s.includes("SE") || s.includes("SF")) base = 74;
  else if (s.includes("TE") || s.includes("TF")) base = 78;
  else if (s.includes("BE") || s.includes("BF")) base = 88;

  // To keep the report looking realistic, make ~30% of demo students actual defaulters
  const isDemoDefaulter = (seed % 100) < 30; 
  
  // Use more varied randomization to prevent repetitive percentages like 50%
  let percentage: number;
  if (isRealStudent) {
    percentage = 100;
  } else if (isDemoDefaulter) {
    // Range: 35% to 68%
    percentage = 35 + (seed % 34); 
  } else {
    // Range: base to base + 18%
    percentage = Math.min(98, base + (seed % 19));
  }
  
  const totalClasses = 24 + (seed % 12);
  const presentClasses = Math.round(totalClasses * (percentage / 100));

  return { percentage, totalClasses, presentClasses };
}
