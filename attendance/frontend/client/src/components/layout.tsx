import { useUser, UserButton, useClerk } from "@clerk/react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Users,
  UserCheck,
  Camera,
  FileText,
  ShieldCheck,
  CalendarDays,
  Bell,
  LogOut,
  Moon,
  Sun,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Zap,
  Clock,
  AlertTriangle,
  Info,
  Calendar as CalendarIcon,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState, useMemo, useEffect } from "react";
import { useTheme } from "@/lib/theme-provider";
import { format, addDays, isSameDay, parse, differenceInMinutes, startOfToday } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useDate } from "@/hooks/use-date";
import type { TimetableSlot } from "@shared/schema";

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

const teacherNav = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard },
  { path: "/timetable", label: "Timetable", icon: CalendarDays },
  { path: "/attendance", label: "Live Capture", icon: Camera },
  { path: "/enrollment", label: "Enrollment", icon: UserCheck },
  { path: "/students", label: "Students", icon: Users },
  { path: "/reports", label: "Reports", icon: FileText },
];

const adminNav = [
  { path: "/admin", label: "Admin Panel", icon: ShieldCheck },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user } = useUser();
  const { signOut } = useClerk();
  const [location] = useLocation();
  const { theme, setTheme } = useTheme();
  const { selectedDate, setSelectedDate, currentTime } = useDate();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const { data: globalSubjects = [], isLoading: isSubjectsLoading } = useQuery<string[]>({
    queryKey: ["/api/admin/subjects"],
  });

  const ADMIN_EMAILS = ["naeem542005@gmail.com", "yugankamble@gmail.com", "yugan777@gmail.com"];
  const email = user?.emailAddresses?.[0]?.emailAddress?.toLowerCase();
  const isAdmin = user?.publicMetadata?.role === "admin" || (email && ADMIN_EMAILS.includes(email));

  const teacherSubjects = (user?.publicMetadata as any)?.subjects as string[] | undefined;
  const primarySubject = (user?.publicMetadata as any)?.subject as string | undefined;

  const allSubjects = useMemo(() => {
    const raw = [...new Set([primarySubject, ...(teacherSubjects || [])])].filter(Boolean) as string[];
    
    // If globalSubjects is loaded, filter against it. Otherwise return raw (until loaded).
    if (!isSubjectsLoading && globalSubjects.length > 0) {
      return raw.filter(s =>
        globalSubjects.some(g => g.toLowerCase() === s.toLowerCase())
      );
    }
    return raw;
  }, [primarySubject, teacherSubjects, globalSubjects, isSubjectsLoading]);

  const role = isAdmin ? "admin" : "teacher";
  const navItems = isAdmin ? [...teacherNav, ...adminNav] : teacherNav;
  const teacherName = (user?.publicMetadata?.teacherName as string) || user?.fullName || "User";

  // --- Notification Logic ---
  const { data: timetable = [] } = useQuery<TimetableSlot[]>({
    queryKey: ["/api/timetable"],
    enabled: !!user?.id,
  });

  const { data: defaulters = [] } = useQuery<any[]>({
    queryKey: ["/api/reports/defaulters"],
    enabled: !!user?.id,
  });

  const notifications = useMemo(() => {
    const list: { id: string; title: string; description: string; time: string; type: "lecture" | "attendance" | "holiday" | "system"; icon: any; color: string }[] = [];
    const now = currentTime;
    const today = startOfToday();

    // 1. Upcoming Lecture
    const dayOfWeek = now.getDay(); // 0 is Sunday, 1 is Monday
    const todaySlots = timetable.filter(s => s.dayOfWeek === dayOfWeek);
    
    const nextSlot = todaySlots
      .map(slot => {
        if (!slot.startTime) return null;
        try {
          const [time, period] = slot.startTime.split(" ");
          const [hours, minutes] = time.split(":").map(Number);
          let h = hours;
          if (period === "PM" && h !== 12) h += 12;
          if (period === "AM" && h === 12) h = 0;
          
          const slotTime = new Date(now);
          slotTime.setHours(h, minutes, 0, 0);
          
          const diff = differenceInMinutes(slotTime, now);
          return { ...slot, diff, slotTime };
        } catch (e) { return null; }
      })
      .filter((s): s is any => s !== null && s.diff > 0 && s.diff <= 60)
      .sort((a, b) => a.diff - b.diff)[0];

    if (nextSlot) {
      list.push({
        id: `lecture-${nextSlot.id}`,
        title: "Upcoming Lecture",
        description: `${nextSlot.subject} for ${nextSlot.section} starts in ${nextSlot.diff} mins.`,
        time: nextSlot.startTime || "",
        type: "lecture",
        icon: Clock,
        color: "text-blue-600 bg-blue-50 dark:bg-blue-950/30",
      });
    }

    // 2. Defaulter Alert
    if (defaulters.length > 0) {
      const topDefaulter = defaulters[0];
      list.push({
        id: "defaulter-alert",
        title: "Attendance Alert",
        description: `${topDefaulter.name} (${topDefaulter.section}) is below 75% attendance.`,
        time: "Action Required",
        type: "attendance",
        icon: AlertTriangle,
        color: "text-amber-600 bg-amber-50 dark:bg-amber-950/30",
      });
    }

    // 3. Upcoming Holiday
    const upcomingHoliday = INDIAN_HOLIDAYS_2026.find(h => {
      const hDate = new Date(h.date);
      const diff = differenceInMinutes(hDate, today) / (60 * 24);
      return diff >= 0 && diff <= 3;
    });

    if (upcomingHoliday) {
      list.push({
        id: `holiday-${upcomingHoliday.date}`,
        title: "Upcoming Holiday",
        description: `${upcomingHoliday.name} is on ${format(new Date(upcomingHoliday.date), "EEEE")}.`,
        time: format(new Date(upcomingHoliday.date), "MMM dd"),
        type: "holiday",
        icon: CalendarIcon,
        color: "text-indigo-600 bg-indigo-50 dark:bg-indigo-950/30",
      });
    }

    // 4. System Status (Mocked)
    list.push({
      id: "system-status",
      title: "System Online",
      description: "Raspberry Pi is connected and ready for capture.",
      time: "Live",
      type: "system",
      icon: CheckCircle2,
      color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30",
    });

    return list;
  }, [timetable, defaulters, currentTime]);

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  return (
    <div className="flex min-h-screen bg-background font-sans">
      {/* ── Desktop Sidebar ── */}
      <aside
        className={cn(
          "hidden lg:flex flex-col bg-white dark:bg-gray-900/95 border-r border-gray-100 dark:border-gray-800/80",
          "py-5 sticky top-0 h-screen transition-[width] duration-300 ease-out overflow-hidden",
          sidebarCollapsed ? "w-[72px]" : "w-[240px]"
        )}
      >
        {/* Brand */}
        <div className={cn("flex items-center px-4 mb-6", sidebarCollapsed ? "justify-center" : "justify-between")}>
          <button
            onClick={() => window.location.href = "/"}
            className={cn(
              "flex items-center gap-3 group cursor-pointer",
              sidebarCollapsed && "justify-center"
            )}
            title="AttendanceIQ Home"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/30 flex-shrink-0 group-hover:scale-105 transition-transform duration-200">
              <Sparkles className="w-4.5 h-4.5 text-white w-[18px] h-[18px]" />
            </div>
            {!sidebarCollapsed && (
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-bold text-gray-900 dark:text-white tracking-tight leading-tight">AttendanceIQ</span>
                <span className="text-[10px] text-gray-400 font-medium tracking-wider uppercase">v1</span>
              </div>
            )}
          </button>
          {!sidebarCollapsed && (
            <button
              onClick={() => setSidebarCollapsed(true)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/60 transition-all"
              title="Collapse sidebar"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Collapse expand button when collapsed */}
        {sidebarCollapsed && (
          <button
            onClick={() => setSidebarCollapsed(false)}
            className="mx-auto mb-4 p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all"
            title="Expand sidebar"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        )}

        {/* Navigation */}
        <nav className={cn("flex flex-col gap-1 flex-1 px-3")}>
          {!sidebarCollapsed && (
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-2 mb-2">Menu</p>
          )}
          {navItems.map((item) => {
            const isActive = location === item.path;
            return (
              <Link key={item.path} href={item.path}>
                <button
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative",
                    sidebarCollapsed ? "justify-center" : "justify-start",
                    isActive
                      ? "bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 shadow-sm"
                      : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800/60"
                  )}
                  title={sidebarCollapsed ? item.label : undefined}
                >
                  {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-indigo-600 dark:bg-indigo-400 rounded-r-full" />
                  )}
                  <item.icon className={cn(
                    "flex-shrink-0 transition-transform duration-200 group-hover:scale-110",
                    "w-4.5 h-4.5 w-[18px] h-[18px]",
                    isActive ? "text-indigo-600 dark:text-indigo-400" : ""
                  )} />
                  {!sidebarCollapsed && (
                    <span className={cn(
                      "text-sm font-medium transition-opacity duration-200 whitespace-nowrap",
                      isActive ? "font-semibold" : ""
                    )}>
                      {item.label}
                    </span>
                  )}
                </button>
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className={cn(
          "mt-auto border-t border-gray-100 dark:border-gray-800/80 pt-4 px-3 flex flex-col gap-2",
        )}>
          {/* Subjects (only when expanded) */}
          {!sidebarCollapsed && allSubjects.length > 0 && (
            <div className="px-2 mb-2 space-y-2">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">My Subjects</p>
              <div className="flex flex-wrap gap-1">
                {allSubjects.map((s) => (
                  <Badge key={s} variant="secondary" className="text-[9px] px-1.5 py-0.5 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border-0 font-medium">
                    {s}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* User info row */}
          {!sidebarCollapsed ? (
            <div className="flex items-center gap-2.5 px-2 py-2 rounded-xl bg-gray-50 dark:bg-gray-800/50">
              <UserButton
                appearance={{
                  elements: { avatarBox: "w-7 h-7 rounded-lg" },
                }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-900 dark:text-gray-100 truncate">{teacherName}</p>
                <p className="text-[10px] text-gray-400 capitalize">{role}</p>
              </div>
              <button
                onClick={() => signOut()}
                className="p-1 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all"
                title="Sign Out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <UserButton appearance={{ elements: { avatarBox: "w-8 h-8 rounded-xl" } }} />
              <button
                onClick={() => signOut()}
                className="p-2 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ── Main Content ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* ── Top Header ── */}
        <header className="h-16 bg-white/80 dark:bg-gray-950/80 backdrop-blur-md px-6 lg:px-8 flex items-center justify-between sticky top-0 z-40 border-b border-gray-100/80 dark:border-gray-800/80">
          {/* Left: Date picker */}
          <div className="flex items-center gap-6">
            <div className="flex flex-col">
              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Date</span>
              <Popover>
                <PopoverTrigger asChild>
                  <button className="flex items-center gap-1.5 hover:bg-gray-50 dark:hover:bg-gray-800/60 px-1.5 py-0.5 -mx-1.5 rounded-lg transition-colors group">
                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{format(selectedDate, "MMM d, yyyy")}</span>
                    <CalendarDays className="w-3.5 h-3.5 text-gray-400 group-hover:text-indigo-500 transition-colors" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => date && setSelectedDate(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="hidden sm:flex flex-col">
              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Shift</span>
              <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">9:00 AM – 5:00 PM</span>
            </div>

            {/* Live clock */}
            <div className="hidden md:flex flex-col">
              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Time</span>
              <span className="text-sm font-mono font-semibold text-gray-900 dark:text-gray-100 tabular-nums">
                {format(currentTime, "h:mm:ss a")}
              </span>
            </div>
          </div>

          {/* Right: actions */}
          <div className="flex items-center gap-2">
            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-800 dark:hover:text-gray-200 transition-all"
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Notifications */}
            <Popover>
              <PopoverTrigger asChild>
                <button className="relative p-2 rounded-xl bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-800 dark:hover:text-gray-200 transition-all">
                  <Bell className="w-4 h-4" />
                  {notifications.length > 0 && (
                    <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-red-500 rounded-full ring-1 ring-white dark:ring-gray-900" />
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0 rounded-3xl border-gray-100 dark:border-gray-800 overflow-hidden shadow-2xl" align="end" sideOffset={8}>
                <div className="bg-gray-50/50 dark:bg-gray-900/50 p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <Bell className="w-3.5 h-3.5 text-indigo-600" />
                    Notifications
                  </h3>
                  <Badge variant="secondary" className="text-[10px] px-2 py-0 h-5 bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 border-0">
                    {notifications.length} New
                  </Badge>
                </div>
                <div className="max-h-[400px] overflow-y-auto scrollbar-thin">
                  {notifications.length === 0 ? (
                    <div className="py-12 text-center">
                      <div className="w-12 h-12 rounded-2xl bg-gray-50 dark:bg-gray-800 flex items-center justify-center mx-auto mb-3">
                        <CheckCircle2 className="w-6 h-6 text-gray-300" />
                      </div>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">All caught up!</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-50 dark:divide-gray-800/50">
                      {notifications.map((n) => (
                        <div key={n.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-900/40 transition-colors group cursor-default">
                          <div className="flex gap-3">
                            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", n.color)}>
                              <n.icon className="w-5 h-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2 mb-0.5">
                                <p className="text-xs font-bold text-gray-900 dark:text-white truncate">{n.title}</p>
                                <span className="text-[9px] font-bold text-gray-400 uppercase whitespace-nowrap">{n.time}</span>
                              </div>
                              <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-snug">
                                {n.description}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {notifications.length > 0 && (
                  <div className="p-3 bg-gray-50/30 dark:bg-gray-900/30 border-t border-gray-100 dark:border-gray-800">
                    <Button variant="ghost" className="w-full h-9 rounded-xl text-[10px] font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30">
                      Mark all as read
                    </Button>
                  </div>
                )}
              </PopoverContent>
            </Popover>

            {/* Role badge + user */}
            <div className="flex items-center gap-2.5 pl-3 border-l border-gray-100 dark:border-gray-800 ml-1">
              <span className={cn(
                "hidden sm:inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                isAdmin
                  ? "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400"
                  : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
              )}>
                {role}
              </span>
              <UserButton
                appearance={{
                  elements: {
                    avatarBox: "w-8 h-8 rounded-xl ring-2 ring-indigo-100 dark:ring-indigo-900/40",
                  },
                }}
              />
            </div>
          </div>
        </header>

        {/* ── Page Content ── */}
        <main className="flex-1 p-6 lg:p-8 xl:p-10 overflow-y-auto scrollbar-thin">
          <div className="animate-fade-up max-w-[1400px] mx-auto">
            {children}
          </div>
        </main>
      </div>

      {/* ── Mobile Bottom Nav ── */}
      <div className="lg:hidden fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
        <div className="flex items-center gap-1 bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl border border-gray-200/80 dark:border-gray-700/80 rounded-2xl px-3 py-2 shadow-xl shadow-black/10">
          {navItems.map((item) => {
            const isActive = location === item.path;
            return (
              <Link key={item.path} href={item.path}>
                <button
                  className={cn(
                    "p-2.5 rounded-xl transition-all duration-200",
                    isActive
                      ? "bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400"
                      : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/60"
                  )}
                >
                  <item.icon className="w-5 h-5" />
                </button>
              </Link>
            );
          })}
          <div className="w-px h-5 bg-gray-200 dark:bg-gray-700 mx-1" />
          <div className="p-1">
            <UserButton appearance={{ elements: { avatarBox: "w-7 h-7 rounded-lg" } }} />
          </div>
        </div>
      </div>
    </div>
  );
}
