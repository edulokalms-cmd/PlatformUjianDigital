import { useLocation } from "wouter";
import { useStartExam } from "@/hooks/use-exam";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, Clock, FileText, CheckCircle2, PlayCircle } from "lucide-react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export default function Instructions() {
  const { mutate, isPending } = useStartExam();
  const [, setLocation] = useLocation();
  const { data: questions } = useQuery<any[]>({ queryKey: ["/api/exam/questions"] });
  const { data: settings } = useQuery<any>({ queryKey: ["/api/admin/settings"] });

  const { toast } = useToast();

  const handleStart = () => {
    mutate(undefined, {
      onSuccess: () => setLocation("/exam"),
      onError: (error: any) => {
        toast({
          variant: "destructive",
          title: "Akses Ditolak",
          description: error.message || "Anda tidak diizinkan memulai ujian kembali."
        });
      }
    });
  };

  const selectedCourse = localStorage.getItem("exam_selected_course") || "";
  const courseDuration = settings?.courseDurations?.[selectedCourse] || settings?.examDuration || 60;
  const courseQuestions = questions?.filter(q => q.courseName?.toLowerCase() === selectedCourse.toLowerCase()) || [];

  const rules = [
    { icon: Clock, title: "Waktu Pengerjaan", desc: `Anda memiliki waktu ${courseDuration} menit untuk mengerjakan soal.` },
    { icon: FileText, title: "Jumlah Soal", desc: `Terdapat ${courseQuestions.length} butir soal yang harus dikerjakan.` },
    { icon: AlertTriangle, title: "Dilarang Curang", desc: settings?.antiCheatingNote || "Dilarang membuka tab lain atau aplikasi lain selama ujian." },
    { icon: CheckCircle2, title: "Penyimpanan", desc: settings?.storageNote || "Jawaban akan tersimpan otomatis setiap Anda berpindah soal." },
  ];

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-muted/20">
        <Header />
        
        <main className="container mx-auto px-4 py-12 max-w-4xl">
          <div className="text-center mb-10">
            <span className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary font-bold text-sm mb-4">
              PENTING
            </span>
            <h1 className="text-4xl font-display font-bold text-foreground">Petunjuk Pengerjaan Ujian</h1>
            <p className="text-muted-foreground mt-4 text-lg max-w-2xl mx-auto">
              {settings?.instructions || "Mohon baca instruksi di bawah ini dengan seksama sebelum memulai sesi ujian Anda."}
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-10">
            {rules.map((rule, idx) => (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
              >
                <Card className="h-full border-none shadow-md hover:shadow-lg transition-all duration-300 group">
                  <CardContent className="p-6 flex items-start gap-4">
                    <div className="p-3 rounded-xl bg-primary/5 group-hover:bg-primary/10 transition-colors text-primary">
                      <rule.icon className="size-6" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg mb-1">{rule.title}</h3>
                      <p className="text-muted-foreground leading-relaxed">{rule.desc}</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          <div className="flex flex-col items-center gap-4">
            <Button 
              size="lg" 
              onClick={handleStart}
              disabled={isPending}
              className="px-12 py-8 text-xl rounded-2xl shadow-xl shadow-primary/25 hover:shadow-2xl hover:shadow-primary/30 hover:-translate-y-1 transition-all duration-300"
            >
              {isPending ? "Menyiapkan Soal..." : (
                <span className="flex items-center gap-3">
                  <PlayCircle className="size-6" />
                  Mulai Kerjakan Ujian Sekarang
                </span>
              )}
            </Button>
            <p className="text-sm text-muted-foreground">
              Dengan menekan tombol di atas, waktu ujian akan segera dimulai.
            </p>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
