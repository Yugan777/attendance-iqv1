import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Users, CheckCircle2, Clock, XCircle, TrendingUp, BarChart3, PieChart as PieChartIcon, Activity, Filter, CalendarDays
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, Legend
} from "recharts";
import { cn, formatSection } from "@/lib/utils";

interface AnalyticsData {
  summary: { 
    totalStudents: number; 
    presentToday: number; 
    lateToday: number; 
    absentToday: number;
    todaysClasses: number;
    activeSession: string;
  };
  weekly: { day: string; present: number; late: number; absent: number }[];
  distribution: { name: string; value: number; color: string }[];
  trends: { day: number; rate: number }[];
}

const SECTIONS = ["All", "FY-IT", "SE-IT", "TE-IT", "BE-IT"];

export default function DashboardPage() {
  const [selectedSection, setSelectedSection] = useState("All");

  const { data, isLoading, error } = useQuery<AnalyticsData>({
    queryKey: ["/api/analytics/dashboard", selectedSection],
    queryFn: async () => {
      const url = selectedSection === "All" 
        ? "/api/analytics/dashboard" 
        : `/api/analytics/dashboard?section=${encodeURIComponent(selectedSection)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch analytics");
      return res.json();
    }
  });

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-red-50 dark:bg-red-950/30 flex items-center justify-center">
          <XCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
        </div>
        <div className="text-center">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Failed to load dashboard</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">{(error as Error).message}</p>
        </div>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="space-y-8 animate-pulse">
        <div className="space-y-2">
          <Skeleton className="h-10 w-48 bg-gray-200 dark:bg-gray-800" />
          <Skeleton className="h-4 w-64 bg-gray-200 dark:bg-gray-800" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-3xl bg-gray-200 dark:bg-gray-800" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-[400px] rounded-3xl lg:col-span-2 bg-gray-200 dark:bg-gray-800" />
          <Skeleton className="h-[400px] rounded-3xl bg-gray-200 dark:bg-gray-800" />
        </div>
        <Skeleton className="h-[300px] rounded-3xl bg-gray-200 dark:bg-gray-800" />
      </div>
    );
  }

  const summaryCards = [
    { title: "Total Students", value: data.summary.totalStudents, icon: Users, color: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-600/5" },
    { title: "Today's Classes", value: data.summary.todaysClasses, icon: CalendarDays, color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-600/5" },
    { title: "Active Session", value: data.summary.activeSession, icon: Clock, color: "bg-amber-500/10 text-amber-600 dark:text-amber-400", bg: "bg-amber-600/5" },
    { title: "Present Today", value: data.summary.presentToday, icon: CheckCircle2, color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-600/5" },
    { title: "Late Today", value: data.summary.lateToday, icon: Clock, color: "bg-amber-500/10 text-amber-600 dark:text-amber-400", bg: "bg-amber-600/5" },
    { title: "Absent Today", value: data.summary.absentToday, icon: XCircle, color: "bg-rose-500/10 text-rose-600 dark:text-rose-400", bg: "bg-rose-600/5" },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-[0.2em] mb-1">Overview</p>
          <h1 className="text-4xl font-black tracking-tight text-gray-900 dark:text-white">Dashboard</h1>
          <p className="text-gray-500 dark:text-gray-400 font-medium">Real-time attendance overview and analytics</p>
        </div>

        <div className="flex items-center gap-3 bg-gray-50/50 dark:bg-gray-800/50 p-2 rounded-2xl border border-gray-100/50 dark:border-gray-700/50 shadow-sm min-w-[220px]">
          <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center shrink-0">
            <Filter className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <Select value={selectedSection} onValueChange={setSelectedSection}>
            <SelectTrigger className="border-none shadow-none focus:ring-0 h-8 text-sm font-bold p-0 pr-2 !bg-transparent !bg-none ring-0 focus-visible:ring-0">
              <SelectValue placeholder="Select Class" />
            </SelectTrigger>
            <SelectContent className="rounded-2xl border-gray-100 dark:border-gray-800 shadow-xl">
              {SECTIONS.map((s) => (
                <SelectItem key={s} value={s} className="rounded-xl py-2.5 font-medium">
                  {s === "All" ? "All Classes" : formatSection(s)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {summaryCards.map((card, i) => (
          <Card key={i} className={cn("rounded-[32px] border-none shadow-sm overflow-hidden", card.bg)}>
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">{card.title}</p>
                <p className="text-4xl font-black text-gray-900 dark:text-white leading-tight">{card.value}</p>
              </div>
              <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg shadow-black/5", card.color)}>
                <card.icon className="w-7 h-7" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Weekly Chart */}
        <Card className="rounded-[32px] border-gray-100 dark:border-gray-800 lg:col-span-2 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-indigo-600" />
              Weekly Attendance
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[350px] pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.weekly}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 600, fill: "#94a3b8" }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 600, fill: "#94a3b8" }} />
                <Tooltip
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="present" fill="#22c55e" radius={[4, 4, 0, 0]} barSize={24} />
                <Bar dataKey="late" fill="#eab308" radius={[4, 4, 0, 0]} barSize={24} />
                <Bar dataKey="absent" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Distribution Chart */}
        <Card className="rounded-[32px] border-gray-100 dark:border-gray-800 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <PieChartIcon className="w-5 h-5 text-violet-600" />
              Today's Distribution
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[350px] flex flex-col items-center justify-center relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.distribution}
                  innerRadius={80}
                  outerRadius={110}
                  paddingAngle={8}
                  dataKey="value"
                >
                  {data.distribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                  ))}
                </Pie>
                <Tooltip />
                <Legend iconType="circle" verticalAlign="bottom" wrapperStyle={{ paddingTop: '20px', fontSize: '12px', fontWeight: 600 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-[-20px]">
              <span className="text-3xl font-black text-gray-900 dark:text-white">
                {data.summary.presentToday + data.summary.lateToday + data.summary.absentToday > 0 
                  ? Math.round((data.summary.presentToday / (data.summary.presentToday + data.summary.lateToday + data.summary.absentToday)) * 100) 
                  : 0}%
              </span>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Attendance</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 30-Day Trend Chart */}
      <Card className="rounded-[32px] border-gray-100 dark:border-gray-800 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <Activity className="w-5 h-5 text-indigo-600" />
            30-Day Attendance Rate
          </CardTitle>
          <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold text-xs bg-emerald-50 dark:bg-emerald-950/30 px-3 py-1.5 rounded-full">
            <TrendingUp className="w-3.5 h-3.5" />
            93.2% avg
          </div>
        </CardHeader>
        <CardContent className="h-[300px] pt-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.trends}>
              <defs>
                <linearGradient id="colorRate" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 600, fill: "#94a3b8" }} dy={10} />
              <YAxis domain={[80, 100]} axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 600, fill: "#94a3b8" }} />
              <Tooltip
                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
              />
              <Area type="monotone" dataKey="rate" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorRate)" />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
