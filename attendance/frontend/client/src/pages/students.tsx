import { useQuery, useMutation } from "@tanstack/react-query";
import { Student, StudentWithAttendance, insertStudentSchema } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Search, Plus, Edit2, Trash2, GraduationCap, MoreHorizontal,
} from "lucide-react";
import { useState, useMemo } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import { cn, formatSection, getDemoAttendance } from "@/lib/utils";
import { useUser } from "@clerk/react";

const SECTIONS = ["FY-IT", "SE-IT", "TE-IT", "BE-IT"];

const sectionStyle: Record<string, { pill: string; avatar: string; badge: string }> = {
  "FY-IT": {
    pill: "bg-amber-600 text-white shadow-lg shadow-amber-500/20",
    avatar: "bg-gradient-to-br from-amber-400 to-orange-500 shadow-amber-500/25",
    badge: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  },
  "SE-IT": {
    pill: "bg-blue-600 text-white shadow-lg shadow-blue-500/20",
    avatar: "bg-gradient-to-br from-blue-400 to-indigo-500 shadow-blue-500/25",
    badge: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  },
  "TE-IT": {
    pill: "bg-violet-600 text-white shadow-lg shadow-violet-500/20",
    avatar: "bg-gradient-to-br from-violet-400 to-purple-500 shadow-violet-500/25",
    badge: "bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
  },
  "BE-IT": {
    pill: "bg-emerald-600 text-white shadow-lg shadow-emerald-500/20",
    avatar: "bg-gradient-to-br from-emerald-400 to-green-500 shadow-emerald-500/25",
    badge: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  },
};

const getSectionStyle = (section: string) => {
  for (const [key, val] of Object.entries(sectionStyle)) {
    if (section.startsWith(key.split("-")[0])) return val;
  }
  return {
    pill: "bg-gray-600 text-white",
    avatar: "bg-gradient-to-br from-gray-400 to-gray-500",
    badge: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  };
};

