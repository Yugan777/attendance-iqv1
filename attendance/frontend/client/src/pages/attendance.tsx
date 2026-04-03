import { useState, useEffect, useMemo } from "react";
import { useUser } from "@clerk/react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { cn, formatSection } from "@/lib/utils";
import { useActivePeriod } from "@/hooks/use-active-period";
import { useDate } from "@/hooks/use-date";
import {
  Users,
  Check,
  X,
  Clock,
  Save,
  UserCheck,
  UserX,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  Camera,
  Wifi,
  Settings,
  ChevronRight,
} from "lucide-react";
import type { Student, AttendanceRecord, AttendanceStatus, TimetableSlot } from "@shared/schema";

const ADMIN_EMAILS = ["naeem542005@gmail.com", "yugankamble@gmail.com", "yugan777@gmail.com"];

export default function AttendancePage() {
  const { user } = useUser();
  const isAdminUser = (user?.publicMetadata as any)?.role === "admin" ||
    ADMIN_EMAILS.includes(user?.emailAddresses?.[0]?.emailAddress?.toLowerCase() || "");
  const { toast } = useToast();
  const { selectedDate } = useDate();
  const { activePeriod, activeDay, periodTimes } = useActivePeriod(selectedDate);
  const [selectedSection, setSelectedSection] = useState<string>("");
  const [selectedPeriod, setSelectedPeriod] = useState<string>("");
  const [statuses, setStatuses] = useState<Record<string, AttendanceStatus>>({});
  const [piIp, setPiIp] = useState(() => localStorage.getItem("pi_ip") || "");
  const [piIpInput, setPiIpInput] = useState(() => localStorage.getItem("pi_ip") || "");
  const [showPiDialog, setShowPiDialog] = useState(false);
  const [piStatus, setPiStatus] = useState<"idle" | "connecting" | "capturing" | "processing" | "done" | "error">("idle");
  const [detectedCount, setDetectedCount] = useState(0);
  const [sessionActive, setSessionActive] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(false);

  const today = selectedDate.toISOString().split("T")[0];

  const { data: timetable = [] } = useQuery<TimetableSlot[]>({
    queryKey: ["/api/timetable"],
    enabled: !!user?.id,
  });

  const teacherSubject = (user?.publicMetadata as any)?.subject as string | undefined;
  const teacherSubjects = (user?.publicMetadata as any)?.subjects as string[] | undefined;

  const { data: globalSubjects = [] } = useQuery<string[]>({
    queryKey: ["/api/admin/subjects"],
  });

  const allTeacherSubjects = useMemo(() => {
    const raw = [...new Set([teacherSubject, ...(teacherSubjects || [])])].filter(Boolean) as string[];
    return raw.filter(s => globalSubjects.some(g => g.toLowerCase() === s.toLowerCase()));
  }, [teacherSubject, teacherSubjects, globalSubjects]);

  const currentScheduledSlot = timetable.find(
    (s) => s.section.startsWith(selectedSection) && s.period === parseInt(selectedPeriod) && s.dayOfWeek === activeDay
  );

  const isOwnClass = !allTeacherSubjects.length ||
    (currentScheduledSlot
      ? allTeacherSubjects.some(s => s.toLowerCase() === currentScheduledSlot.subject.toLowerCase())
      : allTeacherSubjects.length > 0);

  const canMarkAttendance = isAdminUser || isOwnClass;

  const ownSlots = timetable.filter(
    (s) => !allTeacherSubjects.length || allTeacherSubjects.some(ts => ts.toLowerCase() === s.subject.toLowerCase())
  );

  const sections = ["FY-IT", "SE-IT", "TE-IT", "BE-IT"];

  useEffect(() => {
    if (ownSlots.length > 0 && activePeriod !== null && activeDay !== null) {
      const activeSlot = ownSlots.find((s) => s.dayOfWeek === activeDay && s.period === activePeriod);
      if (activeSlot) {
        setSelectedSection(activeSlot.section);
        setSelectedPeriod(String(activePeriod));
      }
    }
  }, [timetable, activePeriod, activeDay, teacherSubject]);

  const { data: students = [], isLoading: studentsLoading } = useQuery<Student[]>({
    queryKey: ["/api/students", `?section=${selectedSection}`],
    enabled: !!selectedSection,
  });

  const { data: existingRecords = [], refetch: refetchAttendance } = useQuery<AttendanceRecord[]>({
    queryKey: ["/api/attendance", `?date=${today}&period=${selectedPeriod}`],
    enabled: !!selectedPeriod && !!user?.id,
    refetchInterval: sessionActive ? 3000 : false, // Poll every 3s during active session
  });

  useEffect(() => {
    if (existingRecords.length > 0) {
      const map: Record<string, AttendanceStatus> = {};
      existingRecords.forEach((r) => { map[r.studentId] = r.status; });
      setStatuses((prev) => ({ ...prev, ...map }));
    }
  }, [existingRecords]);

  useEffect(() => {
    // Initial check for active session
    const headers: Record<string, string> = {};
    if (piIp) headers["x-pi-ip"] = piIp;

    fetch("/api/health", { headers })
      .then(res => res.json())
      .then(data => {
        if (data.session_active) {
          setSessionActive(true);
        }
      })
      .catch(() => {});
  }, [piIp]);

  const toggleStatus = (studentId: string) => {
    setStatuses((prev) => {
      const current = prev[studentId] || "present";
      const next: AttendanceStatus = current === "present" ? "late" : current === "late" ? "absent" : "present";
      return { ...prev, [studentId]: next };
    });
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const records = students.map((s) => ({
        studentId: s.id, date: today, period: parseInt(selectedPeriod), status: statuses[s.id] || "absent",
      }));
      return apiRequest("POST", "/api/attendance/bulk", records);
    },
    onSuccess: () => {
      toast({ title: "Attendance Saved!", description: "Records have been updated successfully." });
      queryClient.invalidateQueries({ queryKey: ["/api/attendance"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reports/defaulters"] });
      queryClient.invalidateQueries({ queryKey: ["/api/students"] });
    },
    onError: (err: any) => { toast({ title: "Error", description: err.message, variant: "destructive" }); },
  });

  const markAllPresent = () => {
    const newStatuses: Record<string, AttendanceStatus> = {};
    students.forEach((s) => { newStatuses[s.id] = "present"; });
    setStatuses((prev) => ({ ...prev, ...newStatuses }));
    toast({ title: "All Present", description: "All students marked as present." });
  };

  const savePiIp = () => {
    localStorage.setItem("pi_ip", piIpInput);
    setPiIp(piIpInput);
    setShowPiDialog(false);
    toast({ title: "Pi IP Saved", description: `Raspberry Pi IP set to ${piIpInput}` });
  };

  const startSession = async () => {
    if (!selectedSection || !selectedPeriod) {
      toast({ title: "Error", description: "Select section and period first", variant: "destructive" });
      return;
    }
    setSessionLoading(true);
    try {
      const sessionId = `session_${Date.now()}`;
      const res = await apiRequest("POST", "/api/start-session", {
        session_id: sessionId,
        metadata: {
          teacher_id: user?.id,
          date: today,
          period: parseInt(selectedPeriod),
          section: selectedSection,
        }
      }, {
        headers: piIp ? { "x-pi-ip": piIp } : {}
      });
      const data = await res.json();
      if (data.status === "ok") {
        setSessionActive(true);
        toast({ title: "Session Started", description: "The Pi will now push detections automatically." });
      } else {
        throw new Error(data.error || "Failed to start session");
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSessionLoading(false);
    }
  };

  const stopSession = async () => {
    setSessionLoading(true);
    try {
      const res = await apiRequest("POST", "/api/stop-session", {}, {
        headers: piIp ? { "x-pi-ip": piIp } : {}
      });
      const data = await res.json();
      if (data.status === "ok") {
        setSessionActive(false);
        toast({ title: "Session Stopped", description: "Face detection session ended." });
        queryClient.invalidateQueries({ queryKey: ["/api/attendance"] });
      } else {
        throw new Error(data.error || "Failed to stop session");
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSessionLoading(false);
    }
  };

  const takeAttendance = async () => {
    if (!selectedSection || students.length === 0) {
      toast({ title: "Error", description: "Select a section with students first", variant: "destructive" });
      return;
    }
    setPiStatus("connecting");
    setDetectedCount(0);
    try {
      const headers: Record<string, string> = {};
      if (piIp) headers["x-pi-ip"] = piIp;

      const healthRes = await fetch("/api/health", { headers, signal: AbortSignal.timeout(5000) }).catch(() => null);
      if (!healthRes || !healthRes.ok) {
        setPiStatus("error");
        toast({ title: "Server Unreachable", description: "Cannot reach the Pi backend.", variant: "destructive" });
        setTimeout(() => setPiStatus("idle"), 3000);
        return;
      }
      setPiStatus("capturing");
      const enrolledRes = await fetch(`/api/students/enrolled?section=${encodeURIComponent(selectedSection)}`, { credentials: "include" });
      if (!enrolledRes.ok) throw new Error("Failed to fetch enrolled students");
      const enrolledStudents = await enrolledRes.json();
      const detectPayload = enrolledStudents.filter((s: any) => s.embedding && Array.isArray(s.embedding)).map((s: any) => ({ id: s.id, rollNumber: s.rollNumber, name: s.name, embedding: s.embedding }));
      if (detectPayload.length === 0) {
        setPiStatus("error");
        toast({ title: "No Enrolled Faces", description: "No students have face embeddings. Enroll students first.", variant: "destructive" });
        setTimeout(() => setPiStatus("idle"), 3000);
        return;
      }
      const detectRes = await fetch("/api/detect", { 
        method: "POST", 
        headers: { ...headers, "Content-Type": "application/json" }, 
        body: JSON.stringify({ section: selectedSection, students: detectPayload }), 
        signal: AbortSignal.timeout(120000) 
      });
      if (!detectRes.ok) throw new Error(`Detection failed: ${detectRes.statusText}`);
      setPiStatus("processing");
      const data = await detectRes.json();
      const newStatuses: Record<string, AttendanceStatus> = {};
      students.forEach((s) => { newStatuses[s.id] = "absent"; });
      const detectedNames: string[] = [];
      if (data.detected && Array.isArray(data.detected)) {
        data.detected.forEach((d: { studentId: string; confidence?: number }) => {
          if (newStatuses.hasOwnProperty(d.studentId)) {
            newStatuses[d.studentId] = "present";
            const student = students.find(s => s.id === d.studentId);
            if (student) detectedNames.push(student.name);
          }
        });
        setDetectedCount(data.detected.length);
      }
      if (data.late && Array.isArray(data.late)) {
        data.late.forEach((d: { studentId: string }) => {
          if (newStatuses.hasOwnProperty(d.studentId)) newStatuses[d.studentId] = "late";
        });
      }
      setStatuses((prev) => ({ ...prev, ...newStatuses }));
      setPiStatus("done");
      const detected = data.detected?.length || 0;
      toast({ title: "Attendance Captured!", description: detected > 0 ? `Detected: ${detectedNames.join(", ")}` : `0 of ${students.length} students detected.` });
      setTimeout(() => setPiStatus("idle"), 3000);
    } catch (err: any) {
      setPiStatus("error");
      const message = err.name === "TimeoutError" ? "Request timed out. The Pi may be unreachable." : err.message;
      toast({ title: "Detection Error", description: message, variant: "destructive" });
      setTimeout(() => setPiStatus("idle"), 3000);
    }
  };

  const presentCount = students.filter((s) => statuses[s.id] === "present").length;
  const lateCount = students.filter((s) => statuses[s.id] === "late").length;
  const absentCount = students.length - presentCount - lateCount;

  const statusConfig: Record<AttendanceStatus, { gradient: string; avatarBg: string; icon: any; label: string; badge: string }> = {
    present: {
      gradient: "bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/40 dark:to-green-950/30 border-emerald-200 dark:border-emerald-800/60",
      avatarBg: "bg-gradient-to-br from-emerald-400 to-green-500",
      icon: UserCheck,
      label: "Present",
      badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
    },
    late: {
      gradient: "bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950/40 dark:to-yellow-950/30 border-amber-200 dark:border-amber-800/60",
      avatarBg: "bg-gradient-to-br from-amber-400 to-yellow-500",
      icon: Clock,
      label: "Late",
      badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    },
    absent: {
      gradient: "bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950/40 dark:to-rose-950/30 border-red-200 dark:border-red-800/60",
      avatarBg: "bg-gradient-to-br from-red-400 to-rose-500",
      icon: UserX,
      label: "Absent",
      badge: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
    },
  };

  const piStatusLabel = {
    idle: null,
    connecting: "Connecting to Pi…",
    capturing: "Camera capturing…",
    processing: "Detecting faces…",
    done: `${detectedCount} students detected`,
    error: "Connection failed",
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2.5" data-testid="text-attendance-heading">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md shadow-blue-500/25">
              <UserCheck className="w-4 h-4 text-white" />
            </div>
            Attendance
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-medium">
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setShowPiDialog(true)}
          className={cn(
            "relative rounded-xl h-10 w-10 border",
            piIp ? "text-emerald-600 border-emerald-200 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-950/30" : "border-gray-200 dark:border-gray-700 text-gray-500"
          )}
          title={piIp ? `Pi: ${piIp}` : "Configure Raspberry Pi"}
          data-testid="button-pi-settings"
        >
          <Settings className="w-4 h-4" />
          {piIp && (
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white dark:border-gray-900" />
          )}
        </Button>
      </div>

      {/* Control Panel */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800/80 p-4 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Select value={formatSection(selectedSection)} onValueChange={setSelectedSection}>
            <SelectTrigger className="rounded-xl border-gray-100 dark:border-gray-800 h-11" data-testid="select-section">
              <SelectValue placeholder="Select Section" />
            </SelectTrigger>
            <SelectContent>
              {sections.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
              {sections.length === 0 && (<SelectItem value="_none" disabled>No sections in timetable</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="rounded-xl border-gray-100 dark:border-gray-800 h-11" data-testid="select-period">
              <SelectValue placeholder="Select Period" />
            </SelectTrigger>
            <SelectContent>
              {periodTimes.map((t, i) => (
                <SelectItem key={i} value={String(i)}>
                  Period {i + 1} ({t.start}–{t.end}){activePeriod === i ? " ●" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex gap-2">
            <Button
              onClick={sessionActive ? stopSession : startSession}
              disabled={!canMarkAttendance || !selectedSection || !selectedPeriod || sessionLoading}
              variant={sessionActive ? "destructive" : "outline"}
              className={cn(
                "flex-1 h-11 rounded-xl transition-all duration-200",
                sessionActive 
                  ? "bg-red-500 hover:bg-red-600 border-red-200 text-white shadow-md shadow-red-500/20" 
                  : "border-gray-100 dark:border-gray-800 hover:bg-violet-50 dark:hover:bg-violet-950/30 hover:border-violet-200 dark:hover:border-violet-800/60 text-violet-600 dark:text-violet-400"
              )}
              data-testid="button-toggle-session"
            >
              {sessionLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : 
               sessionActive ? <X className="w-4 h-4 mr-2" /> : <Wifi className="w-4 h-4 mr-2" />}
              {sessionActive ? "Stop Session" : "Start Session"}
            </Button>
            
            <Button
              onClick={takeAttendance}
              disabled={!canMarkAttendance || !selectedSection || students.length === 0 || ["capturing", "processing", "connecting"].includes(piStatus) || sessionActive}
              className={cn(
                "flex-1 h-11 rounded-xl relative overflow-hidden font-semibold transition-all duration-200",
                piStatus === "done" ? "bg-gradient-to-r from-emerald-500 to-green-500 shadow-md shadow-green-500/20" :
                piStatus === "error" ? "bg-gradient-to-r from-red-500 to-rose-500" :
                "bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 shadow-md shadow-violet-500/25 hover:scale-[1.02] active:scale-[0.98]"
              )}
              data-testid="button-take-attendance"
            >
              {piStatus === "idle" ? (<><Camera className="w-4 h-4 mr-2" />Capture</>) :
               piStatus === "connecting" ? (<><Wifi className="w-4 h-4 mr-2 animate-pulse" />Connecting…</>) :
               piStatus === "capturing" ? (<><Camera className="w-4 h-4 mr-2 animate-pulse" />Capturing…</>) :
               piStatus === "processing" ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Detecting…</>) :
               piStatus === "done" ? (<><CheckCircle2 className="w-4 h-4 mr-2" />{detectedCount} Detected</>) :
               (<><X className="w-4 h-4 mr-2" />Failed</>)}
            </Button>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={markAllPresent}
              disabled={!canMarkAttendance || !selectedSection || students.length === 0}
              variant="outline"
              className="flex-1 h-11 rounded-xl border-gray-100 dark:border-gray-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 hover:border-emerald-200 dark:hover:border-emerald-800/60 hover:text-emerald-700 dark:hover:text-emerald-400 transition-all"
              data-testid="button-mark-all-present"
            >
              <CheckCircle2 className="w-4 h-4 mr-1.5" />
              All Present
            </Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={!canMarkAttendance || students.length === 0 || saveMutation.isPending}
              className="flex-1 h-11 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 shadow-md shadow-indigo-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
              data-testid="button-save-attendance"
            >
              {saveMutation.isPending ? (<Loader2 className="w-4 h-4 mr-1.5 animate-spin" />) : (<Save className="w-4 h-4 mr-1.5" />)}
              Save
            </Button>
          </div>
        </div>
      </div>

      {/* Warnings */}
      {!canMarkAttendance && selectedSection && selectedPeriod && (
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/60 rounded-2xl p-4 flex items-start gap-3 animate-fade-in">
          <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
          <div className="space-y-0.5">
            <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">Not your scheduled class</p>
            <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
              {currentScheduledSlot
                ? `It is currently ${currentScheduledSlot.subject} for ${selectedSection}.`
                : "No class is scheduled for this section now."}
              {" Only your assigned subjects ("}{allTeacherSubjects.join(", ")}{") can be marked."}
            </p>
          </div>
        </div>
      )}

      {/* Pi status banner */}
      {piStatusLabel[piStatus] && (
        <div className={cn(
          "flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-semibold transition-all animate-fade-in",
          piStatus === "done" && "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60",
          piStatus === "error" && "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800/60",
          ["connecting", "capturing", "processing"].includes(piStatus) && "bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800/60",
        )} data-testid="text-pi-status">
          {piStatus === "done" && <CheckCircle2 className="w-4 h-4" />}
          {piStatus === "error" && <AlertTriangle className="w-4 h-4" />}
          {["connecting", "capturing", "processing"].includes(piStatus) && <Loader2 className="w-4 h-4 animate-spin" />}
          {piStatusLabel[piStatus]}
        </div>
      )}

      {/* Stats */}
      {selectedSection && students.length > 0 && (
        <div className="grid grid-cols-3 gap-3 animate-fade-up">
          {[
            { count: presentCount, label: "Present", gradient: "from-emerald-500 to-green-500", shadow: "shadow-green-500/20", bg: "bg-emerald-50 dark:bg-emerald-950/30", icon: Check },
            { count: lateCount, label: "Late", gradient: "from-amber-400 to-yellow-500", shadow: "shadow-amber-500/20", bg: "bg-amber-50 dark:bg-amber-950/30", icon: Clock },
            { count: absentCount, label: "Absent", gradient: "from-red-500 to-rose-500", shadow: "shadow-red-500/20", bg: "bg-red-50 dark:bg-red-950/30", icon: X },
          ].map((stat) => (
            <div key={stat.label} className={cn("rounded-2xl p-4 flex items-center gap-3.5", stat.bg, "border", stat.label === "Present" ? "border-emerald-200 dark:border-emerald-800/60" : stat.label === "Late" ? "border-amber-200 dark:border-amber-800/60" : "border-red-200 dark:border-red-800/60")}>
              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shadow-md", `bg-gradient-to-br ${stat.gradient}`, stat.shadow)}>
                <stat.icon className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className={cn("text-2xl font-black", stat.label === "Present" ? "text-emerald-700 dark:text-emerald-300" : stat.label === "Late" ? "text-amber-700 dark:text-amber-300" : "text-red-700 dark:text-red-300")}>
                  {stat.count}
                </p>
                <p className={cn("text-xs font-semibold", stat.label === "Present" ? "text-emerald-600 dark:text-emerald-400" : stat.label === "Late" ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400")}>
                  {stat.label}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Student grid / loading */}
      {studentsLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[...Array(6)].map((_, i) => (<Skeleton key={i} className="h-24 rounded-2xl shimmer-bg" />))}
        </div>
      ) : selectedSection && students.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-800 p-14 text-center animate-fade-in">
          <Users className="w-12 h-12 text-gray-300 dark:text-gray-700 mx-auto mb-3" />
          <p className="text-gray-500 font-semibold">No students in this section</p>
          <p className="text-sm text-gray-400 mt-1">Add students to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {students.map((student, idx) => {
            const status = statuses[student.id] || "absent";
            const config = statusConfig[status];
            const Icon = config.icon;
            return (
              <button
                key={student.id}
                onClick={() => toggleStatus(student.id)}
                className={cn(
                  "rounded-2xl border p-4 text-left transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md hover:scale-[1.01] active:scale-[0.99]",
                  config.gradient,
                  "animate-fade-up"
                )}
                style={{ animationDelay: `${idx * 30}ms` }}
                data-testid={`card-student-${student.id}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold text-white shadow-md", config.avatarBg)}>
                      {student.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-gray-900 dark:text-gray-100" data-testid={`text-student-name-${student.id}`}>
                        {student.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Roll #{student.rollNumber}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className={cn("inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider", config.badge)} data-testid={`badge-status-${student.id}`}>
                      <Icon className="w-3 h-3" />
                      {config.label}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {!selectedSection && (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-800 p-14 text-center animate-fade-in">
          <AlertTriangle className="w-12 h-12 text-gray-300 dark:text-gray-700 mx-auto mb-3" />
          <p className="text-gray-500 font-semibold">Select a section and period</p>
          <p className="text-sm text-gray-400 mt-1">Choose from the dropdowns above to start marking attendance</p>
        </div>
      )}

      {/* Pi Setup Dialog */}
      <Dialog open={showPiDialog} onOpenChange={setShowPiDialog}>
        <DialogContent className="sm:max-w-md rounded-3xl border-gray-100 dark:border-gray-800">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                <Camera className="w-4 h-4 text-white" />
              </div>
              Raspberry Pi Camera Setup
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-500">
              Connect to your Raspberry Pi running the SCRFD face detection server.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Pi IP Address</label>
              <Input
                placeholder="e.g. 192.168.1.100"
                value={piIpInput}
                onChange={(e) => setPiIpInput(e.target.value)}
                className="rounded-xl h-11"
                data-testid="input-pi-ip"
              />
              <p className="text-xs text-gray-400">The Pi should be running the face detection server on port 5000</p>
            </div>

            <div className="bg-gray-50 dark:bg-gray-800/60 rounded-xl p-3 space-y-1.5">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Expected Endpoints</p>
              <div className="space-y-1 text-xs text-gray-400 font-mono">
                <p>GET /api/health</p>
                <p>POST /api/detect</p>
                <p>POST /api/enroll</p>
              </div>
            </div>

            {piIp && (
              <div className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-emerald-700 dark:text-emerald-300 font-medium">Configured: {piIp}</span>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <Button variant="outline" onClick={() => setShowPiDialog(false)} className="flex-1 rounded-xl">Cancel</Button>
              <Button
                onClick={savePiIp}
                disabled={!piIpInput.trim()}
                className="flex-1 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white shadow-md shadow-violet-500/20"
                data-testid="button-save-pi-ip"
              >
                <Wifi className="w-4 h-4 mr-2" />
                Save & Connect
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
