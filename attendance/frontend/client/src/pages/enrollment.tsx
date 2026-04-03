import { useState, useRef, useCallback, useEffect } from "react";
import { useUser } from "@clerk/react";
import { useQuery, useMutation } from "@tanstack/react-query";
import Webcam from "react-webcam";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { cn, formatSection } from "@/lib/utils";
import {
  Camera,
  CameraOff,
  UserPlus,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Scan,
  Zap,
  RotateCcw,
  ArrowRight,
  ArrowLeft,
  Check,
} from "lucide-react";
import type { Student, TimetableSlot } from "@shared/schema";

const STEPS = [
  { label: "Details", number: 1 },
  { label: "Photo", number: 2 },
  { label: "Done", number: 3 },
];

const SECTIONS = ["FY-IT", "SE-IT", "TE-IT", "BE-IT"];

const ADMIN_EMAILS = ["naeem542005@gmail.com", "yugankamble@gmail.com", "yugan777@gmail.com"];

export default function EnrollmentPage() {
  const { user } = useUser();
  const isAdminUser = (user?.publicMetadata as any)?.role === "admin" || 
                    ADMIN_EMAILS.includes(user?.emailAddresses?.[0]?.emailAddress?.toLowerCase() || "");
  const { toast } = useToast();
  const webcamRef = useRef<Webcam>(null);

  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [rollNumber, setRollNumber] = useState("");
  const [section, setSection] = useState("");
  const [validationError, setValidationError] = useState("");

  const [showCamera, setShowCamera] = useState(false);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [capturing, setCapturing] = useState(false);
  const [captureCount, setCaptureCount] = useState(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [processing, setProcessing] = useState(false);
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const [uploadedPhoto, setUploadedPhoto] = useState<string | null>(null);
  const [createdStudentId, setCreatedStudentId] = useState<string | null>(null);
  const [createdStudentName, setCreatedStudentName] = useState("");

  const { data: timetable = [] } = useQuery<TimetableSlot[]>({
    queryKey: ["/api/timetable"],
    enabled: !!user?.id,
  });

  const { data: existingStudents = [] } = useQuery<Student[]>({
    queryKey: ["/api/students", `?section=${encodeURIComponent(section)}`],
    enabled: !!section,
  });

  const [piStatus, setPiStatus] = useState<"online" | "offline" | "checking">("checking");
  const piIp = localStorage.getItem("pi_ip") || "";

  const checkPiStatus = async () => {
    try {
      const headers: Record<string, string> = {};
      if (piIp) headers["x-pi-ip"] = piIp;

      const res = await fetch("/api/health", { 
        headers,
        signal: AbortSignal.timeout(2000) 
      }).catch(() => null);
      setPiStatus(res?.ok ? "online" : "offline");
    } catch {
      setPiStatus("offline");
    }
  };

  useEffect(() => {
    checkPiStatus();
    const interval = setInterval(checkPiStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  const teacherSubject = (user?.publicMetadata as any)?.subject as string | undefined;
  const teacherSubjects = (user?.publicMetadata as any)?.subjects as string[] | undefined;
  
  // Filter all subjects against a valid list (baseline logic)
  const allTeacherSubjects = [...new Set([teacherSubject, ...(teacherSubjects || [])])].filter(Boolean) as string[];

  const ownSlots = timetable.filter(
    (s) => allTeacherSubjects.some(ts => ts.toLowerCase() === s.subject.toLowerCase())
  );
  
  // Natural sort for sections (FY-IT, SE-IT, TE-IT, BE-IT)
  const sortSections = (list: string[]) => {
    return SECTIONS;
  };
  
  // Use teacher's own sections if available AND not admin, otherwise show all sections from the timetable
  const availableSections = (ownSlots.length > 0 && !isAdminUser) 
    ? sortSections(ownSlots.map((s) => s.section))
    : sortSections(timetable.map((s) => s.section));

  const addStudentMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/students", {
        name,
        rollNumber,
        section,
      });
    },
    onSuccess: async (res) => {
      const student = await res.json();
      setCreatedStudentId(student.id);
      setCreatedStudentName(student.name);
      queryClient.invalidateQueries({ queryKey: ["/api/students"] });
      setStep(2);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleContinueToPhoto = () => {
    if (!name.trim() || !rollNumber.trim() || !section) {
      setValidationError("Please fill in all required fields.");
      return;
    }
    setValidationError("");

    // Check if student already exists
    const existingStudent = existingStudents.find(
      (s) => s.rollNumber === rollNumber && s.section === section
    );

    if (existingStudent) {
      // If found, update the context with existing student ID
      setCreatedStudentId(existingStudent.id);
      setCreatedStudentName(existingStudent.name);
      toast({
        title: "Existing Student Found",
        description: `Enrolling face data for ${existingStudent.name} (Roll #${existingStudent.rollNumber}).`,
      });
      setStep(2);
      return;
    }

    if (createdStudentId) {
      setStep(2);
      return;
    }
    addStudentMutation.mutate();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "File too large", description: "Please upload an image under 10MB.", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setUploadedPhoto(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const [guidanceText, setGuidanceText] = useState("Get ready...");

  const startCapture = useCallback(async () => {
    setCapturedImages([]);
    setCountdown(3);
    setGuidanceText("Look directly at the camera");
    
    for (let i = 3; i > 0; i--) {
      setCountdown(i);
      await new Promise((r) => setTimeout(r, 1000));
    }
    setCountdown(null);

    setCapturing(true);
    setCaptureCount(0);

    const images: string[] = [];
    const TOTAL_CAPTURE_TIME_SEC = 10;
    const CAPTURE_INTERVAL_MS = 1000;
    const TOTAL_FRAMES = TOTAL_CAPTURE_TIME_SEC; // 1 frame per sec

    for (let i = 0; i < TOTAL_FRAMES; i++) {
      // Guidance Logic
      if (i < 3) setGuidanceText("Look slightly LEFT");
      else if (i < 6) setGuidanceText("Look slightly RIGHT");
      else setGuidanceText("Look CENTER again");

      const screenshot = webcamRef.current?.getScreenshot();
      if (screenshot) images.push(screenshot);
      setCaptureCount(i + 1);
      
      // Wait for next frame
      await new Promise((r) => setTimeout(r, CAPTURE_INTERVAL_MS));
    }

    setCapturing(false);
    setCapturedImages(images);

    if (images.length < 5) {
      toast({
        title: "Capture Failed",
        description: `Only ${images.length} photos captured. Please try again.`,
        variant: "destructive",
      });
    }
  }, [toast]);

  const completeEnrollment = async () => {
    if (!createdStudentId) return;
    setProcessing(true);
    try {
      const hasImages = capturedImages.length > 0 || uploadedPhoto;

      if (hasImages) {
        // Send images to Pi backend for face embedding generation
        const imagesToSend = uploadedPhoto
          ? [uploadedPhoto]
          : capturedImages;

        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (piIp) headers["x-pi-ip"] = piIp;

        const piRes = await fetch("/api/enroll", {
          method: "POST",
          headers,
          body: JSON.stringify({
            studentId: createdStudentId,
            images: imagesToSend,
          }),
          signal: AbortSignal.timeout(120000),
        });

        if (!piRes.ok) {
          const errData = await piRes.json().catch(() => ({}));
          throw new Error(errData.message || errData.error || "Enrollment failed");
        }

        const piData = await piRes.json();

        if (piData.embedding && Array.isArray(piData.embedding)) {
          // Tell our website backend to mark student as enrolled with these embeddings
          await apiRequest("POST", "/api/enroll-complete", {
            studentId: createdStudentId,
            embedding: piData.embedding
          });

          toast({
            title: "Face Enrolled!",
            description: `${piData.imagesProcessed}/${piData.imagesTotal} images processed successfully.`,
          });
        }
      } else {
        // No images — just mark enrolled (no embedding)
        await apiRequest("POST", `/api/students/${createdStudentId}/enrollment`, { enrolled: true });
      }

      queryClient.invalidateQueries({ queryKey: ["/api/students"] });
      setStep(3);
      toast({ title: "Enrollment Complete!", description: `${createdStudentName} has been enrolled successfully.` });
    } catch (err: any) {
      const message = err.name === "TimeoutError"
        ? "Request timed out. The server may be processing images. Try again or reduce photos."
        : err.message;
      toast({ title: "Enrollment Error", description: message, variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  const resetForm = () => {
    setStep(1);
    setName("");
    setRollNumber("");
    setSection("");
    setValidationError("");
    setShowCamera(false);
    setCapturedImages([]);
    setUploadedPhoto(null);
    setCreatedStudentId(null);
    setCreatedStudentName("");
    setCaptureCount(0);
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="max-w-5xl mx-auto space-y-10 pb-20">
      {/* Header Section */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-[0.2em]" data-testid="text-enrollment-label">
            Enrollment
          </p>
          <h2 className="text-4xl font-black text-gray-900 dark:text-gray-100 tracking-tight" data-testid="text-enrollment-heading">
            Student Enrollment
          </h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">
            Register a new student with their profile photo
          </p>
        </div>

        <div className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-full border text-[10px] font-bold uppercase tracking-wider",
          piStatus === "online" 
            ? "bg-green-50 border-green-100 text-green-600 dark:bg-green-900/20 dark:border-green-800 dark:text-green-400"
            : "bg-red-50 border-red-100 text-red-600 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400"
        )}>
          <div className={cn("w-1.5 h-1.5 rounded-full", piStatus === "online" ? "bg-green-500" : "bg-red-500")} />
          System {piStatus === "online" ? "Online" : "Offline"}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Steps Sidebar */}
        <div className="lg:col-span-4 space-y-4 pt-4">
          {STEPS.map((s) => (
            <div
              key={s.number}
              className={cn(
                "group relative flex items-center gap-6 p-5 rounded-2xl transition-all duration-500",
                step === s.number
                  ? "bg-white dark:bg-gray-900 shadow-[0_20px_50px_rgba(0,0,0,0.04)] ring-1 ring-gray-100 dark:ring-gray-800"
                  : "opacity-40"
              )}
            >
              <div className={cn(
                "w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-500",
                step === s.number
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-500/40"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-400"
              )}>
                {step > s.number ? <Check className="w-6 h-6" /> : s.number}
              </div>
              <div className="flex flex-col">
                <span className={cn(
                  "font-bold transition-colors duration-500",
                  step === s.number ? "text-gray-900 dark:text-white" : "text-gray-400"
                )}>
                  {s.label}
                </span>
                <span className="text-[11px] text-gray-400 font-medium">
                  {s.number === 1 ? "Basic student information" : s.number === 2 ? "Face capture & matching" : "Enrollment complete"}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Form Card */}
        <div className="lg:col-span-8">
          <Card className="border-none bg-white dark:bg-gray-900 shadow-[0_30px_60px_rgba(0,0,0,0.03)] rounded-[32px] overflow-hidden">
            <CardContent className="p-10">
              {step === 1 && (
                <div className="space-y-10">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">Personal Information</h3>
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
                      <UserPlus className="w-6 h-6" />
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="space-y-2.5">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Full Name</label>
                      <Input
                        placeholder="e.g. Aarav Sharma"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="h-14 bg-gray-50/50 dark:bg-gray-800/50 border-none rounded-2xl px-6 text-base font-medium placeholder:text-gray-300 focus-visible:ring-2 focus-visible:ring-blue-500/20 transition-all"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-2.5">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Roll Number</label>
                        <Input
                          placeholder="e.g. 01"
                          value={rollNumber}
                          onChange={(e) => setRollNumber(e.target.value)}
                          className="h-14 bg-gray-50/50 dark:bg-gray-800/50 border-none rounded-2xl px-6 text-base font-medium placeholder:text-gray-300 focus-visible:ring-2 focus-visible:ring-blue-500/20 transition-all"
                        />
                      </div>
                      <div className="space-y-2.5">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Class / Section</label>
                        <Select value={formatSection(section)} onValueChange={setSection}>
                          <SelectTrigger className="h-14 bg-gray-50/50 dark:bg-gray-800/50 border-none rounded-2xl px-6 text-base font-medium focus:ring-2 focus:ring-blue-500/20 transition-all">
                            <SelectValue placeholder="Select Class" />
                          </SelectTrigger>
                          <SelectContent className="rounded-2xl border-gray-100 dark:border-gray-800 shadow-xl">
                            {SECTIONS.map((s) => (
                              <SelectItem key={s} value={s} className="rounded-xl py-2.5 font-medium">
                                {s}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  {validationError && (
                    <div className="flex items-center gap-2 text-red-500 text-sm font-bold bg-red-50 dark:bg-red-900/20 p-4 rounded-2xl">
                      <AlertCircle className="w-4 h-4" />
                      {validationError}
                    </div>
                  )}

                  <Button
                    onClick={handleContinueToPhoto}
                    disabled={addStudentMutation.isPending}
                    className="w-full h-16 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-base font-bold shadow-xl shadow-blue-500/30 transition-all active:scale-[0.98] group"
                  >
                    {addStudentMutation.isPending ? (
                      <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    ) : (
                      <>
                        Continue to Photo
                        <ArrowRight className="w-5 h-5 ml-2 transition-transform group-hover:translate-x-1" />
                      </>
                    )}
                  </Button>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-8">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">Profile Photo</h3>
                      <p className="text-sm text-gray-500 mt-1">Upload a clear front-facing photo.</p>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
                      <Camera className="w-6 h-6" />
                    </div>
                  </div>

                  {!showCamera ? (
                    <div className="space-y-6">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png"
                        className="hidden"
                        onChange={handleFileUpload}
                      />
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full border-2 border-dashed border-gray-100 dark:border-gray-800 rounded-[32px] p-12 flex flex-col items-center justify-center gap-4 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50/30 dark:hover:bg-blue-950/10 transition-all duration-300 group cursor-pointer"
                        data-testid="button-upload-photo"
                      >
                        {uploadedPhoto ? (
                          <div className="relative group">
                            <img src={uploadedPhoto} alt="Uploaded" className="w-32 h-32 rounded-3xl object-cover shadow-2xl ring-4 ring-white dark:ring-gray-800" />
                            <div className="absolute inset-0 bg-black/40 rounded-3xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <RotateCcw className="w-8 h-8 text-white" />
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="w-20 h-20 rounded-full bg-gray-50 dark:bg-gray-800 flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
                              <Camera className="w-8 h-8 text-gray-400" />
                            </div>
                            <div className="text-center">
                              <p className="text-base font-bold text-gray-700 dark:text-gray-200">Tap to upload photo</p>
                              <p className="text-xs text-gray-400 mt-1 font-medium">JPG, PNG up to 10MB</p>
                            </div>
                          </>
                        )}
                      </button>

                      <div className="flex items-center gap-4">
                        <div className="flex-1 h-px bg-gray-100 dark:bg-gray-800" />
                        <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">or use camera</span>
                        <div className="flex-1 h-px bg-gray-100 dark:bg-gray-800" />
                      </div>

                      <Button
                        variant="outline"
                        className="w-full h-14 border-none bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-2xl font-bold transition-all active:scale-[0.98]"
                        onClick={() => setShowCamera(true)}
                        data-testid="button-open-camera"
                      >
                        <Scan className="w-5 h-5 mr-2" />
                        Open Camera (10-photo burst)
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div className="relative aspect-[4/3] bg-gray-900 rounded-[32px] overflow-hidden shadow-2xl ring-1 ring-gray-100 dark:ring-gray-800">
                        {(capturedImages.length === 0 || capturing) && (
                          <Webcam
                            ref={webcamRef}
                            screenshotFormat="image/jpeg"
                            className="w-full h-full object-cover"
                            videoConstraints={{ facingMode, width: 640, height: 480 }}
                            mirrored={facingMode === "user"}
                          />
                        )}

                        {capturedImages.length > 0 && !capturing && (
                          <div className="absolute inset-0 bg-gradient-to-br from-blue-600/90 to-indigo-900/90 flex flex-col items-center justify-center p-8 backdrop-blur-sm">
                            <div className="w-20 h-20 rounded-full bg-white flex items-center justify-center shadow-2xl mb-4">
                              <CheckCircle2 className="w-10 h-10 text-blue-600" />
                            </div>
                            <p className="text-white text-xl font-bold">{capturedImages.length} Photos Captured</p>
                            <div className="flex gap-2 mt-6 flex-wrap justify-center max-w-sm">
                              {capturedImages.slice(0, 5).map((img, i) => (
                                <img key={i} src={img} alt={`Capture ${i + 1}`}
                                  className="w-12 h-12 rounded-xl object-cover border-2 border-white/20 shadow-lg" />
                              ))}
                              {capturedImages.length > 5 && (
                                <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center text-white text-sm font-bold border-2 border-white/20">
                                  +{capturedImages.length - 5}
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {countdown !== null && (
                          <div className="absolute inset-0 bg-black/40 backdrop-blur-md flex items-center justify-center">
                            <div className="text-9xl font-black text-white animate-pulse drop-shadow-2xl">{countdown}</div>
                          </div>
                        )}

                        {capturing && (
                          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/10 backdrop-blur-[2px]">
                            <div className="bg-white/90 dark:bg-gray-900/90 px-8 py-4 rounded-3xl shadow-2xl backdrop-blur-xl border border-white/20">
                              <p className="text-gray-900 dark:text-white text-2xl font-black tracking-tight animate-pulse text-center uppercase">
                                {guidanceText}
                              </p>
                            </div>
                            
                            <div className="absolute bottom-10 w-64 space-y-3">
                              <div className="flex justify-between items-end px-1">
                                <span className="text-white text-xs font-black uppercase tracking-widest drop-shadow-md">Capturing</span>
                                <span className="text-white text-xl font-black drop-shadow-md">{captureCount}/10</span>
                              </div>
                              <div className="h-3 bg-white/20 rounded-full overflow-hidden backdrop-blur-md p-0.5 border border-white/10">
                                <div 
                                  className="h-full bg-white rounded-full transition-all duration-300 shadow-[0_0_15px_rgba(255,255,255,0.5)]" 
                                  style={{ width: `${(captureCount / 10) * 100}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex gap-4">
                        {capturedImages.length === 0 && (
                          <>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-14 w-14 rounded-2xl border-none bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                              onClick={() => setFacingMode((p) => (p === "user" ? "environment" : "user"))}
                            >
                              <RotateCcw className="w-6 h-6" />
                            </Button>
                            <Button
                              onClick={startCapture}
                              disabled={capturing}
                              className="flex-1 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold shadow-xl shadow-blue-500/20"
                            >
                              <Scan className="w-5 h-5 mr-2" />
                              Start 10-Photo Burst
                            </Button>
                          </>
                        )}
                        {capturedImages.length > 0 && (
                          <Button
                            variant="outline"
                            onClick={() => setCapturedImages([])}
                            className="flex-1 h-14 border-none bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-2xl font-bold"
                          >
                            <RotateCcw className="w-5 h-5 mr-2" />
                            Retake Photos
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          className="h-14 rounded-2xl border-none bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 font-bold px-6"
                          onClick={() => { setShowCamera(false); setCapturedImages([]); }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-4 p-5 rounded-2xl bg-[#F8F9FD] dark:bg-gray-800/50 border border-gray-100/50 dark:border-gray-700/50">
                    <div className="w-12 h-12 rounded-xl bg-white dark:bg-gray-800 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-sm">
                      <Zap className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-base font-bold text-gray-900 dark:text-gray-100">{createdStudentName}</p>
                      <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Roll #{rollNumber} · {section}</p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <Button
                      variant="outline"
                      onClick={() => setStep(1)}
                      className="flex-1 h-16 border-none bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-2xl font-bold"
                    >
                      <ArrowLeft className="w-5 h-5 mr-2" />
                      Back to Details
                    </Button>
                    <Button
                      onClick={completeEnrollment}
                      disabled={processing}
                      className="flex-1 h-16 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold shadow-xl shadow-blue-500/30 transition-all active:scale-[0.98]"
                    >
                      {processing ? (
                        <Loader2 className="w-6 h-6 mr-2 animate-spin" />
                      ) : (
                        <Check className="w-6 h-6 mr-2" />
                      )}
                      Complete Enrollment
                    </Button>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="flex flex-col items-center text-center py-10 space-y-8 animate-in fade-in zoom-in duration-700">
                  <div className="relative">
                    <div className="w-32 h-32 rounded-full bg-green-50 dark:bg-green-900/20 flex items-center justify-center">
                      <CheckCircle2 className="w-16 h-16 text-green-500" />
                    </div>
                    <div className="absolute -top-2 -right-2 w-12 h-12 rounded-2xl bg-white dark:bg-gray-800 shadow-xl flex items-center justify-center animate-bounce">
                      <span className="text-2xl">🎉</span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-3xl font-black text-gray-900 dark:text-gray-100 tracking-tight">Success!</h3>
                    <p className="text-gray-500 dark:text-gray-400 max-w-sm mx-auto font-medium">
                      <span className="text-gray-900 dark:text-white font-bold">{createdStudentName}</span> has been successfully enrolled in <span className="text-gray-900 dark:text-white font-bold">{section}</span>.
                    </p>
                  </div>

                  {(capturedImages.length > 0 || uploadedPhoto) && (
                    <div className="flex gap-3 flex-wrap justify-center p-6 bg-gray-50 dark:bg-gray-800/50 rounded-3xl border border-gray-100 dark:border-gray-800">
                      {uploadedPhoto && (
                        <img src={uploadedPhoto} alt="Profile" className="w-16 h-16 rounded-2xl object-cover shadow-lg border-2 border-white dark:border-gray-800" />
                      )}
                      {capturedImages.slice(0, 4).map((img, i) => (
                        <img key={i} src={img} alt={`Capture ${i + 1}`}
                          className="w-16 h-16 rounded-2xl object-cover shadow-lg border-2 border-white dark:border-gray-800" />
                      ))}
                      {capturedImages.length > 4 && (
                        <div className="w-16 h-16 rounded-2xl bg-white dark:bg-gray-800 flex items-center justify-center text-blue-600 dark:text-blue-400 text-sm font-black border-2 border-white dark:border-gray-800 shadow-lg">
                          +{capturedImages.length - 4}
                        </div>
                      )}
                    </div>
                  )}

                  <Button
                    onClick={resetForm}
                    className="h-16 px-10 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold shadow-xl shadow-blue-500/30 transition-all active:scale-[0.98]"
                  >
                    <UserPlus className="w-5 h-5 mr-2" />
                    Enroll Another Student
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
