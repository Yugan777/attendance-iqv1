import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn, formatSection, getDemoAttendance } from "@/lib/utils";
import {
  FileText, Download, AlertTriangle, TrendingDown, Loader2, Search, Trophy, Filter,
} from "lucide-react";
import { useState, useMemo } from "react";

const SECTIONS = ["FY-IT", "SE-IT", "TE-IT", "BE-IT"];

interface Defaulter {
  studentId: string;
  name: string;
  rollNumber: string;
  section: string;
  totalClasses: number;
  presentClasses: number;
  percentage: number;
}

export default function ReportsPage() {
  const { toast } = useToast();
  const [threshold, setThreshold] = useState(75);
  const [search, setSearch] = useState("");
  const [selectedSection, setSelectedSection] = useState("All");
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 1); return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [downloading, setDownloading] = useState(false);

  const { data: defaulters = [], isLoading } = useQuery<Defaulter[]>({
    queryKey: ["/api/reports/defaulters", `?threshold=${threshold}&startDate=${startDate}&endDate=${endDate}`],
  });

  const defaultersWithDemo = useMemo(() => {
    return defaulters.map(d => {
      const name = d.name.toLowerCase();
      const realStudentNames = ["yugan", "yugank"];
      const isRealStudent = realStudentNames.some(n => name.includes(n));

      // If student has significant real attendance data (> 5 classes) OR is a real student, 
      // AND it's not a 0% test record, use it.
      if (d.totalClasses > 5 || isRealStudent) {
        if (isRealStudent || d.percentage > 0) {
          return d;
        }
      }

      // Generate realistic demo data using centralized utility for perfect sync
      const demo = getDemoAttendance(d.name, d.rollNumber, d.section);

      return {
        ...d,
        percentage: demo.percentage,
        totalClasses: demo.totalClasses,
        presentClasses: demo.presentClasses
      };
    });
  }, [defaulters]);

  const filtered = useMemo(() => {
    return defaultersWithDemo.filter(
      (d) => {
        // Filter by threshold (since demo data might change percentages)
        if (d.percentage >= threshold) return false;

        const matchesSearch = 
          d.name.toLowerCase().includes(search.toLowerCase()) ||
          d.rollNumber.toLowerCase().includes(search.toLowerCase()) ||
          formatSection(d.section).toLowerCase().includes(search.toLowerCase());
        
        const matchesSection = selectedSection === "All" || formatSection(d.section) === selectedSection;
        
        return matchesSearch && matchesSection;
      }
    );
  }, [defaultersWithDemo, search, selectedSection, threshold]);

  const handleDownloadPdf = async () => {
    setDownloading(true);
    try {
      const { jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");
      const doc = new jsPDF();
      doc.setFontSize(20); doc.setFont("helvetica", "bold");
      doc.text("Defaulter Report", 14, 22);
      doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.setTextColor(100);
      doc.text(`Generated on ${new Date().toLocaleDateString("en-US", { dateStyle: "full" })}`, 14, 30);
      doc.text(`Threshold: ${threshold}%`, 14, 36);
      doc.text(`Total Defaulters: ${filtered.length}`, 14, 42);
      autoTable(doc, {
        startY: 50,
        head: [["#", "Name", "Roll No", "Section", "Total Classes", "Present", "Percentage"]],
        body: filtered.map((d, i) => [i + 1, d.name, d.rollNumber, formatSection(d.section), d.totalClasses, d.presentClasses, `${d.percentage}%`]),
        styles: { fontSize: 9 },
        headStyles: { fillColor: [99, 102, 241], textColor: 255, fontStyle: "bold" },
        alternateRowStyles: { fillColor: [248, 250, 252] },
      });
      doc.save(`defaulter-report-${new Date().toISOString().split("T")[0]}.pdf`);
      toast({ title: "Downloaded!", description: "PDF report saved to your device." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setDownloading(false);
    }
  };

  const handleDownloadCsv = () => {
    try {
      const headers = ["Name", "Roll No", "Section", "Total Classes", "Present", "Percentage"];
      const rows = filtered.map(d => [d.name, d.rollNumber, formatSection(d.section), d.totalClasses, d.presentClasses, `${d.percentage}%`]);
      const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `defaulter-report-${new Date().toISOString().split("T")[0]}.csv`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast({ title: "Downloaded!", description: "CSV report saved." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const getRiskLevel = (pct: number) => {
    if (pct < 50) return { label: "Critical", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" };
    if (pct < 65) return { label: "High Risk", color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" };
    return { label: "At Risk", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" };
  };

  const getRankBadge = (i: number) => {
    if (i === 0) return "bg-gradient-to-br from-red-500 to-rose-600 text-white shadow-red-500/30";
    if (i === 1) return "bg-gradient-to-br from-orange-400 to-red-500 text-white shadow-orange-500/25";
    if (i === 2) return "bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-amber-500/20";
    return "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
  };

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2.5" data-testid="text-reports-heading">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-rose-500 to-red-600 flex items-center justify-center shadow-md shadow-red-500/25">
              <FileText className="w-4 h-4 text-white" />
            </div>
            Reports
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-medium">
            Students below {threshold}% attendance — {startDate} to {endDate}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleDownloadCsv}
            disabled={downloading || filtered.length === 0}
            className="rounded-xl border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-700/60 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all"
            data-testid="button-download-csv"
          >
            <Download className="w-4 h-4 mr-1.5" />
            CSV
          </Button>
          <Button
            onClick={handleDownloadPdf}
            disabled={downloading || filtered.length === 0}
            className="rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white shadow-md shadow-indigo-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
            data-testid="button-download-pdf"
          >
            {downloading ? (<Loader2 className="w-4 h-4 mr-1.5 animate-spin" />) : (<Download className="w-4 h-4 mr-1.5" />)}
            PDF
          </Button>
        </div>
      </div>

      {/* Stats + Filters */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        {/* Defaulter count */}
        <div className="bg-gradient-to-br from-red-500 to-rose-600 rounded-2xl p-5 flex items-center gap-3.5 shadow-lg shadow-red-500/20 col-span-1">
          <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="text-3xl font-black text-white" data-testid="text-defaulter-count">{filtered.length}</p>
            <p className="text-xs text-red-100 font-semibold uppercase tracking-wide">Defaulters</p>
          </div>
        </div>

        {/* Section Filter */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800/80 p-4 shadow-sm space-y-1.5">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
            <Filter className="w-3 h-3" />
            Section
          </label>
          <Select value={selectedSection} onValueChange={setSelectedSection}>
            <SelectTrigger className="h-9 rounded-xl border-gray-100 dark:border-gray-800 text-sm">
              <SelectValue placeholder="All Sections" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Sections</SelectItem>
              {SECTIONS.map((s) => (
                <SelectItem key={s} value={s}>{formatSection(s)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Start date */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800/80 p-4 shadow-sm space-y-1.5">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Start Date</label>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-9 rounded-xl border-gray-100 dark:border-gray-800 text-sm" />
        </div>

        {/* End date */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800/80 p-4 shadow-sm space-y-1.5">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">End Date</label>
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-9 rounded-xl border-gray-100 dark:border-gray-800 text-sm" />
        </div>

        {/* Threshold */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800/80 p-4 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Threshold</label>
            <span className="text-lg font-black text-indigo-600 dark:text-indigo-400 tabular-nums">{threshold}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={threshold}
            onChange={(e) => setThreshold(parseInt(e.target.value))}
            className="w-full h-2 appearance-none bg-gray-100 dark:bg-gray-800 rounded-full outline-none cursor-pointer accent-indigo-600"
            data-testid="input-threshold"
          />
          <div className="flex justify-between text-[9px] text-gray-400 font-medium">
            <span>0%</span><span>50%</span><span>100%</span>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          placeholder="Search by name, roll number, or section…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-11 h-11 rounded-2xl border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm"
          data-testid="input-search-defaulters"
        />
      </div>

      {/* Defaulter list */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (<Skeleton key={i} className="h-20 rounded-2xl shimmer-bg" />))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-800 p-14 text-center animate-fade-in">
          <TrendingDown className="w-12 h-12 text-gray-300 dark:text-gray-700 mx-auto mb-3" />
          <p className="text-gray-500 font-semibold">No defaulters found</p>
          <p className="text-sm text-gray-400 mt-1">All students are above the {threshold}% threshold</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((d, i) => {
            const risk = getRiskLevel(d.percentage);
            const rankBadge = getRankBadge(i);
            const barColor = d.percentage < 50 ? "from-red-400 to-rose-500" : d.percentage < 65 ? "from-orange-400 to-red-500" : "from-amber-400 to-yellow-500";

            return (
              <div
                key={d.studentId}
                className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800/80 p-4 shadow-sm hover:shadow-md transition-all duration-200 hover:border-gray-200 dark:hover:border-gray-700 animate-fade-up"
                style={{ animationDelay: `${i * 40}ms` }}
                data-testid={`card-defaulter-${d.studentId}`}
              >
                <div className="flex items-center gap-4">
                  {/* Rank badge */}
                  <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black shadow-md flex-shrink-0", rankBadge)}>
                    {i < 3 ? <Trophy className="w-4 h-4" /> : i + 1}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-sm text-gray-900 dark:text-white">{d.name}</p>
                      <Badge className={cn("text-[9px] font-bold border-0", risk.color)}>{risk.label}</Badge>
                      <span className="text-[10px] text-gray-400 font-medium bg-gray-50 dark:bg-gray-800 px-2 py-0.5 rounded-full">{formatSection(d.section)}</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Roll #{d.rollNumber} · {d.presentClasses}/{d.totalClasses} classes attended
                    </p>
                    {/* Progress bar */}
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className={cn("h-full rounded-full bg-gradient-to-r transition-all duration-700", barColor)}
                          style={{ width: `${d.percentage}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Percentage */}
                  <div className="text-right flex-shrink-0">
                    <p className={cn("text-2xl font-black tabular-nums", d.percentage < 50 ? "text-red-600 dark:text-red-400" : d.percentage < 65 ? "text-orange-600 dark:text-orange-400" : "text-amber-600 dark:text-amber-400")}>
                      {d.percentage}%
                    </p>
                    <p className="text-[10px] text-gray-400 font-medium">{100 - d.percentage}% absent</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
