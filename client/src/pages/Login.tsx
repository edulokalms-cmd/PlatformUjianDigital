import { useState } from "react";
import { useLocation } from "wouter";
import { useLogin } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import defaultLogo from "@/assets/logo.png";

export default function Login() {
  const { data: settings } = useQuery<any>({ 
    queryKey: ["/api/admin/settings"],
  });
  const appLogo = settings?.appLogo || defaultLogo;

  const [nim, setNim] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [, setLocation] = useLocation();
  const { mutate, isPending } = useLogin();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nim.trim()) return;

    mutate({ nim, password: showPassword ? password : undefined }, {
      onSuccess: (data: any) => {
        if (data.isAdmin && data.requiresPassword) {
          setShowPassword(true);
          return;
        }

        if (data.isAdmin) {
          setLocation("/admin");
          return;
        }

        if (data.activeSubmissionId) {
          setLocation("/exam");
        } else if (data.hasBiodata) {
          setLocation("/instructions");
        } else {
          setLocation("/biodata");
        }
      }
    });
  };
  return (
    <div className="min-h-screen w-full flex bg-muted/30">
      {/* Left Panel - Hero */}
      <div className="hidden lg:flex w-1/2 bg-primary relative overflow-hidden items-center justify-center p-12">
        <div className="absolute inset-0 bg-gradient-to-br from-teal-600 to-teal-900 z-0" />
        <div className="relative z-10 max-w-lg text-primary-foreground">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="mb-6 inline-flex p-3 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20">
              <img src={appLogo} alt="Ujian Kita Logo" className="h-12 w-auto brightness-0 invert" />
            </div>
            <h1 className="text-5xl font-display font-bold mb-6 leading-tight">
              Platform Ujian Digital Terpadu
            </h1>
            <p className="text-lg text-primary-foreground/80 font-medium leading-relaxed">
              Selamat datang di sistem ujian berbasis komputer. Silakan login untuk mengakses modul ujian Anda. Pastikan koneksi internet stabil.
            </p>
          </motion.div>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="w-full max-w-md"
        >
          <Card className="border-none shadow-2xl shadow-primary/5">
            <CardHeader className="space-y-4 pb-8">
              <div className="flex justify-center mb-4 px-2">
                <img src={appLogo} alt="Ujian Kita Logo" className="w-full h-auto max-w-[280px]" />
              </div>
              <div>
                <CardTitle className="text-2xl font-bold">Masuk Ujian</CardTitle>
                <CardDescription className="text-base mt-2">
                  Masukkan Nomor Pokok Mahasiswa (NPM) Anda untuk melanjutkan.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label htmlFor="nim" className="text-sm font-medium text-foreground">
                    NPM (Nomor Pokok Mahasiswa)
                  </label>
                  <Input
                    id="nim"
                    placeholder="Contoh: 220305006"
                    value={nim}
                    onChange={(e) => setNim(e.target.value)}
                    className="h-12 px-4 bg-muted/30 border-input transition-all focus:ring-4 focus:ring-primary/10"
                    autoFocus
                  />
                </div>

                {showPassword && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="space-y-2"
                  >
                    <label htmlFor="password" className="text-sm font-medium text-foreground">
                      Password Panitia
                    </label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="Masukkan password admin"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-12 px-4 bg-muted/30 border-input transition-all focus:ring-4 focus:ring-primary/10"
                    />
                  </motion.div>
                )}
                
                <Button 
                  type="submit" 
                  className="w-full h-12 text-base font-semibold shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all"
                  disabled={isPending || !nim}
                >
                  {isPending ? "Memproses..." : (
                    <span className="flex items-center gap-2">
                      Lanjutkan <ArrowRight className="size-4" />
                    </span>
                  )}
                </Button>

                <p className="text-xs text-center text-muted-foreground mt-6">
                  Jika mengalami kendala login, silakan hubungi pengawas ujian.
                </p>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
