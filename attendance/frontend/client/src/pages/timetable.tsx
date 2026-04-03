import { useState } from "react";
import { useUser } from "@clerk/react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useActivePeriod } from "@/hooks/use-active-period";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Switch } from "@/components/ui/switch";
import { cn, formatSection } from "@/lib/utils";
import {
  CalendarDays, Clock, MapPin, Zap, Pencil, Plus, Trash2, Loader2,
  RotateCcw, Check, X, BookOpen, ArrowRight,
} from "lucide-react";
import type { TimetableSlot } from "@shared/schema";
import { Link } from "wouter";
import { useDate } from "@/hooks/use-date";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const DAYS_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri"];

const DEFAULT_PERIOD_TIMES = [
  { start: "08:00", end: "08:45" },
  { start: "08:45", end: "09:30" },
  { start: "09:45", end: "10:30" },
  { start: "10:30", end: "11:15" },
  { start: "11:30", end: "12:15" },
  { start: "12:15", end: "13:00" },
  { start: "14:00", end: "14:45" },
  { start: "14:45", end: "15:30" },
];

const PERIODS = Array.from({ length: 8 }, (_, i) => i);
const TIMETABLE_SECTIONS = ["FY-IT", "SE-IT", "TE-IT", "BE-IT"];

interface SlotForm {
  id?: string;
  dayOfWeek: number;
  period: number;
  subject: string;
  section: string;
  room: string;
  startTime: string;
  endTime: string;
}

const defaultForm = (day = 0, period = 0): SlotForm => ({
  dayOfWeek: day,
  period,
  subject: "",
  section: "",
  room: "",
  startTime: DEFAULT_PERIOD_TIMES[period]?.start ?? "",
  endTime: DEFAULT_PERIOD_TIMES[period]?.end ?? "",
});

// Section color helpers
const sectionColors: Record<string, string> = {
  "FY-IT": "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800/60",
  "SE-IT": "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800/60",
  "TE-IT": "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400 border-violet-200 dark:border-violet-800/60",
  "BE-IT": "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/60",
};

const getSectionColor = (section: string) => {
  for (const [key, val] of Object.entries(sectionColors)) {
    if (section.startsWith(key)) return val;
  }
  return "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 border-gray-200 dark:border-gray-700";
};

