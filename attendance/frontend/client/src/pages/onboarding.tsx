import { useState } from "react";
import { useUser } from "@clerk/react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { BookOpen, GraduationCap, Loader2, User, ChevronRight } from "lucide-react";

export default function OnboardingPage() {
  const { user } = useUser();
  const [teacherName, setTeacherName] = useState(user?.fullName || "");
  const [subject, setSubject] = useState("");
  const [loading, setLoading] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: globalSubjects = [] } = useQuery<string[]>({
    queryKey: ["/api/admin/subjects"],
  });

  const handleSubmit = async () => {
    if (!subject || !teacherName.trim() || !user) return;
    setLoading(true);
    try {
      await apiRequest("POST", "/api/onboarding", { teacherName: teacherName.trim(), subject });
      await user.reload();
      toast({ title: "Profile submitted!", description: "Waiting for admin approval." });
      setLocation("/pending");
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-gradient-to-br from-slate-50 via-indigo-50/40 to-violet-50 dark:from-gray-950 dark:via-indigo-950/20 dark:to-gray-950">
      {/* Background orbs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-[20%] -left-[10%] w-[55%] h-[55%] rounded-full bg-gradient-to-br from-indigo-200/40 to-violet-200/30 blur-[80px] animate-float" />
        <div className="absolute -bottom-[20%] -right-[10%] w-[55%] h-[55%] rounded-full bg-gradient-to-tr from-violet-200/40 to-purple-200/30 blur-[80px] animate-float-slow" />
        <div className="absolute inset-0 opacity-[0.025]" style={{ backgroundImage: `radial-gradient(circle, #6366f1 1px, transparent 1px)`, backgroundSize: "32px 32px" }} />
      </div>

      <div className="w-full max-w-md relative z-10 animate-scale-in">
        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center">
              <span className="text-[10px] font-bold text-white">1</span>
            </div>
            <span className="text-xs font-semibold text-indigo-600">Setup Profile</span>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-300" />
          <div className="flex items-center gap-1.5 opacity-50">
            <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
              <span className="text-[10px] font-bold text-gray-500">2</span>
            </div>
            <span className="text-xs font-semibold text-gray-400">Await Approval</span>
          </div>
        </div>

        <div className="bg-white/85 dark:bg-gray-900/85 backdrop-blur-2xl rounded-[32px] border border-white/60 dark:border-white/10 shadow-2xl shadow-indigo-500/10 dark:shadow-black/40 p-8 space-y-7">
          {/* Header */}
          <div className="text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center mx-auto shadow-xl shadow-indigo-500/30">
              <GraduationCap className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight" data-testid="text-onboarding-title">
                Welcome, {user?.firstName || "Teacher"}!
              </h1>
              <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
                Complete your profile to get started
              </p>
            </div>
          </div>

          {/* Form */}
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                <User className="w-3.5 h-3.5" />Full Name
              </label>
              <Input
                placeholder="Enter your full name"
                value={teacherName}
                onChange={(e) => setTeacherName(e.target.value)}
                className="h-12 rounded-2xl border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 focus-visible:ring-indigo-500/30"
                data-testid="input-teacher-name"
              />
            </div>

            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                <BookOpen className="w-3.5 h-3.5" />Primary Subject
              </label>
              <Select value={subject} onValueChange={setSubject}>
                <SelectTrigger className="h-12 rounded-2xl border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 focus:ring-indigo-500/30" data-testid="select-subject">
                  <SelectValue placeholder="Select your subject" />
                </SelectTrigger>
                <SelectContent>
                  {globalSubjects.map((s) => (
                    <SelectItem key={s} value={s} data-testid={`option-subject-${s}`}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            onClick={handleSubmit}
            disabled={!subject || !teacherName.trim() || loading}
            className="w-full h-13 h-[52px] rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold text-base shadow-xl shadow-indigo-500/25 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed disabled:scale-100"
            data-testid="button-submit-onboarding"
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Submitting…</>
            ) : (
              "Complete Profile"
            )}
          </Button>

          <p className="text-center text-xs text-gray-400">
            Your account will need admin approval before you can access the dashboard.
          </p>
        </div>
      </div>
    </div>
  );
}
