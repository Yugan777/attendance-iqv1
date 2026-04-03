import { useState, useEffect } from "react";
import { useUser } from "@clerk/react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import {
  Shield,
  UserCheck,
  UserX,
  Clock,
  Zap,
  Mail,
  BookOpen,
  Loader2,
  Users,
  Info,
  ClipboardList,
  Calendar,
  CheckCircle2,
  FileText,
  History,
  AlertCircle,
  Plus,
  X,
  RotateCcw,
  AlertTriangle,
  Pencil,
  Check,
  Trash2,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { format } from "date-fns";

interface AuditLog {
  id: string;
  action: string;
  description: string;
  actorId: string;
  actorName: string;
  metadata: any;
  createdAt: string;
}

interface PendingUser {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  subject: string;
  status: string;
  createdAt: number;
}

interface AppUser {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  subject: string;
  subjects?: string[];
  role: string;
  status: string;
  teacherName?: string;
  createdAt: number;
}

type TabId = "roles" | "policies" | "holidays" | "audit";

const TABS: { id: TabId; label: string; icon: typeof Users }[] = [
  { id: "roles", label: "User Roles", icon: Users },
  { id: "policies", label: "Attendance Policies", icon: ClipboardList },
  { id: "holidays", label: "Holidays & Closures", icon: Calendar },
  { id: "audit", label: "Audit Log", icon: FileText },
];

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800",
  teacher: "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800",
  viewer: "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700",
};

const INDIAN_HOLIDAYS_2026 = [
  { date: "2026-01-26", name: "Republic Day", type: "Gazetted" },
  { date: "2026-02-15", name: "Maha Shivaratri", type: "Gazetted" },
  { date: "2026-03-04", name: "Holi", type: "Gazetted" },
  { date: "2026-03-19", name: "Gudi Padwa", type: "Restricted" },
  { date: "2026-03-20", name: "Eid-ul-Fitr", type: "Gazetted" },
  { date: "2026-03-27", name: "Ram Navami", type: "Gazetted" },
  { date: "2026-04-03", name: "Good Friday", type: "Gazetted" },
  { date: "2026-04-14", name: "Ambedkar Jayanti", type: "Gazetted" },
  { date: "2026-05-01", name: "Maharashtra Day", type: "Public" },
  { date: "2026-05-27", name: "Bakri Id (Eid-ul-Adha)", type: "Gazetted" },
  { date: "2026-08-15", name: "Independence Day", type: "Gazetted" },
  { date: "2026-09-14", name: "Ganesh Chaturthi", type: "Gazetted" },
  { date: "2026-10-02", name: "Mahatma Gandhi Jayanti", type: "Gazetted" },
  { date: "2026-10-20", name: "Dussehra", type: "Gazetted" },
  { date: "2026-11-08", name: "Diwali (Deepavali)", type: "Gazetted" },
  { date: "2026-11-24", name: "Guru Nanak Jayanti", type: "Gazetted" },
  { date: "2026-12-25", name: "Christmas Day", type: "Gazetted" },
];