export default function TimetablePage() {
  const { user } = useUser();
  const { selectedDate } = useDate();
  const { activePeriod, activeDay, periodTimes } = useActivePeriod(selectedDate);
  const { toast } = useToast();

  const [editMode, setEditMode] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [useCustomTime, setUseCustomTime] = useState(false);
  const [form, setForm] = useState<SlotForm>(defaultForm());

  const { data: globalSubjects = [] } = useQuery<string[]>({
    queryKey: ["/api/admin/subjects"],
  });

  const { data: slots = [], isLoading } = useQuery<TimetableSlot[]>({
    queryKey: ["/api/timetable"],
    enabled: !!user?.id,
  });

  const getSlot = (day: number, period: number) =>
    slots.find((s) => s.dayOfWeek === day && s.period === period);

  const getDisplayTime = (slot: TimetableSlot, periodIdx: number) => {
    const start = slot.startTime ?? periodTimes[periodIdx]?.start;
    const end = slot.endTime ?? periodTimes[periodIdx]?.end;
    return { start, end };
  };

  const dateStr = selectedDate.toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  const teacherSubject = (user?.publicMetadata as any)?.subject as string | undefined;

  const currentSlot = activePeriod !== null && activeDay !== null
    ? getSlot(activeDay, activePeriod)
    : null;

  const isOwnSubject = (slot: TimetableSlot) =>
    teacherSubject && slot.subject.toLowerCase() === teacherSubject.toLowerCase();

  // Count today's slots
  const todaySlotsCount = activeDay !== null
    ? slots.filter(s => s.dayOfWeek === activeDay).length
    : 0;

  const createMutation = useMutation({
    mutationFn: (data: Omit<SlotForm, "id">) => apiRequest("POST", "/api/timetable", data),
    onSuccess: () => {
      toast({ title: "Slot Added", description: "Timetable slot created." });
      queryClient.invalidateQueries({ queryKey: ["/api/timetable"] });
      setDialogOpen(false);
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: SlotForm & { id: string }) =>
      apiRequest("PUT", `/api/timetable/${id}`, data),
    onSuccess: () => {
      toast({ title: "Slot Updated", description: "Timetable slot updated." });
      queryClient.invalidateQueries({ queryKey: ["/api/timetable"] });
      setDialogOpen(false);
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/timetable/${id}`),
    onSuccess: () => {
      toast({ title: "Slot Deleted", description: "Timetable slot removed." });
      queryClient.invalidateQueries({ queryKey: ["/api/timetable"] });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const resetMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", "/api/timetable"),
    onSuccess: () => {
      toast({ title: "Timetable Reset", description: "All slots cleared." });
      queryClient.invalidateQueries({ queryKey: ["/api/timetable"] });
      setResetDialogOpen(false);
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const openAdd = (day: number, period: number) => {
    const existing = getSlot(day, period);
    if (existing) {
      openEdit(existing);
    } else {
      setForm({ ...defaultForm(day, period), startTime: DEFAULT_PERIOD_TIMES[period]?.start ?? "", endTime: DEFAULT_PERIOD_TIMES[period]?.end ?? "" });
      setUseCustomTime(false);
      setDialogOpen(true);
    }
  };

  const openEdit = (slot: TimetableSlot) => {
    setForm({
      id: slot.id,
      dayOfWeek: slot.dayOfWeek,
      period: slot.period,
      subject: slot.subject,
      section: slot.section,
      room: slot.room ?? "",
      startTime: slot.startTime ?? DEFAULT_PERIOD_TIMES[slot.period]?.start ?? "",
      endTime: slot.endTime ?? DEFAULT_PERIOD_TIMES[slot.period]?.end ?? "",
    });
    setUseCustomTime(!!(slot.startTime || slot.endTime));
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.subject || !form.section) {
      toast({ title: "Validation", description: "Subject and class are required.", variant: "destructive" });
      return;
    }
    let formattedSection = form.section.trim();
    if (formattedSection.includes(" ")) {
      formattedSection = formattedSection.replace(/\s+/g, "-").toUpperCase();
    }
    
    // Clear times if custom time is toggled off
    const finalData = { 
      ...form, 
      section: formattedSection,
      startTime: useCustomTime ? form.startTime : null,
      endTime: useCustomTime ? form.endTime : null
    };

    if (form.id) {
      updateMutation.mutate(finalData as SlotForm & { id: string });
    } else {
      const { id: _id, ...rest } = finalData;
      createMutation.mutate(rest);
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2.5" data-testid="text-timetable-heading">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-md shadow-indigo-500/25">
              <CalendarDays className="w-4 h-4 text-white" />
            </div>
            Timetable
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-medium">{dateStr}</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Edit controls */}
          {editMode ? (
            <>
              <Button
                variant="outline"
                size="sm"
                className="text-red-600 border-red-200 hover:bg-red-50 dark:border-red-800/60 dark:hover:bg-red-950/30 rounded-xl"
                onClick={() => setResetDialogOpen(true)}
                data-testid="button-reset-timetable"
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                Reset All
              </Button>
              <Button
                size="sm"
                className="bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-400 hover:to-green-400 text-white shadow-md shadow-green-500/20 rounded-xl"
                onClick={() => setEditMode(false)}
                data-testid="button-done-editing"
              >
                <Check className="w-3.5 h-3.5 mr-1.5" />
                Done
              </Button>
            </>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl border-gray-200 dark:border-gray-700"
              onClick={() => setEditMode(true)}
              data-testid="button-edit-timetable"
            >
              <Pencil className="w-3.5 h-3.5 mr-1.5" />
              Customize
            </Button>
          )}

          {/* Active session card */}
          {!editMode && currentSlot && isOwnSubject(currentSlot) && (
            <Link href="/attendance">
              <div className="group cursor-pointer">
                <div className="flex items-center gap-3 bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-400 hover:to-green-400 text-white rounded-2xl px-4 py-2.5 shadow-lg shadow-green-500/30 transition-all duration-200 hover:scale-[1.02] hover:shadow-green-500/40">
                  <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
                    <Zap className="w-4 h-4 animate-pulse" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider opacity-80">Active Now</p>
                    <p className="font-bold text-sm" data-testid="text-active-session">
                      {currentSlot.subject} — {formatSection(currentSlot.section)}
                    </p>
                  </div>
                  <ArrowRight className="w-4 h-4 opacity-70 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
            </Link>
          )}

          {!editMode && currentSlot && !isOwnSubject(currentSlot) && (
            <div className="flex items-center gap-3 bg-gray-100 dark:bg-gray-800/60 text-gray-600 dark:text-gray-400 rounded-2xl px-4 py-2.5 opacity-70">
              <Clock className="w-4 h-4" />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider">Active — Not Your Subject</p>
                <p className="font-semibold text-sm" data-testid="text-active-session-locked">
                  {currentSlot.subject} — {formatSection(currentSlot.section)}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Edit mode banner */}
      {editMode && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/60 text-indigo-700 dark:text-indigo-300 text-sm font-medium animate-fade-in">
          <Pencil className="w-4 h-4 shrink-0" />
          Click any cell to edit it, or click <Plus className="w-3.5 h-3.5 mx-1 inline" /> to add a new slot.
        </div>
      )}

      {/* Summary stats */}
      {!editMode && slots.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 animate-fade-up">
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800/80 p-4 flex items-center gap-3 shadow-sm">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 flex items-center justify-center">
              <CalendarDays className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <p className="text-lg font-bold text-gray-900 dark:text-white">{slots.length}</p>
              <p className="text-[11px] text-gray-500 font-medium">Total Slots</p>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800/80 p-4 flex items-center gap-3 shadow-sm">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center">
              <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-lg font-bold text-gray-900 dark:text-white">{todaySlotsCount}</p>
              <p className="text-[11px] text-gray-500 font-medium">Today's Classes</p>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800/80 p-4 flex items-center gap-3 shadow-sm">
            <div className={cn(
              "w-9 h-9 rounded-xl flex items-center justify-center transition-colors",
              activePeriod !== null 
                ? "bg-violet-50 dark:bg-violet-950/40" 
                : "bg-gray-50 dark:bg-gray-800/40"
            )}>
              <Clock className={cn(
                "w-4 h-4",
                activePeriod !== null ? "text-violet-600 dark:text-violet-400" : "text-gray-400"
              )} />
            </div>
            <div>
              <p className="text-lg font-bold text-gray-900 dark:text-white">
                {activePeriod !== null ? `P${activePeriod + 1}` : "No Active Class"}
              </p>
              <p className="text-[11px] text-gray-500 font-medium">
                {activePeriod !== null ? "Current Period" : "Break / Off-Hours"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Timetable Grid */}
      {isLoading ? (
        <div className="grid gap-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-2xl shimmer-bg" />
          ))}
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800/80 shadow-sm overflow-hidden">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full border-collapse min-w-[680px]">
              <thead>
                <tr className="bg-gray-50/80 dark:bg-gray-800/40">
                  <th className="p-4 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest w-24 border-b border-gray-100 dark:border-gray-800/80">
                    <Clock className="w-3.5 h-3.5 inline mr-1.5 mb-0.5" />
                    Period
                  </th>
                  {DAYS.map((day, i) => (
                    <th
                      key={day}
                      className={cn(
                        "p-4 text-center text-[10px] font-bold uppercase tracking-widest border-b border-gray-100 dark:border-gray-800/80",
                        activeDay === i
                          ? "text-indigo-600 dark:text-indigo-400 bg-indigo-50/60 dark:bg-indigo-950/20"
                          : "text-gray-400"
                      )}
                    >
                      <span className="hidden sm:inline">{day}</span>
                      <span className="sm:hidden">{DAYS_SHORT[i]}</span>
                      {activeDay === i && (
                        <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERIODS.map((periodIdx) => (
                  <tr key={periodIdx} className="group/row">
                    <td className="p-3 border-b border-gray-50 dark:border-gray-800/40">
                      <div className="text-xs font-bold text-gray-800 dark:text-gray-200">P{periodIdx + 1}</div>
                      <div className="text-[10px] text-gray-400 mt-0.5 tabular-nums">
                        {periodTimes[periodIdx]?.start}–{periodTimes[periodIdx]?.end}
                      </div>
                    </td>
                    {DAYS.map((_, dayIdx) => {
                      const slot = getSlot(dayIdx, periodIdx);
                      const isActive = activeDay === dayIdx && activePeriod === periodIdx;
                      const times = slot ? getDisplayTime(slot, periodIdx) : null;
                      const hasCustomTime = slot && (slot.startTime || slot.endTime);

                      return (
                        <td
                          key={dayIdx}
                          className={cn(
                            "p-1.5 border-b border-gray-50 dark:border-gray-800/40 text-center transition-colors",
                            activeDay === dayIdx && "bg-indigo-50/20 dark:bg-indigo-950/10",
                          )}
                        >
                          {slot ? (
                            editMode ? (
                              <div
                                className="rounded-xl p-2.5 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800/60 cursor-pointer hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-all duration-150 relative group/cell"
                                onClick={() => openEdit(slot)}
                                data-testid={`slot-edit-${dayIdx}-${periodIdx}`}
                              >
                                <div className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 truncate">{slot.subject}</div>
                                <div className="text-[10px] text-indigo-500/80 dark:text-indigo-400/80 mt-0.5 truncate">{formatSection(slot.section)}</div>
                                {hasCustomTime && (
                                  <Badge variant="outline" className="text-[9px] px-1 py-0 mt-0.5 border-amber-300 text-amber-600 dark:text-amber-400">
                                    custom
                                  </Badge>
                                )}
                                <button
                                  onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(slot.id); }}
                                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover/cell:opacity-100 transition-opacity shadow-sm hover:bg-red-600"
                                  data-testid={`button-delete-slot-${dayIdx}-${periodIdx}`}
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ) : (
                              isActive && isOwnSubject(slot) ? (
                                <Link href="/attendance">
                                  <div
                                    className={cn(
                                      "rounded-xl p-3 cursor-pointer transition-all duration-300",
                                      "bg-gradient-to-br from-emerald-400 to-green-500 text-white shadow-lg shadow-green-500/30",
                                      "hover:shadow-xl hover:shadow-green-500/40 hover:scale-[1.04] active:scale-[0.98]",
                                      "ring-2 ring-emerald-400/50 ring-offset-2 ring-offset-white dark:ring-offset-gray-900"
                                    )}
                                    data-testid={`slot-active-${dayIdx}-${periodIdx}`}
                                  >
                                    <div className="text-[11px] font-bold truncate">{slot.subject}</div>
                                    <div className="text-[9px] opacity-90 mt-0.5 truncate">{formatSection(slot.section)}</div>
                                    {slot.room && (
                                      <div className="text-[9px] opacity-80 flex items-center justify-center gap-0.5 mt-0.5">
                                        <MapPin className="w-2.5 h-2.5" />{slot.room}
                                      </div>
                                    )}
                                    {times && <div className="text-[9px] opacity-70 mt-0.5 tabular-nums">{times.start}–{times.end}</div>}
                                  </div>
                                </Link>
                              ) : (
                                <div
                                  className={cn(
                                    "rounded-xl p-3 transition-all",
                                    isOwnSubject(slot)
                                      ? "bg-indigo-50 dark:bg-indigo-900/20"
                                      : "bg-gray-50/80 dark:bg-gray-800/30",
                                    !isActive && "opacity-70"
                                  )}
                                  data-testid={`slot-${dayIdx}-${periodIdx}`}
                                >
                                  <div className={cn(
                                    "text-[11px] font-semibold truncate",
                                    isOwnSubject(slot) ? "text-indigo-700 dark:text-indigo-300" : "text-gray-600 dark:text-gray-400"
                                  )}>{slot.subject}</div>
                                  <div className="text-[9px] text-gray-400 mt-0.5 truncate">{formatSection(slot.section)}</div>
                                  {slot.room && (
                                    <div className="text-[9px] text-gray-400 flex items-center justify-center gap-0.5 mt-0.5">
                                      <MapPin className="w-2.5 h-2.5" />{slot.room}
                                    </div>
                                  )}
                                  {times && (slot.startTime || slot.endTime) && (
                                    <div className="text-[9px] text-amber-500 mt-0.5 tabular-nums">{times.start}–{times.end}</div>
                                  )}
                                </div>
                              )
                            )
                          ) : editMode ? (
                            <button
                              onClick={() => openAdd(dayIdx, periodIdx)}
                              className="w-full rounded-xl p-3 border-2 border-dashed border-gray-200 dark:border-gray-700/60 text-gray-300 dark:text-gray-600 hover:border-indigo-300 dark:hover:border-indigo-700/60 hover:text-indigo-400 dark:hover:text-indigo-500 transition-all duration-150 flex items-center justify-center min-h-[52px]"
                              data-testid={`button-add-slot-${dayIdx}-${periodIdx}`}
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          ) : (
                            <div className="rounded-xl p-3 text-[10px] text-gray-300 dark:text-gray-700 select-none">—</div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-6 text-xs text-gray-400 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-gradient-to-br from-emerald-400 to-green-500 shadow-sm" />
          Active Session
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-indigo-100 dark:bg-indigo-900/40 border border-indigo-200 dark:border-indigo-800/60" />
          Your Subject
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-gray-100 dark:bg-gray-800" />
          Other
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded border border-amber-300 bg-amber-50 dark:bg-amber-950/30" />
          Custom Time
        </div>
      </div>

      {/* Slot Editor Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md rounded-3xl border-gray-100 dark:border-gray-800" data-testid="dialog-slot-editor">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <BookOpen className="w-4 h-4 text-indigo-500" />
              {form.id ? "Edit Slot" : "Add Slot"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Day</Label>
                <Select value={String(form.dayOfWeek)} onValueChange={(v) => setForm((f) => ({ ...f, dayOfWeek: Number(v) }))}>
                  <SelectTrigger className="rounded-xl" data-testid="select-day"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DAYS.map((d, i) => (<SelectItem key={i} value={String(i)}>{d}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Period</Label>
                <Select value={String(form.period)} onValueChange={(v) => {
                  const p = Number(v);
                  setForm((f) => ({
                    ...f, period: p,
                    startTime: f.startTime === DEFAULT_PERIOD_TIMES[f.period]?.start ? DEFAULT_PERIOD_TIMES[p]?.start ?? f.startTime : f.startTime,
                    endTime: f.endTime === DEFAULT_PERIOD_TIMES[f.period]?.end ? DEFAULT_PERIOD_TIMES[p]?.end ?? f.endTime : f.endTime,
                  }));
                }}>
                  <SelectTrigger className="rounded-xl" data-testid="select-period"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PERIODS.map((p) => (<SelectItem key={p} value={String(p)}>P{p + 1} ({DEFAULT_PERIOD_TIMES[p].start})</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Subject *</Label>
              <Select value={form.subject} onValueChange={(v) => setForm((f) => ({ ...f, subject: v }))}>
                <SelectTrigger className="rounded-xl" data-testid="select-subject"><SelectValue placeholder="Select subject..." /></SelectTrigger>
                <SelectContent>
                  {globalSubjects.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Class / Section *</Label>
                <Select value={formatSection(form.section)} onValueChange={(v) => setForm((f) => ({ ...f, section: v }))}>
                  <SelectTrigger className="rounded-xl" data-testid="select-section-dropdown"><SelectValue placeholder="Select class..." /></SelectTrigger>
                  <SelectContent>
                    {TIMETABLE_SECTIONS.map((sec) => (<SelectItem key={sec} value={sec}>{sec}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Room</Label>
                <Input placeholder="e.g. Room 101" value={form.room} onChange={(e) => setForm((f) => ({ ...f, room: e.target.value }))} className="rounded-xl" data-testid="input-room" />
              </div>
            </div>

            <div className="border-t border-gray-100 dark:border-gray-800 pt-3 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-gray-400 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />Custom Time (optional)
                </p>
                <Switch 
                  checked={useCustomTime} 
                  onCheckedChange={setUseCustomTime}
                  className="data-[state=checked]:bg-indigo-600"
                />
              </div>

              {useCustomTime && (
                <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Start</Label>
                    <Input type="time" value={form.startTime} onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))} className="rounded-xl" data-testid="input-start-time" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-gray-400 uppercase tracking-wider">End</Label>
                    <Input type="time" value={form.endTime} onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))} className="rounded-xl" data-testid="input-end-time" />
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="rounded-xl">Cancel</Button>
            {form.id && (
              <Button
                variant="outline"
                className="text-red-600 border-red-200 hover:bg-red-50 dark:border-red-800/60 dark:hover:bg-red-950/30 rounded-xl"
                onClick={() => { deleteMutation.mutate(form.id!); setDialogOpen(false); }}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="w-3.5 h-3.5 mr-1.5" />Delete
              </Button>
            )}
            <Button onClick={handleSave} disabled={isSaving} className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-xl shadow-md shadow-indigo-500/20" data-testid="button-save-slot">
              {isSaving ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Check className="w-3.5 h-3.5 mr-1.5" />}
              {form.id ? "Update" : "Add Slot"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Dialog */}
      <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <AlertDialogContent className="rounded-3xl border-gray-100 dark:border-gray-800">
          <AlertDialogHeader>
            <AlertDialogTitle>Reset Timetable?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete all your custom timetable slots. The default schedule will be restored on next page load.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 rounded-xl"
              onClick={() => resetMutation.mutate()}
              data-testid="button-confirm-reset"
            >
              {resetMutation.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : null}
              Reset All Slots
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
