import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuestions, useSubmitExam } from "@/hooks/use-exam";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useQuery } from "@tanstack/react-query";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Timer, CheckCircle, ChevronLeft, ChevronRight, AlertCircle, Grid } from "lucide-react";
import { cn } from "@/lib/utils";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import appLogo from "@assets/generated_images/official_logo_for_ujian_kita_application.png";

export default function Exam() {
  const { data: questions, isLoading } = useQuestions();
  const { mutate: submitExam, isPending: isSubmitting } = useSubmitExam();
  const [, setLocation] = useLocation();

  const selectedCourseName = localStorage.getItem("exam_selected_course");

  const [currentIndex, setCurrentIndex] = useState(() => {
    const saved = localStorage.getItem("exam_current_index");
    return saved ? parseInt(saved) : 0;
  });
  const [answers, setAnswers] = useState<Record<string, any>>(() => {
    const saved = localStorage.getItem("exam_answers");
    return saved ? JSON.parse(saved) : {};
  });
  const [shuffledQuestions, setShuffledQuestions] = useState<any[]>(() => {
    const saved = localStorage.getItem("exam_shuffled_questions");
    return saved ? JSON.parse(saved) : [];
  });
  const [shuffledOptionsMap, setShuffledOptionsMap] = useState<Record<number, { options: string[], originalToShuffled: Record<number, number>, shuffledToOriginal: Record<number, number> } | { rightOptions: string[] }>>(() => {
    const saved = localStorage.getItem("exam_shuffled_options");
    return saved ? JSON.parse(saved) : {};
  });
  const { data: settings } = useQuery<any>({ queryKey: ["/api/admin/settings"] });
  const logoToDisplay = settings?.appLogo || appLogo;

  const [timeLeft, setTimeLeft] = useState(() => {
    const saved = localStorage.getItem("exam_time_left");
    return saved ? parseInt(saved) : (60 * 60);
  });
  const [showConfirm, setShowConfirm] = useState(false);
  const [viewMode, setViewMode] = useState<'single' | 'list'>('single');

  // Shuffle logic
  useEffect(() => {
    if (questions && questions.length > 0 && shuffledQuestions.length === 0) {
      // 1. Shuffle Questions
      const qs = [...questions].sort(() => Math.random() - 0.5);
      setShuffledQuestions(qs);

      // 2. Shuffle Options for each question
      const optionsMap: Record<number, any> = {};
      qs.forEach(q => {
        if (q.type === 'multiple_choice' || q.type === 'true_false') {
          const indexedOptions = q.options.map((opt: string, idx: number) => ({ opt, originalIdx: idx }));
          const shuffled = [...indexedOptions].sort(() => Math.random() - 0.5);
          
          const originalToShuffled: Record<number, number> = {};
          const shuffledToOriginal: Record<number, number> = {};
          
          shuffled.forEach((item, sIdx) => {
            originalToShuffled[item.originalIdx] = sIdx;
            shuffledToOriginal[sIdx] = item.originalIdx;
          });

          optionsMap[q.id] = {
            options: shuffled.map(item => item.opt),
            originalToShuffled,
            shuffledToOriginal
          };
        } else if (q.type === 'ordering') {
          // For ordering, we want to shuffle the initial options presented to the user
          // The answers state will store the user's current ordered list
          const shuffled = [...q.options].sort(() => Math.random() - 0.5);
          optionsMap[q.id] = {
            options: shuffled
          };
        } else if (q.type === 'matching') {
          // For matching, shuffle the right side options once and store them
          try {
            const matchingPairs = typeof q.correctText === 'string' 
              ? JSON.parse(q.correctText || "{}") 
              : {};
            const rightOptions = Array.from(new Set(Object.values(matchingPairs) as string[]))
              .sort(() => Math.random() - 0.5);
            optionsMap[q.id] = { rightOptions };
          } catch (e) {
            console.error("Error shuffling matching options:", e);
          }
        }
      });
      setShuffledOptionsMap(optionsMap);

      // Save to localStorage
      localStorage.setItem("exam_shuffled_questions", JSON.stringify(qs));
      localStorage.setItem("exam_shuffled_options", JSON.stringify(optionsMap));
    }
  }, [questions]);

  useEffect(() => {
    if (settings?.examDuration && !localStorage.getItem("exam_time_left")) {
      setTimeLeft(settings.examDuration * 60);
    }
  }, [settings]);

  // Persist state to localStorage
  useEffect(() => {
    localStorage.setItem("exam_current_index", currentIndex.toString());
  }, [currentIndex]);

  useEffect(() => {
    localStorage.setItem("exam_answers", JSON.stringify(answers));
  }, [answers]);

  useEffect(() => {
    localStorage.setItem("exam_time_left", timeLeft.toString());
  }, [timeLeft]);

  // Timer logic
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Warning on refresh/close
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  const handleAnswer = (questionId: number, displayedOptionIndex: number) => {
    // Convert displayed index back to original index for the backend
    const originalIndex = shuffledOptionsMap[questionId] 
      ? shuffledOptionsMap[questionId].shuffledToOriginal[displayedOptionIndex]
      : displayedOptionIndex;
      
    setAnswers(prev => ({ ...prev, [String(questionId)]: originalIndex }));
  };

  const handleSubmit = () => {
    submitExam(answers, {
      onSuccess: (data) => {
        localStorage.removeItem("exam_current_index");
        localStorage.removeItem("exam_answers");
        localStorage.removeItem("exam_time_left");
        localStorage.removeItem("exam_shuffled_questions");
        localStorage.removeItem("exam_shuffled_options");
        setLocation(`/result/${data.id}`);
      }
    });
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const filteredCourseQuestions = questions?.filter(q => {
    if (!selectedCourseName) return true;
    const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
    return q.courseName && normalize(q.courseName) === normalize(selectedCourseName);
  }) || [];

  const progress = filteredCourseQuestions.length > 0 ? (Object.keys(answers).length / filteredCourseQuestions.length) * 100 : 0;

  if (isLoading || (questions && shuffledQuestions.length === 0)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/20">
        <div className="space-y-4 text-center">
          <div className="animate-spin text-primary mx-auto"><Timer className="size-10" /></div>
          <p className="text-muted-foreground font-medium">Memuat soal ujian...</p>
        </div>
      </div>
    );
  }

  if (questions && questions.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/20 p-4">
        <Card className="max-w-md w-full p-8 text-center space-y-6 shadow-xl border-none">
          <div className="size-20 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto">
            <AlertCircle className="size-10" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold">Ujian Belum Tersedia</h2>
            <p className="text-muted-foreground">
              Mohon maaf, soal untuk mata kuliah <span className="font-bold text-foreground">"{localStorage.getItem("exam_selected_course")}"</span> belum diinput oleh panitia.
            </p>
          </div>
          <Button onClick={() => setLocation("/biodata")} variant="outline" className="w-full">
            Kembali ke Biodata
          </Button>
        </Card>
      </div>
    );
  }

  if (!shuffledQuestions.length) return null;

  const currentQuestion = shuffledQuestions[currentIndex];
  if (!currentQuestion) return null;

  const currentOptions = shuffledOptionsMap[currentQuestion.id]?.options || currentQuestion.options;
  const currentAnswerOriginalIdx = answers[String(currentQuestion.id)];
  const currentAnswerDisplayedIdx = currentAnswerOriginalIdx !== undefined && shuffledOptionsMap[currentQuestion.id]?.originalToShuffled
    ? shuffledOptionsMap[currentQuestion.id].originalToShuffled[currentAnswerOriginalIdx]
    : currentAnswerOriginalIdx;

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-muted/20 flex flex-col h-screen overflow-hidden select-none" onContextMenu={(e) => e.preventDefault()}>
        {/* Top Bar */}
        <header className="bg-background border-b z-10 shrink-0">
          <div className="container mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img src={logoToDisplay} alt="Ujian Kita" className="h-8 w-auto hidden sm:block object-contain" />
              <div className="font-mono text-2xl font-bold text-primary flex items-center gap-2 bg-primary/5 px-4 py-1.5 rounded-lg border border-primary/10">
                <Timer className="size-5" />
                {formatTime(timeLeft)}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="hidden md:flex flex-col items-end mr-4">
                <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">Progress</span>
                <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 transition-all duration-500" style={{ width: `${progress}%` }} />
                </div>
              </div>
              
              <Button 
                variant="destructive" 
                onClick={() => setShowConfirm(true)}
                className="shadow-lg shadow-destructive/20 hover:shadow-xl hover:shadow-destructive/30"
              >
                Selesai Ujian
              </Button>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* Question List Sidebar (Desktop) */}
          <aside className="w-80 bg-background border-r overflow-y-auto hidden lg:block p-6 pb-20">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              <Grid className="size-5 text-muted-foreground" />
              Daftar Soal
            </h3>
            <div className="grid grid-cols-4 gap-3">
              {shuffledQuestions.map((q, idx) => {
                const isAnswered = answers[String(q.id)] !== undefined;
                const isCurrent = currentIndex === idx;
                
                return (
                  <button
                    key={q.id}
                    onClick={() => setCurrentIndex(idx)}
                    className={cn(
                      "aspect-square rounded-xl font-bold text-sm transition-all border-2",
                      isCurrent 
                        ? "border-primary bg-primary text-primary-foreground shadow-lg shadow-primary/25 scale-105" 
                        : isAnswered 
                          ? "border-green-500 bg-green-50 text-green-700 hover:bg-green-100" 
                          : "border-border bg-card hover:border-primary/50 text-muted-foreground"
                    )}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
          </aside>

          {/* Active Question Area */}
          <main className="flex-1 overflow-y-auto p-4 md:p-8 lg:p-12 relative">
            <div className="max-w-3xl mx-auto pb-24">
              <div className="mb-6 flex justify-between items-center lg:hidden">
                 <span className="text-sm font-bold text-muted-foreground">
                   Soal {currentIndex + 1} dari {shuffledQuestions.length}
                 </span>
                 {/* Mobile grid toggle could go here */}
              </div>

              <Card className="border-none shadow-xl shadow-black/5 overflow-hidden">
                <div className="bg-primary/5 border-b border-primary/10 px-6 py-4 flex items-center justify-between">
                  <h2 className="font-display font-bold text-xl text-primary">
                    Soal No. {currentIndex + 1}
                  </h2>
                  {answers[String(currentQuestion.id)] !== undefined && (
                    <span className="flex items-center gap-1.5 text-xs font-bold text-green-600 bg-green-100 px-3 py-1 rounded-full">
                      <CheckCircle className="size-3.5" />
                      Terjawab
                    </span>
                  )}
                </div>
                
                  <div className="p-6 md:p-8">
                    <p className="text-lg md:text-xl font-medium leading-relaxed mb-8 text-foreground/90">
                      {currentQuestion.text}
                    </p>

                    {currentQuestion.type === "essay" ? (
                      <div className="space-y-4">
                        <Label className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
                          Jawaban Uraian
                        </Label>
                        <Textarea 
                          placeholder="Ketik jawaban lengkap Anda di sini..."
                          value={answers[String(currentQuestion.id)] || ""}
                          onChange={(e) => setAnswers(prev => ({ ...prev, [String(currentQuestion.id)]: e.target.value }))}
                          className="min-h-[200px] text-lg leading-relaxed focus-visible:ring-primary/20"
                        />
                      </div>
                    ) : currentQuestion.type === "matching" ? (
                      <div className="space-y-4">
                        <Label className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
                          Menjodohkan
                        </Label>
                        <div className="grid grid-cols-1 gap-4">
                          {(() => {
                            const matchingPairs = typeof currentQuestion.correctText === 'string' 
                              ? JSON.parse(currentQuestion.correctText || "{}") 
                              : {};
                            const leftItems = Object.keys(matchingPairs);
                            
                            // Use stored shuffled options if available, fallback to live shuffle only as safety
                            const storedData = shuffledOptionsMap[currentQuestion.id] as any;
                            const rightOptions = storedData?.rightOptions || 
                              Array.from(new Set(Object.values(matchingPairs) as string[]));

                            return leftItems.map((left, idx) => (
                              <div key={idx} className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-xl border-2 border-border bg-card">
                                <span className="font-medium flex-1">{left}</span>
                                <Select 
                                  value={answers[String(currentQuestion.id)]?.[left] || ""}
                                  onValueChange={(val) => {
                                    const currentAnswers = answers[String(currentQuestion.id)] || {};
                                    setAnswers(prev => ({ 
                                      ...prev, 
                                      [String(currentQuestion.id)]: { ...currentAnswers, [left]: val }
                                    }));
                                  }}
                                >
                                  <SelectTrigger className="w-full sm:w-[250px]">
                                    <SelectValue placeholder="Pilih Pasangan" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {rightOptions.map((rOpt: string, rIdx: number) => (
                                      <SelectItem key={rIdx} value={rOpt}>{rOpt}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            ));
                          })()}
                        </div>
                      </div>
                    ) : currentQuestion.type === "ordering" ? (
                      <div className="space-y-4">
                        <Label className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
                          Urutkan (Klik panah untuk memindah posisi)
                        </Label>
                        <div className="space-y-2">
                          {((answers[String(currentQuestion.id)] as string[]) || currentOptions).map((opt: string, idx: number, arr: string[]) => (
                            <div key={idx} className="flex items-center gap-3 p-4 rounded-xl border-2 border-border bg-card">
                              <div className="size-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold">
                                {idx + 1}
                              </div>
                              <span className="flex-1 font-medium">{opt}</span>
                              <div className="flex flex-col gap-1">
                                <Button 
                                  size="icon" 
                                  variant="ghost" 
                                  className="size-8"
                                  disabled={idx === 0}
                                  onClick={() => {
                                    const newArr = [...arr];
                                    [newArr[idx-1], newArr[idx]] = [newArr[idx], newArr[idx-1]];
                                    setAnswers(prev => ({ ...prev, [String(currentQuestion.id)]: newArr }));
                                  }}
                                >
                                  <ChevronLeft className="rotate-90 size-4" />
                                </Button>
                                <Button 
                                  size="icon" 
                                  variant="ghost" 
                                  className="size-8"
                                  disabled={idx === arr.length - 1}
                                  onClick={() => {
                                    const newArr = [...arr];
                                    [newArr[idx+1], newArr[idx]] = [newArr[idx], newArr[idx+1]];
                                    setAnswers(prev => ({ ...prev, [String(currentQuestion.id)]: newArr }));
                                  }}
                                >
                                  <ChevronLeft className="-rotate-90 size-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : currentQuestion.type === "short_answer" ? (
                      <div className="space-y-4">
                        <Label htmlFor="short-answer" className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
                          Jawaban Singkat
                        </Label>
                        <Input 
                          id="short-answer"
                          placeholder="Ketik jawaban singkat di sini..."
                          value={answers[String(currentQuestion.id)] || ""}
                          onChange={(e) => setAnswers(prev => ({ ...prev, [String(currentQuestion.id)]: e.target.value }))}
                          className="h-14 text-lg font-medium bg-muted/30 border-2 focus-visible:ring-primary/20"
                        />
                      </div>
                    ) : (
                      <RadioGroup 
                        value={currentAnswerDisplayedIdx?.toString()} 
                        onValueChange={(val) => handleAnswer(currentQuestion.id, parseInt(val))}
                        className="space-y-3"
                      >
                        {currentOptions.map((opt: string, idx: number) => (
                          <div key={idx} className="relative">
                            <RadioGroupItem value={idx.toString()} id={`opt-${idx}`} className="peer sr-only" />
                            <Label 
                              htmlFor={`opt-${idx}`}
                              className="flex items-center gap-4 p-4 rounded-xl border-2 border-border cursor-pointer transition-all hover:bg-muted/5 hover:border-primary peer-focus-visible:ring-0 peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 peer-data-[state=checked]:shadow-md [&:not(:hover)]:border-border"
                            >
                              <div className="size-8 rounded-lg border-2 border-muted-foreground/30 flex items-center justify-center font-bold text-muted-foreground peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary peer-data-[state=checked]:text-primary-foreground transition-colors shrink-0">
                                {currentQuestion.type === "true_false" ? (idx === 0 ? "B" : "S") : String.fromCharCode(65 + idx)}
                              </div>
                              <span className="text-base font-medium">{opt}</span>
                            </Label>
                          </div>
                        ))}
                      </RadioGroup>
                    )}
                  </div>
              </Card>

              {/* Navigation Buttons */}
              <div className="mt-8 flex justify-between items-center">
                <Button 
                  variant="outline" 
                  size="lg"
                  onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                  disabled={currentIndex === 0}
                  className="rounded-xl border-2"
                >
                  <ChevronLeft className="mr-2 size-5" />
                  Sebelumnya
                </Button>

                {currentIndex === shuffledQuestions.length - 1 ? (
                  <Button 
                    size="lg" 
                    onClick={() => setShowConfirm(true)}
                    className="bg-green-600 hover:bg-green-700 text-white rounded-xl shadow-lg shadow-green-600/20"
                  >
                    Selesai & Kumpulkan
                    <CheckCircle className="ml-2 size-5" />
                  </Button>
                ) : (
                  <Button 
                    size="lg"
                    onClick={() => setCurrentIndex(prev => Math.min(shuffledQuestions.length - 1, prev + 1))}
                    className="rounded-xl shadow-lg shadow-primary/20"
                  >
                    Selanjutnya
                    <ChevronRight className="ml-2 size-5" />
                  </Button>
                )}
              </div>
            </div>
          </main>
        </div>

        {/* Submission Dialog */}
        <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                <AlertCircle className="size-5" />
                Konfirmasi Selesai Ujian
              </AlertDialogTitle>
              <AlertDialogDescription>
                Apakah Anda yakin ingin mengakhiri ujian? 
                <br /><br />
                <span className="font-medium text-foreground">
                  {Object.keys(answers).length} dari {shuffledQuestions.length} soal telah dijawab.
                </span>
                <br />
                Jawaban tidak dapat diubah setelah dikumpulkan.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Kembali Mengerjakan</AlertDialogCancel>
              <AlertDialogAction onClick={handleSubmit} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                {isSubmitting ? "Mengirim..." : "Ya, Kumpulkan Jawaban"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </ProtectedRoute>
  );
}