/* ─── Edit-Teacher Dialog ─────────────────────────────────────── */
function EditTeacherDialog({
  open,
  onClose,
  teacher,
  globalSubjects,
  subjectsLoading,
  subjectsMutation,
}: {
  open: boolean;
  onClose: () => void;
  teacher: AppUser;
  globalSubjects: string[];
  subjectsLoading: boolean;
  subjectsMutation: any;
}) {
  const currentSubjects: string[] = [
    ...(teacher.subjects || []),
    teacher.subject
  ].filter(Boolean) as string[];
  
  // Use a Set to unique-ify the list
  const uniqueSubjects = [...new Set(currentSubjects)];
  const [localSubjects, setLocalSubjects] = useState<string[]>(uniqueSubjects);
  const [selectedToAdd, setSelectedToAdd] = useState("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  // Reset when dialog re-opens for a different teacher
  useEffect(() => {
    const refreshed = [
      ...(teacher.subjects || []),
      teacher.subject
    ].filter(Boolean) as string[];
    setLocalSubjects([...new Set(refreshed)]);
    setSelectedToAdd("");
  }, [teacher.id, open, teacher.subjects, teacher.subject]);

  const available = globalSubjects.filter((s) => !localSubjects.includes(s));

  const handleAdd = () => {
    if (!selectedToAdd || localSubjects.includes(selectedToAdd)) return;
    setLocalSubjects((prev) => [...prev, selectedToAdd]);
    setSelectedToAdd("");
  };

  const handleRemove = (s: string) => {
    setLocalSubjects((prev) => prev.filter((x) => x !== s));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await subjectsMutation.mutateAsync({ userId: teacher.id, subjects: localSubjects });
      onClose();
    } catch (e) {
      /* toast handled by mutation */
    } finally {
      setSaving(false);
    }
  };

  const displayName = [teacher.firstName, teacher.lastName].filter(Boolean).join(" ") || "Unknown User";
  const initials = ((teacher.firstName?.[0] || "") + (teacher.lastName?.[0] || "")).toUpperCase() || "?";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md rounded-3xl border-gray-100 dark:border-gray-800">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5 text-lg font-bold">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
              <Pencil className="w-4 h-4 text-white" />
            </div>
            Edit Teacher
          </DialogTitle>
          <DialogDescription className="text-sm text-gray-500">
            Manage subject assignments for this teacher.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-1">
          {/* Teacher identity (read-only) */}
          <div className="flex items-center gap-3 p-3 rounded-2xl bg-gray-50 dark:bg-gray-800/60">
            <div className={cn(
              "w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold shrink-0",
              teacher.role === "admin"
                ? "bg-gradient-to-br from-indigo-400 to-violet-500 text-white"
                : teacher.role === "teacher"
                ? "bg-gradient-to-br from-emerald-400 to-green-500 text-white"
                : "bg-gradient-to-br from-gray-400 to-gray-500 text-white"
            )}>
              {initials}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm text-gray-900 dark:text-white truncate">{displayName}</p>
              <p className="text-xs text-gray-400 truncate">{teacher.email}</p>
            </div>
            <Badge className={cn(
              "ml-auto text-[10px] border-0 font-bold shrink-0",
              teacher.role === "admin" ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300" :
              teacher.role === "teacher" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" :
              "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
            )}>
              {teacher.role}
            </Badge>
          </div>

          {/* Assigned subjects */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Assigned Subjects</label>
              <span className="text-xs text-gray-400 font-medium">{localSubjects.length} subject{localSubjects.length !== 1 ? "s" : ""}</span>
            </div>

            {localSubjects.length === 0 ? (
              <div className="text-center py-5 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700">
                <BookOpen className="w-6 h-6 text-gray-300 dark:text-gray-600 mx-auto mb-1.5" />
                <p className="text-xs text-gray-400">No subjects assigned yet</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {localSubjects.map((s) => (
                  <div
                    key={s}
                    className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/60 group"
                  >
                    <span className="text-sm font-medium text-indigo-800 dark:text-indigo-200">{s}</span>
                    <button
                      onClick={() => handleRemove(s)}
                      className="w-6 h-6 rounded-lg flex items-center justify-center text-indigo-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all opacity-0 group-hover:opacity-100"
                      title={`Remove ${s}`}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add subject */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Add Subject</label>
            <div className="flex gap-2">
              <Select value={selectedToAdd} onValueChange={setSelectedToAdd}>
                <SelectTrigger className="flex-1 rounded-xl h-10 border-gray-100 dark:border-gray-800 text-sm">
                  <SelectValue placeholder={subjectsLoading ? "Loading…" : available.length === 0 ? "All assigned" : "Select a subject…"} />
                </SelectTrigger>
                <SelectContent>
                  {available.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-gray-400 italic">No more subjects to add</div>
                  ) : (
                    available.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))
                  )}
                </SelectContent>
              </Select>
              <Button
                onClick={handleAdd}
                disabled={!selectedToAdd}
                className="h-10 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-500/20 transition-all hover:scale-[1.02] disabled:opacity-50 disabled:scale-100"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 pt-2">
          <Button variant="outline" onClick={onClose} className="rounded-xl flex-1">Cancel</Button>
          <Button
            onClick={handleSave}
            disabled={saving || subjectsMutation.isPending}
            className="flex-1 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold shadow-md shadow-indigo-500/20 transition-all hover:scale-[1.01]"
          >
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


export default function AdminPage() {
  const { user, isLoaded } = useUser();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<TabId>("roles");
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [subjectToDelete, setSubjectToDelete] = useState<string | null>(null);

  const isAdmin = (user?.publicMetadata as any)?.role === "admin";

  if (!isLoaded) {
    return (
      <div className="space-y-8 animate-pulse">
        <Skeleton className="h-10 w-48 bg-gray-200 dark:bg-gray-800" />
        <Skeleton className="h-4 w-64 bg-gray-200 dark:bg-gray-800" />
        <div className="space-y-4">
          <Skeleton className="h-[200px] rounded-3xl bg-gray-200 dark:bg-gray-800" />
          <Skeleton className="h-[400px] rounded-3xl bg-gray-200 dark:bg-gray-800" />
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-red-50 dark:bg-red-950/30 flex items-center justify-center">
          <Shield className="w-8 h-8 text-red-600 dark:text-red-400" />
        </div>
        <div className="text-center">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Access Denied</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">Admin privileges are required to view this page.</p>
        </div>
      </div>
    );
  }

  // Policy State
  const [policies, setPolicies] = useState(() => {
    const saved = localStorage.getItem("attendance_policies");
    return saved ? JSON.parse(saved) : {
      minAttendance: 75,
      warningThreshold: 80,
      gracePeriod: 10,
      lateCutoff: 20,
      autoLateEnabled: true
    };
  });

  const [tempPolicies, setTempPolicies] = useState(policies);
  const [showPolicyDialog, setShowPolicyDialog] = useState(false);

  useEffect(() => {
    localStorage.setItem("attendance_policies", JSON.stringify(policies));
  }, [policies]);

  const { data: pendingUsers = [], isLoading: pendingLoading } = useQuery<PendingUser[]>({
    queryKey: ["/api/admin/pending-users"],
  });

  const { data: allUsers = [], isLoading: usersLoading } = useQuery<AppUser[]>({
    queryKey: ["/api/admin/all-users"],
  });

  const { data: auditLogs = [], isLoading: auditLoading } = useQuery<AuditLog[]>({
    queryKey: ["/api/audit-logs"],
    enabled: activeTab === "audit",
  });

  const { data: globalSubjects = [], isLoading: subjectsLoading, error: subjectsError } = useQuery<string[]>({
    queryKey: ["/api/admin/subjects"],
    staleTime: 0,
  });

  const addGlobalSubjectMutation = useMutation({
    mutationFn: async (name: string) => {
      return apiRequest("POST", "/api/admin/subjects", { name });
    },
    onSuccess: () => {
      toast({ title: "Subject Added", description: "Global subject list updated." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/subjects"] });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteGlobalSubjectMutation = useMutation({
    mutationFn: async (name: string) => {
      return apiRequest("DELETE", `/api/admin/subjects/${name}`);
    },
    onSuccess: () => {
      toast({ title: "Subject Deleted", description: "Global subject list updated." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/subjects"] });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const cleanupMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/cleanup-all-subjects");
      return res.json() as Promise<{ cleanedCount: number }>;
    },
    onSuccess: (data) => {
      toast({ title: "Cleanup Done", description: `Cleaned up invalid subjects for ${data.cleanedCount} users.` });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/all-users"] });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });


  const approveMutation = useMutation({
    mutationFn: async (userId: string) => {
      return apiRequest("POST", "/api/admin/approve-user", { userId });
    },
    onSuccess: () => {
      toast({ title: "Approved!", description: "Teacher has been approved." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/all-users"] });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (userId: string) => {
      return apiRequest("POST", "/api/admin/reject-user", { userId });
    },
    onSuccess: () => {
      toast({ title: "Rejected", description: "Teacher has been rejected." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/all-users"] });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      return apiRequest("POST", "/api/admin/update-role", { userId, role });
    },
    onSuccess: () => {
      toast({ title: "Updated", description: "User role updated successfully." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/all-users"] });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const subjectsMutation = useMutation({
    mutationFn: async ({ userId, subjects }: { userId: string; subjects: string[] }) => {
      return apiRequest("POST", "/api/admin/update-user-subjects", { userId, subjects });
    },
    onSuccess: () => {
      toast({ title: "Updated", description: "Teacher subjects updated successfully." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/all-users"] });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      return apiRequest("DELETE", `/api/admin/users/${userId}`);
    },
    onSuccess: () => {
      toast({ title: "Account Removed", description: "Teacher has been deleted from the system." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/all-users"] });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const getInitials = (u: AppUser | PendingUser) => {
    const first = u.firstName?.[0] || "";
    const last = u.lastName?.[0] || "";
    return (first + last).toUpperCase() || "?";
  };

  const getDisplayName = (u: AppUser | PendingUser) => {
    const parts = [u.firstName, u.lastName].filter(Boolean);
    return parts.length > 0 ? parts.join(" ") : "Unknown User";
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
          System
        </p>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2 mt-1" data-testid="text-admin-heading">
          <Shield className="w-6 h-6" />
          Admin Settings
        </h2>
        <p className="text-muted-foreground text-sm mt-1">
          Configure system-wide policies, roles, and school calendar
        </p>
      </div>

      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-800 overflow-x-auto">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                activeTab === tab.id
                  ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-gray-300"
              )}
              data-testid={`tab-${tab.id}`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === "roles" && (
        <div className="space-y-6">
          <p className="text-sm text-muted-foreground">Manage user permissions</p>

          <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 text-sm">
            <Info className="w-4 h-4 shrink-0" />
            Role changes take effect immediately. Admins have full access to all settings and data.
          </div>

          {pendingUsers.length > 0 && (
            <Card className="border shadow-lg">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-500" />
                    Pending Approvals
                  </h3>
                  <Badge variant="outline" className="text-amber-600 border-amber-300 dark:border-amber-700">
                    {pendingUsers.length} pending
                  </Badge>
                </div>
                <div className="space-y-3">
                  {pendingUsers.map((u) => (
                    <div
                      key={u.id}
                      className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/50"
                      data-testid={`card-pending-user-${u.id}`}
                    >
                      <div className="w-10 h-10 rounded-full bg-amber-200 dark:bg-amber-800/50 flex items-center justify-center text-sm font-bold text-amber-700 dark:text-amber-300 shrink-0">
                        {getInitials(u)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm" data-testid={`text-user-name-${u.id}`}>
                          {getDisplayName(u)}
                        </p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 flex-wrap">
                          <Mail className="w-3 h-3" />{u.email}
                          <span className="mx-1">·</span>
                          <BookOpen className="w-3 h-3" />{u.subject}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => approveMutation.mutate(u.id)}
                          disabled={approveMutation.isPending}
                          className="bg-green-600 hover:bg-green-700"
                          data-testid={`button-approve-${u.id}`}
                        >
                          {approveMutation.isPending ? (
                            <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                          ) : (
                            <UserCheck className="w-3.5 h-3.5 mr-1" />
                          )}
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => rejectMutation.mutate(u.id)}
                          disabled={rejectMutation.isPending}
                          className="text-red-600 border-red-200 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950/30"
                          data-testid={`button-reject-${u.id}`}
                        >
                          {rejectMutation.isPending ? (
                            <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                          ) : (
                            <UserX className="w-3.5 h-3.5 mr-1" />
                          )}
                          Reject
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Global Subject Management Section */}
          <Card className="border shadow-lg bg-gradient-to-br from-blue-50/50 to-white dark:from-blue-950/10 dark:to-gray-900">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h3 className="font-semibold flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-blue-600" />
                    Global Subject List
                  </h3>
                  <p className="text-xs text-muted-foreground">Manage the master list of subjects available for all teachers.</p>
                </div>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button size="sm" className="h-8 bg-blue-600 hover:bg-blue-700">
                      <Plus className="w-3.5 h-3.5 mr-1.5" />
                      Add New Subject
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-3">
                    <div className="space-y-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">System Subject</h4>
                      <Input 
                        placeholder="e.g. Robotics" 
                        className="h-8 text-xs"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            const val = e.currentTarget.value.trim();
                            if (val) {
                              addGlobalSubjectMutation.mutate(val);
                              e.currentTarget.value = "";
                            }
                          }
                        }}
                      />
                      <p className="text-[10px] text-muted-foreground italic">Press Enter to add to master list.</p>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                {globalSubjects.map((s) => (
                  <Badge 
                    key={s} 
                    variant="secondary" 
                    className="pl-3 pr-1 py-1 rounded-full group/tag bg-white dark:bg-gray-800 border border-blue-100 dark:border-blue-900 shadow-sm"
                  >
                    <span className="text-xs font-medium mr-2">{s}</span>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-5 w-5 rounded-full hover:bg-red-50 hover:text-red-500 transition-colors"
                      onClick={() => setSubjectToDelete(s)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </Badge>
                ))}
                {globalSubjects.length === 0 && (
                  <p className="text-xs text-muted-foreground italic py-2">No subjects defined in the master list.</p>
                )}
              </div>

              {/* Subject Delete Confirmation Dialog */}
              <AlertDialog open={!!subjectToDelete} onOpenChange={(v) => !v && setSubjectToDelete(null)}>
                <AlertDialogContent className="max-w-[400px] rounded-3xl border-gray-100 dark:border-gray-800">
                  <AlertDialogHeader>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 rounded-full bg-red-100 dark:bg-red-900/30">
                        <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
                      </div>
                      <AlertDialogTitle>Remove Subject?</AlertDialogTitle>
                    </div>
                    <AlertDialogDescription className="text-sm leading-relaxed">
                      Are you sure you want to remove <strong>"{subjectToDelete}"</strong> from the system? 
                      <br /><br />
                      This won't remove it from teachers already assigned, but it won't be available for new assignments.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="h-9 text-xs rounded-xl">Cancel</AlertDialogCancel>
                    <AlertDialogAction 
                      className="h-9 text-xs bg-red-600 hover:bg-red-700 text-white rounded-xl"
                      onClick={() => {
                        if (subjectToDelete) {
                          deleteGlobalSubjectMutation.mutate(subjectToDelete);
                          setSubjectToDelete(null);
                        }
                      }}
                    >
                      Remove Subject
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>

          <Card className="border shadow-lg">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold flex items-center gap-2">
                  <Users className="w-4 h-4" />
                Teacher Roles & Subjects
              </h3>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="text-xs h-8 border-amber-200 text-amber-700 hover:bg-amber-50"
                    disabled={cleanupMutation.isPending}
                  >
                    {cleanupMutation.isPending ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : <RotateCcw className="w-3 h-3 mr-2" />}
                    Cleanup Old Subjects
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="max-w-[400px]">
                  <AlertDialogHeader>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 rounded-full bg-amber-100 dark:bg-amber-900/30">
                        <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                      </div>
                      <AlertDialogTitle>Confirm System Cleanup</AlertDialogTitle>
                    </div>
                    <AlertDialogDescription className="text-sm leading-relaxed">
                      This will scan all teacher accounts and remove any subjects (like Art, Physics, etc.) 
                      that are not in the official engineering list. 
                      <br /><br />
                      <span className="font-bold text-gray-900 dark:text-gray-100">This action cannot be undone.</span>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="h-9 text-xs">Cancel</AlertDialogCancel>
                    <AlertDialogAction 
                      className="h-9 text-xs bg-amber-600 hover:bg-amber-700 text-white"
                      onClick={() => cleanupMutation.mutate()}
                    >
                      Confirm Cleanup
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

              {usersLoading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-16 rounded-xl" />
                  ))}
                </div>
              ) : allUsers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No users found</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {allUsers.map((u) => {
                    const userSubjects = [...new Set([
                      ...(u.subjects || []), 
                      ...(u.subject ? [u.subject] : [])
                    ])].filter(Boolean) as string[];
                    return (
                      <div
                        key={u.id}
                        className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group/row"
                        data-testid={`user-row-${u.id}`}
                      >
                        {/* Avatar */}
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shrink-0",
                          u.role === "admin"
                            ? "bg-gradient-to-br from-indigo-400 to-violet-500 text-white shadow-md shadow-indigo-500/20"
                            : u.role === "teacher"
                            ? "bg-gradient-to-br from-emerald-400 to-green-500 text-white shadow-md shadow-emerald-500/20"
                            : "bg-gradient-to-br from-gray-300 to-gray-400 text-white"
                        )}>
                          {getInitials(u)}
                        </div>

                        {/* Name + subjects preview */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-sm text-gray-900 dark:text-white truncate" data-testid={`text-user-name-${u.id}`}>
                              {getDisplayName(u)}
                            </p>
                            {/* Inline edit button */}
                            <button
                              onClick={() => setEditingUser(u)}
                              className="opacity-0 group-hover/row:opacity-100 transition-opacity flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60"
                              title="Edit teacher subjects"
                              data-testid={`button-edit-teacher-${u.id}`}
                            >
                              <Pencil className="w-2.5 h-2.5" />
                              Edit
                            </button>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <p className="text-xs text-gray-400 truncate">{u.email}</p>
                            {userSubjects.length > 0 && (
                              <>
                                <span className="text-gray-300 dark:text-gray-700">·</span>
                                <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                                  {userSubjects.length === 1
                                    ? userSubjects[0]
                                    : `${userSubjects[0]} +${userSubjects.length - 1} more`}
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Role selector */}
                        <Select
                          value={u.role}
                          onValueChange={(role) => {
                            if (u.id === user?.id && role !== "admin") {
                              toast({ title: "Warning", description: "You cannot remove your own admin role.", variant: "destructive" });
                              return;
                            }
                            updateRoleMutation.mutate({ userId: u.id, role });
                          }}
                        >
                          <SelectTrigger
                            className={cn("w-[130px] h-9 text-xs font-semibold border rounded-xl", ROLE_COLORS[u.role] || ROLE_COLORS.viewer)}
                            data-testid={`select-role-${u.id}`}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="teacher">Teacher</SelectItem>
                            <SelectItem value="viewer">Viewer</SelectItem>
                          </SelectContent>
                        </Select>

                        {/* Remove button */}
                        {u.id !== user?.id && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 shrink-0"
                                title="Remove teacher account"
                                disabled={deleteUserMutation.isPending}
                              >
                                {deleteUserMutation.isPending ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Trash2 className="w-4 h-4" />
                                )}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will permanently delete the teacher account for <strong>{getDisplayName(u)}</strong> ({u.email}).
                                  They will lose access to the system immediately.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-red-600 hover:bg-red-700 text-white"
                                  onClick={() => deleteUserMutation.mutate(u.id)}
                                >
                                  Delete Account
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Edit Teacher Dialog — rendered once, controlled by editingUser state */}
              {editingUser && (
                <EditTeacherDialog
                  open={!!editingUser}
                  onClose={() => setEditingUser(null)}
                  teacher={editingUser}
                  globalSubjects={globalSubjects}
                  subjectsLoading={subjectsLoading}
                  subjectsMutation={subjectsMutation}
                />
              )}
            </CardContent>
          </Card>

          <Card className="border">
            <CardContent className="p-6 space-y-3">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Role Permissions
              </h4>
              <div className="space-y-2.5">
                <div className="flex items-center gap-3">
                  <Badge className="bg-indigo-600 hover:bg-indigo-600 text-white text-xs w-[70px] justify-center">Admin</Badge>
                  <span className="text-sm text-muted-foreground">Full access — manage classes, students, settings</span>
                </div>
                <div className="flex items-center gap-3">
                  <Badge className="bg-green-600 hover:bg-green-600 text-white text-xs w-[70px] justify-center">Teacher</Badge>
                  <span className="text-sm text-muted-foreground">Can mark attendance and view reports</span>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="secondary" className="text-xs w-[70px] justify-center">Viewer</Badge>
                  <span className="text-sm text-muted-foreground">Read-only access to reports</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "policies" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-indigo-600" />
                Smart Attendance Policies
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Configure automated rules for attendance thresholds and late marking.
              </p>
            </div>
            <Button 
              variant="outline" 
              className="rounded-xl border-gray-200 dark:border-gray-800 font-bold text-xs uppercase tracking-wider h-10 px-5 gap-2 hover:bg-gray-50 dark:hover:bg-gray-900"
              onClick={() => {
                setTempPolicies(policies);
                setShowPolicyDialog(true);
              }}
            >
              <Pencil className="w-3.5 h-3.5" />
              Edit Policies
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Threshold Settings */}
            <Card className="border shadow-sm overflow-hidden">
              <CardHeader className="bg-gray-50/50 dark:bg-gray-900/40 border-b py-4">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-500" />
                  Attendance Thresholds
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-8">
                <div className="space-y-4">
                  <div className="flex justify-between items-end">
                    <div className="space-y-0.5">
                      <Label className="text-xs font-bold uppercase tracking-wider text-gray-500">Minimum Requirement</Label>
                      <p className="text-[11px] text-muted-foreground">Students below this are marked as "Defaulters".</p>
                    </div>
                    <span className="text-lg font-black text-indigo-600">{policies.minAttendance}%</span>
                  </div>
                  <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-indigo-500 rounded-full transition-all duration-500" 
                      style={{ width: `${policies.minAttendance}%` }}
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-end">
                    <div className="space-y-0.5">
                      <Label className="text-xs font-bold uppercase tracking-wider text-gray-500">Warning Threshold</Label>
                      <p className="text-[11px] text-muted-foreground">Triggers "At Risk" notifications to students.</p>
                    </div>
                    <span className="text-lg font-black text-amber-600">{policies.warningThreshold}%</span>
                  </div>
                  <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-amber-500 rounded-full transition-all duration-500" 
                      style={{ width: `${policies.warningThreshold}%` }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Late Rules */}
            <Card className="border shadow-sm overflow-hidden">
              <CardHeader className="bg-gray-50/50 dark:bg-gray-900/40 border-b py-4">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-500" />
                  Late-Marking Rules
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="flex items-center justify-between p-4 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/50">
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-blue-900 dark:text-blue-200">Grace Period</p>
                    <p className="text-[11px] text-blue-700 dark:text-blue-400">Marked as "Late" after this time.</p>
                  </div>
                  <Badge className="bg-blue-600 hover:bg-blue-600 font-bold">{policies.gracePeriod} Mins</Badge>
                </div>

                <div className="flex items-center justify-between p-4 rounded-xl bg-red-50/50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/50">
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-red-900 dark:text-red-200">Late Cutoff</p>
                    <p className="text-[11px] text-red-700 dark:text-red-400">Marked as "Absent" after this time.</p>
                  </div>
                  <Badge variant="destructive" className="font-bold">{policies.lateCutoff} Mins</Badge>
                </div>

                <div 
                  className="pt-2 flex items-center gap-3 cursor-pointer"
                  onClick={() => setPolicies(p => ({ ...p, autoLateEnabled: !p.autoLateEnabled }))}
                >
                  <div className={cn(
                    "w-10 h-6 rounded-full flex items-center px-1 transition-colors duration-200",
                    policies.autoLateEnabled ? "bg-indigo-600" : "bg-gray-200 dark:bg-gray-800"
                  )}>
                    <div className={cn(
                      "w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200",
                      policies.autoLateEnabled ? "translate-x-4" : "translate-x-0"
                    )} />
                  </div>
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Enable automatic late marking via Pi</span>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/50 flex items-start gap-3">
            <Info className="w-4 h-4 text-indigo-600 mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p className="text-xs font-bold text-indigo-900 dark:text-indigo-200">Automated Policy Enforcement</p>
              <p className="text-[11px] text-indigo-700 dark:text-indigo-400 leading-relaxed">
                These rules are applied in real-time when attendance is captured via the Raspberry Pi. 
                Manual overrides by teachers will still be logged in the audit trail.
              </p>
            </div>
          </div>

          {/* Policy Edit Dialog */}
          <Dialog open={showPolicyDialog} onOpenChange={setShowPolicyDialog}>
            <DialogContent className="sm:max-w-[450px] rounded-[32px] border-gray-100 dark:border-gray-800 overflow-hidden p-0">
              <DialogHeader className="p-8 pb-4">
                <DialogTitle className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">Edit Policies</DialogTitle>
                <DialogDescription className="text-gray-500 font-medium">
                  Adjust thresholds and late-marking rules for the entire system.
                </DialogDescription>
              </DialogHeader>

              <div className="p-8 pt-4 space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <Label className="text-xs font-bold uppercase tracking-wider text-gray-400">Min Attendance (%)</Label>
                      <span className="text-sm font-black text-indigo-600">{tempPolicies.minAttendance}%</span>
                    </div>
                    <Input 
                      type="range" min="0" max="100" 
                      value={tempPolicies.minAttendance} 
                      onChange={(e) => setTempPolicies({...tempPolicies, minAttendance: parseInt(e.target.value)})}
                      className="accent-indigo-600 cursor-pointer h-2"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <Label className="text-xs font-bold uppercase tracking-wider text-gray-400">Warning Threshold (%)</Label>
                      <span className="text-sm font-black text-amber-600">{tempPolicies.warningThreshold}%</span>
                    </div>
                    <Input 
                      type="range" min="0" max="100" 
                      value={tempPolicies.warningThreshold} 
                      onChange={(e) => setTempPolicies({...tempPolicies, warningThreshold: parseInt(e.target.value)})}
                      className="accent-amber-600 cursor-pointer h-2"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-gray-400">Grace (Mins)</Label>
                    <Input 
                      type="number" 
                      value={tempPolicies.gracePeriod} 
                      onChange={(e) => setTempPolicies({...tempPolicies, gracePeriod: parseInt(e.target.value)})}
                      className="h-12 rounded-xl border-gray-100 dark:border-gray-800 font-bold"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-gray-400">Cutoff (Mins)</Label>
                    <Input 
                      type="number" 
                      value={tempPolicies.lateCutoff} 
                      onChange={(e) => setTempPolicies({...tempPolicies, lateCutoff: parseInt(e.target.value)})}
                      className="h-12 rounded-xl border-gray-100 dark:border-gray-800 font-bold"
                    />
                  </div>
                </div>
              </div>

              <DialogFooter className="p-8 pt-0 gap-3">
                <Button variant="outline" className="flex-1 h-12 rounded-xl font-bold border-gray-100" onClick={() => setShowPolicyDialog(false)}>
                  Cancel
                </Button>
                <Button 
                  className="flex-1 h-12 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-500/20"
                  onClick={() => {
                    setPolicies(tempPolicies);
                    setShowPolicyDialog(false);
                    toast({ title: "Policies Updated", description: "Attendance rules have been saved successfully." });
                  }}
                >
                  Save Changes
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {activeTab === "holidays" && (
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Calendar className="w-5 h-5 text-indigo-600" />
              Indian Academic Calendar 2026
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              List of gazetted and public holidays for the current academic year.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {INDIAN_HOLIDAYS_2026.map((holiday, idx) => {
              const holidayDate = new Date(holiday.date);
              const isPast = holidayDate < new Date("2026-03-31");
              
              return (
                <Card 
                  key={idx} 
                  className={cn(
                    "border shadow-sm transition-all overflow-hidden",
                    isPast ? "opacity-50 grayscale bg-gray-50 dark:bg-gray-900/40" : "hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-800"
                  )}
                >
                  <CardContent className="p-0 flex">
                    <div className={cn(
                      "w-20 flex flex-col items-center justify-center text-center p-3 border-r",
                      isPast ? "bg-gray-100 dark:bg-gray-800" : "bg-indigo-50 dark:bg-indigo-950/30"
                    )}>
                      <span className={cn(
                        "text-[10px] font-bold uppercase tracking-widest",
                        isPast ? "text-gray-400" : "text-indigo-600 dark:text-indigo-400"
                      )}>
                        {format(holidayDate, "MMM")}
                      </span>
                      <span className={cn(
                        "text-2xl font-black leading-tight",
                        isPast ? "text-gray-500" : "text-gray-900 dark:text-white"
                      )}>
                        {format(holidayDate, "dd")}
                      </span>
                    </div>
                    <div className="flex-1 p-4 flex items-center justify-between gap-4">
                      <div>
                        <h4 className={cn(
                          "font-bold text-sm",
                          isPast ? "text-gray-500" : "text-gray-900 dark:text-white"
                        )}>
                          {holiday.name}
                        </h4>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-[9px] h-4 px-1.5 uppercase tracking-tighter border-gray-200 dark:border-gray-800">
                            {holiday.type}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground font-medium">
                            {format(holidayDate, "EEEE")}
                          </span>
                        </div>
                      </div>
                      {!isPast && (
                        <div className="w-8 h-8 rounded-full bg-green-50 dark:bg-green-950/30 flex items-center justify-center shrink-0">
                          <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/50 flex items-start gap-3">
            <Info className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p className="text-xs font-bold text-amber-900 dark:text-amber-200">Calendar Policy</p>
              <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-relaxed">
                Attendance marking is automatically disabled on gazetted holidays. Restricted holidays 
                must be manually approved by the department head if the institution remains closed.
              </p>
            </div>
          </div>
        </div>
      )}

      {activeTab === "audit" && (
        <Card className="border shadow-lg">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2">
                <History className="w-4 h-4" />
                Audit Logs
              </h3>
              <Badge variant="outline" className="text-xs">
                {auditLogs.length} events
              </Badge>
            </div>

            {auditLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-16 rounded-xl" />
                ))}
              </div>
            ) : auditLogs.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-xl border-gray-100 dark:border-gray-800">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p className="text-sm">No audit logs found yet.</p>
                <p className="text-xs opacity-60">Logs will appear here as actions are performed.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {auditLogs.map((log) => {
                  const isAttendance = log.action.includes("attendance");
                  const isRole = log.action.includes("role") || log.action.includes("user");
                  
                  return (
                    <div key={log.id} className="flex items-start gap-4 p-4 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-900/40 transition-colors group">
                      <div className="mt-1">
                        <Badge 
                          variant="secondary" 
                          className={cn(
                            "px-3 py-1 rounded-full text-[10px] font-bold border whitespace-nowrap",
                            isAttendance 
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800"
                              : isRole
                              ? "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-400 dark:border-indigo-800"
                              : "bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700"
                          )}
                        >
                          {log.action === "attendance_marked" || log.action === "bulk_attendance" ? "Attendance" : 
                           log.action === "role_change" ? "Role Change" :
                           log.action.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
                        </Badge>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 leading-snug">
                          {log.description}
                        </p>
                        <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground font-medium">
                          <span>{log.actorName}</span>
                          <span className="text-gray-300 dark:text-gray-700">•</span>
                          <span>{format(new Date(log.createdAt), "MMM d, yyyy • h:mm a")}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="mt-4 p-4 rounded-lg bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-800/50 flex items-start gap-3">
              <AlertCircle className="w-4 h-4 text-indigo-500 mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p className="text-xs font-medium text-indigo-900 dark:text-indigo-300">Security Note</p>
                <p className="text-[11px] text-indigo-700/70 dark:text-indigo-400/70 leading-relaxed">
                  Audit logs are immutable and stored permanently for compliance. They record all administrative
                  modifications, enrollment activities, and critical system events.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
