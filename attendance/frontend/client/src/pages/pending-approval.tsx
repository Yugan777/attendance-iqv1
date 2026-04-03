import { useUser, useClerk } from "@clerk/react";
import { Button } from "@/components/ui/button";
import { Clock, LogOut, RefreshCw, ChevronRight } from "lucide-react";
import { useState } from "react";

export default function PendingApprovalPage() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await user?.reload();
    setRefreshing(false);
    if (user?.publicMetadata?.status === "approved") {
      window.location.href = "/";
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-gradient-to-br from-amber-50 via-orange-50/50 to-slate-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      {/* Background orbs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-[20%] left-[10%] w-[50%] h-[50%] rounded-full bg-gradient-to-br from-amber-200/40 to-orange-200/30 blur-[80px] animate-float" />
        <div className="absolute -bottom-[20%] right-[10%] w-[50%] h-[50%] rounded-full bg-gradient-to-tr from-orange-200/40 to-amber-200/30 blur-[80px] animate-float-slow" />
        <div className="absolute inset-0 opacity-[0.025]" style={{ backgroundImage: `radial-gradient(circle, #f59e0b 1px, transparent 1px)`, backgroundSize: "32px 32px" }} />
      </div>

      <div className="w-full max-w-md relative z-10 animate-scale-in">
        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="flex items-center gap-1.5 opacity-50">
            <div className="w-6 h-6 rounded-full bg-gray-400 flex items-center justify-center">
              <span className="text-[10px] font-bold text-white">1</span>
            </div>
            <span className="text-xs font-semibold text-gray-400">Profile Done</span>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-300" />
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center">
              <span className="text-[10px] font-bold text-white">2</span>
            </div>
            <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">Awaiting Approval</span>
          </div>
        </div>

        <div className="bg-white/85 dark:bg-gray-900/85 backdrop-blur-2xl rounded-[32px] border border-white/60 dark:border-white/10 shadow-2xl shadow-amber-500/10 dark:shadow-black/40 p-8 text-center space-y-6">
          {/* Animated clock icon */}
          <div className="relative inline-block">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mx-auto shadow-xl shadow-amber-500/30">
              <Clock className="w-10 h-10 text-white" />
            </div>
            {/* Pulse ring */}
            <div className="absolute -inset-2 rounded-3xl bg-amber-400/20 animate-ping" />
          </div>

          <div className="space-y-2.5">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight" data-testid="text-pending-title">
              Awaiting Approval
            </h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">
              Your account is pending admin approval. You'll get full access once the principal reviews your registration.
            </p>
          </div>

          {/* Status info card */}
          <div className="bg-amber-50 dark:bg-amber-950/30 rounded-2xl p-4 border border-amber-200 dark:border-amber-800/60 text-left space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">Subject</span>
              <span className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                {(user?.publicMetadata?.subject as string) || "Not set"}
              </span>
            </div>
            <div className="h-px bg-amber-200 dark:bg-amber-800/40" />
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">Status</span>
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-900 dark:text-amber-200">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                Pending Review
              </span>
            </div>
          </div>

          {/* Animated waiting dots */}
          <div className="flex justify-center gap-1.5">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-2 h-2 rounded-full bg-amber-400 animate-bounce-dot"
                style={{ animationDelay: `${i * 160}ms` }}
              />
            ))}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex-1 h-12 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-semibold shadow-lg shadow-amber-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
              data-testid="button-refresh-status"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
              Check Status
            </Button>
            <Button
              variant="outline"
              onClick={() => signOut()}
              className="h-12 px-4 rounded-2xl border-gray-200 dark:border-gray-700 text-gray-500 hover:text-red-500 hover:border-red-200 dark:hover:border-red-800/60 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all"
              data-testid="button-signout"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
