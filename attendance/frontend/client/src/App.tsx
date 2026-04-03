import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Show, SignInButton, SignUpButton, SignedIn, SignedOut, UserButton, useUser } from "@clerk/react";
import { ShieldCheck, Sparkles } from "lucide-react";
import { useEffect } from "react";
import NotFound from "@/pages/not-found";
import OnboardingPage from "@/pages/onboarding";
import PendingApprovalPage from "@/pages/pending-approval";
import TimetablePage from "@/pages/timetable";
import AttendancePage from "@/pages/attendance";
import EnrollmentPage from "@/pages/enrollment";
import ReportsPage from "@/pages/reports";
import StudentsPage from "@/pages/students";
import AdminPage from "@/pages/admin";
import DashboardPage from "@/pages/dashboard";
import AppLayout from "@/components/layout";
import { ThemeProvider } from "@/lib/theme-provider";
import { DateProvider } from "@/hooks/use-date";

function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, isLoaded } = useUser();

  const metadata = user?.publicMetadata as Record<string, any> | undefined;
  const email = user?.emailAddresses?.[0]?.emailAddress?.toLowerCase();
  const ADMIN_EMAILS = ["naeem542005@gmail.com", "yugankamble@gmail.com", "yugan777@gmail.com"];

  const isAdmin = metadata?.role === "admin" || (email && ADMIN_EMAILS.includes(email));
  const status = metadata?.status;
  const hasCompletedOnboarding = !!metadata?.subject;

  useEffect(() => {
    if (isLoaded && user && email && ADMIN_EMAILS.includes(email) && metadata?.role !== "admin") {
      fetch("/api/health")
        .then(() => user.reload())
        .catch(() => {});
    } else if (isLoaded && user) {
      fetch("/api/health").catch(() => {});
    }
  }, [isLoaded, user, email, metadata]);

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-violet-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center animate-pulse-ring shadow-xl shadow-indigo-500/30">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Loading AttendanceIQ…</p>
        </div>
      </div>
    );
  }

  if (isAdmin || status === "approved") {
    return <>{children}</>;
  }

  if (!hasCompletedOnboarding) {
    return <OnboardingPage />;
  }

  if (status === "pending") {
    return <PendingApprovalPage />;
  }

  if (status === "rejected") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 via-white to-rose-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 p-4">
        <div className="w-full max-w-sm animate-scale-in">
          <div className="bg-white dark:bg-gray-900 rounded-3xl border border-red-100 dark:border-red-900/30 shadow-xl shadow-red-500/10 p-10 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-red-500/30">
              <span className="text-white text-2xl font-bold">✕</span>
            </div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Access Denied</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
              Your registration has been rejected by the administrator. Please contact the school office for more information.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (status !== "approved") {
    return <PendingApprovalPage />;
  }

  return <>{children}</>;
}

function AuthenticatedRouter() {
  return (
    <AuthGate>
      <DateProvider>
        <AppLayout>
          <Switch>
            <Route path="/" component={DashboardPage} />
            <Route path="/timetable" component={TimetablePage} />
            <Route path="/attendance" component={AttendancePage} />
            <Route path="/enrollment" component={EnrollmentPage} />
            <Route path="/students" component={StudentsPage} />
            <Route path="/reports" component={ReportsPage} />
            <Route path="/admin" component={AdminPage} />
            <Route component={NotFound} />
          </Switch>
        </AppLayout>
      </DateProvider>
    </AuthGate>
  );
}

function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-gradient-to-br from-slate-50 via-indigo-50/40 to-violet-50 dark:from-gray-950 dark:via-indigo-950/20 dark:to-gray-950">

      {/* Animated background orbs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-[20%] -left-[10%] w-[60%] h-[60%] rounded-full bg-gradient-to-br from-indigo-200/40 to-violet-200/30 blur-[80px] animate-float" />
        <div className="absolute -bottom-[20%] -right-[10%] w-[60%] h-[60%] rounded-full bg-gradient-to-tr from-violet-200/40 to-purple-200/30 blur-[80px] animate-float-slow" />
        <div className="absolute top-[40%] left-[50%] w-[40%] h-[40%] rounded-full bg-gradient-to-bl from-blue-200/30 to-indigo-200/20 blur-[60px] animate-float-fast" />
        {/* Subtle dot grid */}
        <div className="absolute inset-0 opacity-[0.025]" style={{
          backgroundImage: `radial-gradient(circle, #6366f1 1px, transparent 1px)`,
          backgroundSize: "32px 32px"
        }} />
      </div>

      {/* Sign-in card */}
      <div className="w-full max-w-[420px] relative z-10 animate-scale-in">
        <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-2xl rounded-[32px] shadow-2xl shadow-indigo-500/10 dark:shadow-black/40 border border-white/60 dark:border-white/10 p-10 space-y-8">

          {/* Logo + branding */}
          <div className="text-center space-y-5">
            <div className="relative inline-block">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center mx-auto shadow-2xl shadow-indigo-500/40 animate-pulse-ring">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
              {/* Glow ring */}
              <div className="absolute inset-0 w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br from-indigo-500 to-violet-600 opacity-30 blur-xl scale-110" />
            </div>
            <div className="space-y-1.5">
              <h1 className="text-4xl font-black tracking-tight text-gray-900 dark:text-white" data-testid="text-signin-title">
                AttendanceIQ
              </h1>
              <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">
                Smart Attendance Management System
              </p>
            </div>
          </div>

          {/* Auth buttons */}
          <div className="space-y-3">
            <SignInButton mode="modal">
              <button
                className="w-full h-14 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-base shadow-xl shadow-indigo-500/25 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] hover:shadow-indigo-500/35"
                data-testid="button-signin"
              >
                Sign In
              </button>
            </SignInButton>

            <SignUpButton mode="modal">
              <button
                className="w-full h-14 rounded-2xl bg-gray-50 dark:bg-gray-800/80 hover:bg-gray-100 dark:hover:bg-gray-700/80 text-gray-900 dark:text-white font-bold text-base border border-gray-100 dark:border-gray-700/80 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                data-testid="button-signup"
              >
                Create Account
              </button>
            </SignUpButton>

            {/* Divider */}
            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-100 dark:border-gray-800" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-white dark:bg-gray-900 px-4 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                  Administration
                </span>
              </div>
            </div>

            <SignInButton mode="modal">
              <button
                className="w-full h-14 rounded-2xl border border-amber-200 dark:border-amber-800/60 text-amber-700 dark:text-amber-400 font-bold text-base hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2.5"
                data-testid="button-admin-login"
              >
                <ShieldCheck className="w-5 h-5" />
                Admin Portal
              </button>
            </SignInButton>
          </div>

          {/* Footer note */}
          <p className="text-center text-[10px] font-semibold text-gray-300 dark:text-gray-600 uppercase tracking-widest">
            Secured by Clerk Authentication
          </p>
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="attendance-theme-v1">
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Show when="signed-out">
            <SignInPage />
          </Show>
          <Show when="signed-in">
            <AuthenticatedRouter />
          </Show>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