export default function StudentsPage() {
  const { user } = useUser();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSection, setActiveSection] = useState<string>("All");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [studentToDelete, setStudentToDelete] = useState<string | null>(null);

  const isAdmin = user?.publicMetadata?.role === "admin";

  const { data: students = [], isLoading } = useQuery<StudentWithAttendance[]>({
    queryKey: ["/api/students"],
  });

  const { data: defaulters = [] } = useQuery<any[]>({
    queryKey: ["/api/reports/defaulters", "?threshold=101"],
  });

  const studentsWithStats = useMemo(() => {
    return students.map(s => {
      // 1. Find real attendance percentage if it exists
      const def = defaulters.find(d => d.studentId === s.id);
      
      // Check for real student accounts
      const name = s.name.toLowerCase();
      const realStudentNames = ["yugan", "yugank"];
      const isRealStudent = realStudentNames.some(n => name.includes(n));

      // 2. Use real data if it exists AND (it's a real student OR percentage is > 0)
      if (def && def.totalClasses > 0) {
        if (isRealStudent || def.percentage > 0) {
          return { ...s, attendancePercentage: def.percentage };
        }
      }

      // 3. Use centralized demo data logic for perfect sync with Reports
      const demo = getDemoAttendance(s.name, s.rollNumber, s.section);
      return { ...s, attendancePercentage: demo.percentage };
    });
  }, [students, defaulters]);

  const filteredStudents = useMemo(() => {
    return studentsWithStats.filter((student) => {
      const matchesSearch =
        student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.rollNumber.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesSection =
        activeSection === "All" || 
        formatSection(student.section).toUpperCase() === activeSection.toUpperCase();
      return matchesSearch && matchesSection;
    });
  }, [studentsWithStats, searchQuery, activeSection]);

  const studentsBySection = useMemo(() => {
    const grouped: Record<string, typeof filteredStudents> = {};
    SECTIONS.forEach(sec => { grouped[sec] = []; });
    
    filteredStudents.forEach(s => {
      const formatted = formatSection(s.section);
      // Case-insensitive matching for the group key
      const groupKey = SECTIONS.find(sec => sec.toUpperCase() === formatted.toUpperCase());
      if (groupKey && grouped[groupKey]) {
        grouped[groupKey].push(s);
      }
    });
    return grouped;
  }, [filteredStudents]);

  const addMutation = useMutation({
    mutationFn: async (data: any) => { const res = await apiRequest("POST", "/api/students", data); return res.json(); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/students"] }); toast({ title: "Student Added", description: "Student added successfully" }); setIsAddDialogOpen(false); },
    onError: (error: Error) => { toast({ title: "Error", description: error.message, variant: "destructive" }); },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string, data: any }) => { const res = await apiRequest("PATCH", `/api/students/${id}`, data); return res.json(); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/students"] }); toast({ title: "Student Updated" }); setEditingStudent(null); },
    onError: (error: Error) => { toast({ title: "Error", description: error.message, variant: "destructive" }); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/students/${id}`); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/students"] }); toast({ title: "Student Deleted" }); },
    onError: (error: Error) => { toast({ title: "Error", description: error.message, variant: "destructive" }); },
  });

  return (
    <div className="space-y-8 animate-fade-up">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md shadow-blue-500/25">
              <GraduationCap className="w-4 h-4 text-white" />
            </div>
            Students
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-medium">
            {students.length} enrolled across all sections
          </p>
        </div>

        {isAdmin && (
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold px-5 py-2.5 rounded-2xl shadow-lg shadow-indigo-500/20 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Add Student
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] rounded-3xl border-gray-100 dark:border-gray-800">
              <StudentForm
                onSubmit={(data) => addMutation.mutate(data)}
                isSubmitting={addMutation.isPending}
                title="Add New Student"
                initialSection={activeSection !== "All" ? activeSection : "FY"}
              />
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Search + filter */}
      <div className="flex flex-col md:flex-row gap-3 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search students by name or roll number…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-11 h-12 rounded-2xl border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm focus-visible:ring-indigo-500/30 transition-all"
          />
        </div>

        <div className="flex bg-white dark:bg-gray-900 p-1.5 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-x-auto no-scrollbar">
          {["All", ...SECTIONS].map((section) => {
            const style = section !== "All" ? getSectionStyle(section) : null;
            return (
              <button
                key={section}
                onClick={() => setActiveSection(section)}
                className={cn(
                  "px-5 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap",
                  activeSection === section
                    ? style ? style.pill : "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
                    : "text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800"
                )}
              >
                {section === "All" ? "All Students" : formatSection(section)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-10">
        {SECTIONS.filter(s => activeSection === "All" || activeSection === s).map((section) => {
          const style = getSectionStyle(section);
          return (
            <div key={section} className="space-y-4 animate-fade-up">
              {/* Section header */}
              <div className="flex items-center gap-3">
                <div className={cn("w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg text-lg font-black text-white", style.avatar)}>
                  {section.split("-")[0]}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">{formatSection(section)} Section</h2>
                  <p className="text-xs text-gray-500 font-medium">{studentsBySection[section].length} students enrolled</p>
                </div>
                <div className="flex-1 h-px bg-gray-100 dark:bg-gray-800 ml-2" />
                <Badge className={cn("text-[10px] font-bold border-0", style.badge)}>
                  {studentsBySection[section].length}
                </Badge>
              </div>

              {/* Table */}
              <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800/80 shadow-sm overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-gray-50 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/30">
                      <TableHead className="w-[360px] py-5 pl-6 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Student</TableHead>
                      <TableHead className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Roll</TableHead>
                      <TableHead className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Class</TableHead>
                      <TableHead className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Attendance</TableHead>
                      <TableHead className="w-16 py-5 pr-6" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {studentsBySection[section].length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="h-32 text-center text-gray-400 font-medium text-sm">
                          No students found in this section
                        </TableCell>
                      </TableRow>
                    ) : (
                      studentsBySection[section].map((student) => {
                        const pct = student.attendancePercentage ?? 0;
                        const pctColor = pct >= 75 ? "text-emerald-600 dark:text-emerald-400" : pct >= 60 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400";
                        const barColor = pct >= 75 ? "from-emerald-400 to-green-500" : pct >= 60 ? "from-amber-400 to-yellow-500" : "from-red-400 to-rose-500";

                        return (
                          <TableRow key={student.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/40 border-gray-50 dark:border-gray-800/50 group transition-colors">
                            <TableCell className="py-4 pl-6">
                              <div className="flex items-center gap-3.5">
                                <div className={cn("w-10 h-10 rounded-2xl flex items-center justify-center text-white font-bold shadow-md", style.avatar)}>
                                  {student.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <span className="text-sm font-semibold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                    {student.name}
                                  </span>
                                  {student.enrolled && (
                                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-tight flex items-center gap-1 mt-0.5">
                                      <div className="w-1 h-1 rounded-full bg-current animate-pulse" />
                                      Face Enrolled
                                    </p>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm font-bold text-gray-600 dark:text-gray-300">
                                #{student.rollNumber.padStart(2, '0')}
                              </span>
                            </TableCell>
                            <TableCell>
                              <span className={cn("inline-block px-2.5 py-1 rounded-lg text-[10px] font-bold border", style.badge, "border-current/20")}>
                                {formatSection(student.section)}
                              </span>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2.5 w-36">
                                <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                                  <div
                                    className={cn("h-full rounded-full bg-gradient-to-r transition-all duration-700", barColor)}
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                                <span className={cn("text-sm font-bold tabular-nums", pctColor)}>{pct}%</span>
                              </div>
                            </TableCell>
                            <TableCell className="py-4 pr-6 text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" className="w-8 h-8 p-0 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800">
                                    <MoreHorizontal className="w-4 h-4 text-gray-400" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-44 p-1.5 rounded-2xl border-gray-100 dark:border-gray-800">
                                  <DropdownMenuItem className="flex items-center gap-2 py-2.5 px-3 rounded-xl text-sm font-medium cursor-pointer" onClick={() => setEditingStudent(student)}>
                                    <Edit2 className="w-3.5 h-3.5" />Edit Student
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className="flex items-center gap-2 py-2.5 px-3 rounded-xl text-sm font-medium text-red-600 dark:text-red-400 cursor-pointer hover:bg-red-50 dark:hover:bg-red-900/20"
                                    onClick={() => setStudentToDelete(student.id)}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />Delete Student
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          );
        })}
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingStudent} onOpenChange={(open) => !open && setEditingStudent(null)}>
        <DialogContent className="sm:max-w-[425px] rounded-3xl border-gray-100 dark:border-gray-800">
          {editingStudent && (
            <StudentForm
              defaultValues={editingStudent}
              onSubmit={(data) => updateMutation.mutate({ id: editingStudent.id, data })}
              isSubmitting={updateMutation.isPending}
              title="Edit Student"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!studentToDelete} onOpenChange={(open) => !open && setStudentToDelete(null)}>
        <AlertDialogContent className="rounded-3xl border-gray-100 dark:border-gray-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold">Delete Student</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-500 font-medium">
              Are you sure you want to delete this student? This action cannot be undone and all attendance records will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="rounded-2xl border-gray-100 dark:border-gray-800 font-bold">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="rounded-2xl bg-red-600 hover:bg-red-700 text-white font-bold shadow-lg shadow-red-500/20"
              onClick={() => {
                if (studentToDelete) {
                  deleteMutation.mutate(studentToDelete);
                  setStudentToDelete(null);
                }
              }}
            >
              {deleteMutation.isPending ? "Deleting..." : "Yes, Delete Student"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StudentForm({
  onSubmit, isSubmitting, defaultValues, title, initialSection = "FY"
}: {
  onSubmit: (data: any) => void;
  isSubmitting: boolean;
  defaultValues?: Partial<Student>;
  title: string;
  initialSection?: string;
}) {
  const form = useForm({
    resolver: zodResolver(insertStudentSchema),
    defaultValues: defaultValues || { name: "", rollNumber: "", section: initialSection, enrolled: false },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 pt-2">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-gray-900 dark:text-white">{title}</DialogTitle>
          <DialogDescription className="text-gray-500 text-sm">
            {defaultValues ? "Update the student's details." : "Fill in the student's details below."}
          </DialogDescription>
        </DialogHeader>

        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Full Name</FormLabel>
              <FormControl>
                <Input {...field} className="h-11 rounded-xl" placeholder="e.g. Aarav Sharma" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-3">
          <FormField
            control={form.control}
            name="rollNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Roll Number</FormLabel>
                <FormControl>
                  <Input {...field} className="h-11 rounded-xl" placeholder="e.g. 01" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="section"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Section</FormLabel>
                <FormControl>
                  <select
                      {...field}
                      className="w-full h-11 rounded-xl border border-input bg-background px-3 text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                    >
                      {field.value && !SECTIONS.includes(field.value) && (
                        <option value={field.value}>{formatSection(field.value)}</option>
                      )}
                      {SECTIONS.map(s => (<option key={s} value={s}>{formatSection(s)}</option>))}
                    </select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <DialogFooter className="pt-2">
          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-12 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold shadow-lg shadow-indigo-500/20 transition-all hover:scale-[1.01] active:scale-[0.99]"
          >
            {isSubmitting ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              defaultValues ? "Save Changes" : "Create Student"
            )}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}
