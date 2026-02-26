import { useRoute, useLocation } from "wouter";
import { useExamResult } from "@/hooks/use-exam";
import { useAuthStore } from "@/hooks/use-auth";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, XCircle, Home, Printer, Award } from "lucide-react";
import { motion } from "framer-motion";

export default function Result() {
  const [, params] = useRoute("/result/:id");
  const submissionId = parseInt(params?.id || "0");
  const { data: result, isLoading } = useExamResult(submissionId);
  const { student } = useAuthStore();
  const [, setLocation] = useLocation();

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!result) return <div>Result not found</div>;

  const score = result.score || 0;
  const isPassed = score >= 70; // Example passing grade

  return (
    <div className="min-h-screen bg-muted/20">
      <Header />
      
      <main className="container mx-auto px-4 py-12 max-w-3xl">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          <Card className="overflow-hidden border-none shadow-2xl">
            <div className={`h-32 ${isPassed ? 'bg-green-500' : 'bg-orange-500'} relative flex items-center justify-center overflow-hidden`}>
              <div className="absolute inset-0 bg-white/10 opacity-50 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white/20 to-transparent" />
              <Award className="size-16 text-white relative z-10" />
            </div>

            <CardContent className="text-center pt-12 pb-12 px-8">
              <h1 className="text-3xl font-display font-bold mb-2">Hasil Ujian Anda</h1>
              <p className="text-muted-foreground mb-8">
                {student?.fullName} • {student?.className}
              </p>

              <div className="grid grid-cols-2 gap-4 max-w-md mx-auto mb-10">
                <div className="bg-muted/30 p-6 rounded-2xl border border-border">
                  <span className="block text-sm font-medium text-muted-foreground mb-1">Skor Akhir</span>
                  <span className={`text-4xl font-bold ${isPassed ? 'text-green-600' : 'text-orange-600'}`}>
                    {score}
                  </span>
                </div>
                <div className="bg-muted/30 p-6 rounded-2xl border border-border">
                  <span className="block text-sm font-medium text-muted-foreground mb-1">Status</span>
                  <div className="flex items-center justify-center gap-2 mt-1">
                    {isPassed ? (
                      <>
                        <CheckCircle2 className="size-6 text-green-600" />
                        <span className="text-xl font-bold text-foreground">Lulus</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="size-6 text-orange-600" />
                        <span className="text-xl font-bold text-foreground">Remedial</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <Button 
                  onClick={() => window.print()} 
                  variant="outline" 
                  className="w-full sm:w-auto mr-0 sm:mr-4 border-2"
                >
                  <Printer className="mr-2 size-4" />
                  Cetak Hasil
                </Button>
                <Button 
                  onClick={() => setLocation("/")}
                  className="w-full sm:w-auto shadow-lg shadow-primary/20"
                >
                  <Home className="mr-2 size-4" />
                  Kembali ke Beranda
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </main>
    </div>
  );
}
