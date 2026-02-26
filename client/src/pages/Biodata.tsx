import { useState } from "react";
import { useLocation } from "wouter";
import { useUpdateBiodata } from "@/hooks/use-auth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserCircle, School, ChevronRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

export default function Biodata() {
  const [fullName, setFullName] = useState("");
  const [className, setClassName] = useState("");
  const { mutate, isPending } = useUpdateBiodata();
  const [, setLocation] = useLocation();
  const { data: settings } = useQuery<any>({ queryKey: ["/api/admin/settings"] });

  const [courseName, setCourseName] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !className || !courseName) return;

    localStorage.setItem("exam_selected_course", courseName);
    mutate({ fullName, className, course: courseName }, {
      onSuccess: () => setLocation("/instructions")
    });
  };

  const availableClasses = settings?.availableClasses || ["Pendidikan Informatika A", "Pendidikan Informatika B", "Pendidikan Informatika C"];
  const availableCourses = settings?.availableCourses || ["Etika Profesi", "Sistem Jaringan", "Pemrograman Dasar"];

  const { data: questions } = useQuery<any[]>({ queryKey: ["/api/admin/questions"] });
  
  // Normalize course names for comparison
  const normalize = (s: string) => s.trim().toLowerCase();

  return (
    <ProtectedRoute requireBiodata={false}>
      <div className="min-h-screen bg-muted/20 pb-20">
        <Header />
        
        <main className="container mx-auto px-4 pt-12 max-w-2xl">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-display font-bold text-foreground">Lengkapi Data Diri</h1>
            <p className="text-muted-foreground mt-2 text-lg">
              Data ini akan digunakan sebagai identitas pada lembar jawaban ujian Anda.
            </p>
          </div>

          <Card className="shadow-xl shadow-black/5 border-border/60">
            <CardHeader className="bg-muted/30 border-b border-border/50 pb-8">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white rounded-xl shadow-sm border border-border/50">
                  <UserCircle className="size-8 text-primary" />
                </div>
                <div>
                  <CardTitle>Formulir Biodata</CardTitle>
                  <CardDescription>Mohon isi data dengan sebenar-benarnya.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-8">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold flex items-center gap-2">
                      <UserCircle className="size-4 text-muted-foreground" />
                      Nama Lengkap
                    </label>
                    <Input 
                      placeholder="Masukkan nama lengkap" 
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="h-11 bg-muted/20"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-semibold flex items-center gap-2">
                      <School className="size-4 text-muted-foreground" />
                      Mata Kuliah / Ujian
                    </label>
                    <Select value={courseName} onValueChange={setCourseName}>
                      <SelectTrigger className="h-11 bg-muted/20">
                        <SelectValue placeholder="Pilih Mata Kuliah" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableCourses.map((course: string) => {
                          const normalizedCourse = normalize(course);
                          const hasQuestions = questions?.some(q => q.courseName && normalize(q.courseName) === normalizedCourse);
                          const isExplicitlyActive = settings?.activeCourses?.some((c: string) => normalize(c) === normalizedCourse);
                          const isActive = isExplicitlyActive && hasQuestions;
                          
                          return (
                            <SelectItem key={course} value={course} disabled={!isActive}>
                              <div className="flex items-center justify-between w-full gap-4">
                                <span>{course}</span>
                                {!isActive && (
                                  <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded uppercase font-bold">
                                    {!isExplicitlyActive ? "Tidak Aktif" : "Belum Ada Soal"}
                                  </span>
                                )}
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold flex items-center gap-2">
                      <School className="size-4 text-muted-foreground" />
                      Kelas / Jurusan
                    </label>
                    <Select value={className} onValueChange={setClassName}>
                      <SelectTrigger className="h-11 bg-muted/20">
                        <SelectValue placeholder="Pilih Kelas / Jurusan" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableClasses.map((cls: string) => (
                          <SelectItem key={cls} value={cls}>{cls}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="pt-4 flex justify-end">
                  <Button 
                    type="submit" 
                    size="lg" 
                    className="w-full md:w-auto font-semibold shadow-lg shadow-primary/20 hover:-translate-y-0.5 transition-all"
                    disabled={!fullName || !className || !courseName || isPending}
                  >
                    {isPending ? "Menyimpan..." : (
                      <>
                        Simpan & Lanjutkan
                        <ChevronRight className="ml-2 size-4" />
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </main>
      </div>
    </ProtectedRoute>
  );
}
