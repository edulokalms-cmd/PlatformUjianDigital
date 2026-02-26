import React, { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter 
} from "@/components/ui/card";
import { 
  Tabs, TabsContent, TabsList, TabsTrigger 
} from "@/components/ui/tabs";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuthStore } from "@/hooks/use-auth";
import { 
  Plus, Trash2, Edit, Save, Download, Upload, 
  Users, BookOpen, Settings, CheckCircle, Clock, 
  FileText, Loader2, X, FileDown, UserPlus, GraduationCap,
  ChevronRight, LogOut, AlertCircle, Search
} from "lucide-react";
import { cn } from "@/lib/utils";
import * as XLSX from 'xlsx';
import { jsPDF } from "jspdf";
import autoTable from 'jspdf-autotable';
import defaultLogo from "@/assets/logo.png";

export default function AdminDashboard() {
  const { toast } = useToast();
  const { logout, student: currentUser } = useAuthStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isAddingQuestion, setIsAddingQuestion] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<any>(null);
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const [newQuestion, setNewQuestion] = useState({
    text: "",
    type: "multiple_choice",
    options: ["", "", "", ""],
    correctIndex: 0,
    correctText: "",
    points: 3,
    courseName: ""
  });

  const [newUser, setNewUser] = useState({
    nim: "",
    fullName: "",
    className: "",
    isAdmin: false,
    role: "student" as "student" | "admin" | "pengawas",
    password: ""
  });

  const [isImporting, setIsImporting] = useState(false);

  const [settingsForm, setSettingsForm] = useState({
    examTitle: "",
    examDuration: 60,
    instructions: "",
    antiCheatingNote: "",
    storageNote: "",
    passingScore: 70,
    availableClasses: [] as string[],
    availableCourses: [] as string[],
    activeCourses: [] as string[],
    courseDurations: {} as Record<string, number>,
    appLogo: ""
  });

  const { data: settings, isLoading: loadingSettings } = useQuery<any>({ 
    queryKey: ["/api/admin/settings"],
  });

  useEffect(() => {
    if (settings) {
      setSettingsForm({
        examTitle: settings.examTitle,
        examDuration: settings.examDuration,
        instructions: settings.instructions,
        antiCheatingNote: settings.antiCheatingNote || "",
        storageNote: settings.storageNote || "",
        passingScore: settings.passingScore || 70,
        availableClasses: settings.availableClasses || [],
        availableCourses: settings.availableCourses || [],
        activeCourses: settings.activeCourses || [],
        courseDurations: settings.courseDurations || {},
        appLogo: settings.appLogo || ""
      });
    }
  }, [settings]);

  const { data: students, isLoading: loadingStudents } = useQuery<any[]>({
    queryKey: ["/api/admin/students"],
  });

  const { data: submissions, isLoading: loadingSubmissions } = useQuery<any[]>({
    queryKey: ["/api/admin/submissions"],
  });

  const { data: questions, isLoading: loadingQuestions } = useQuery<any[]>({
    queryKey: ["/api/admin/questions"],
  });

  const { data: archivedSubmissions, isLoading: loadingArchived } = useQuery<any[]>({
    queryKey: ["/api/admin/submissions/archived"],
  });

  const [classFilter, setClassFilter] = useState<string>("all");
  const [courseFilter, setCourseFilter] = useState<string>("all");

  const classes = settings?.availableClasses || [];
  const availableCourses = settings?.availableCourses || [];

  const filteredQuestions = questions?.filter(q => {
    if (courseFilter === "all") return true;
    return q.courseName?.toLowerCase() === courseFilter.toLowerCase();
  });

  const [submissionSearch, setSubmissionSearch] = useState("");
  const [userSearch, setUserSearch] = useState("");

  const filteredSubmissions = submissions?.map(sub => {
    // If sub is { submission: {...}, student: {...} } or just the flat object
    const actualSub = sub.submission || sub;
    const s = students?.find(st => st.id === actualSub.studentId);
    return {
      ...actualSub,
      student: s || sub.student
    };
  }).filter(sub => {
    if (classFilter !== "all" && sub.student?.className !== classFilter) return false;
    
    if (submissionSearch) {
      const search = submissionSearch.toLowerCase();
      const nim = (sub.student?.nim || "").toLowerCase();
      const name = (sub.student?.fullName || "").toLowerCase();
      return nim.includes(search) || name.includes(search);
    }
    
    return true;
  });

  const [userClassFilter, setUserClassFilter] = useState<string>("all");
  const filteredStudents = students?.filter(u => {
    if (userClassFilter !== "all" && u.className !== userClassFilter) return false;
    if (!userSearch) return true;
    const search = userSearch.toLowerCase();
    const nim = (u.nim || "").toLowerCase();
    const name = (u.fullName || "").toLowerCase();
    const className = (u.className || "").toLowerCase();
    return nim.includes(search) || name.includes(search) || className.includes(search);
  });

  const [viewingReport, setViewingReport] = useState<any>(null);
  const { data: reportDetails, isLoading: loadingReport } = useQuery<any>({
    queryKey: [`/api/admin/submissions/${viewingReport?.id}/details`],
    enabled: !!viewingReport,
  });

  const [isBulkResetOpen, setIsBulkResetOpen] = useState(false);
  const [bulkResetClass, setBulkResetClass] = useState<string>("all");
  const [bulkResetCourse, setBulkResetCourse] = useState<string>("all");
  const [resetType, setResetType] = useState<"all" | "remedial">("all");
  const [minScoreThreshold, setMinScoreThreshold] = useState<number>(70);
  const [isResetting, setIsResetting] = useState(false);

  const handleBulkReset = async () => {
    const threshold = settings?.passingScore || 70;
    const confirmMsg = resetType === "remedial" 
      ? `Apakah Anda yakin ingin mereset ujian bagi semua siswa ${bulkResetClass === "all" ? "di semua kelas" : `di kelas ${bulkResetClass}`} yang memiliki nilai di bawah ${threshold}?`
      : `Apakah Anda yakin ingin mereset ujian bagi SEMUA siswa ${bulkResetClass === "all" ? "di semua kelas" : `di kelas ${bulkResetClass}`}? Tindakan ini tidak dapat dibatalkan.`;
    
    if (!confirm(confirmMsg)) return;

    setIsResetting(true);
    try {
      await apiRequest("POST", "/api/admin/submissions/bulk-delete", {
        className: bulkResetClass === "all" ? undefined : bulkResetClass,
        courseName: bulkResetCourse === "all" ? undefined : bulkResetCourse,
        maxScore: resetType === "remedial" ? threshold - 1 : undefined
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/submissions"] });
      toast({ title: "Berhasil", description: "Reset masal berhasil dilakukan." });
      setIsBulkResetOpen(false);
    } catch (err) {
      toast({ variant: "destructive", title: "Gagal", description: "Gagal melakukan reset masal." });
    } finally {
      setIsResetting(false);
    }
  };

  const exportToExcel = () => {
    if (!filteredSubmissions || !students) return;

    const data = filteredSubmissions.map((sub, index) => {
      const s = sub.student;
      const isPass = sub.score !== null && sub.score >= (settings?.passingScore || 70);
      return {
        "No": index + 1,
        "NIM": s?.nim || "",
        "Nama": s?.fullName || "",
        "Kelas": s?.className || "",
        "Skor": sub.score !== null ? sub.score : 0,
        "Status": sub.isCompleted ? "Selesai" : "Berlangsung",
        "Keterangan": sub.score !== null ? (isPass ? "LULUS" : "TIDAK LULUS") : "-",
        "Waktu Mulai": sub.startTime ? new Date(sub.startTime).toLocaleString('en-US') : "",
        "Waktu Selesai": sub.endTime ? new Date(sub.endTime).toLocaleString('en-US') : ""
      };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Hasil Ujian");
    XLSX.writeFile(wb, `hasil_ujian_${classFilter === "all" ? "semua_kelas" : classFilter}.xlsx`);
    toast({ title: "Berhasil", description: "Data diexport ke Excel." });
  };

  const exportToPDF = () => {
    if (!filteredSubmissions || !students || !settings) {
      console.error("Cannot export PDF: missing data", { submissions: !!filteredSubmissions, students: !!students, settings: !!settings });
      return;
    }

    const doc = new jsPDF('l', 'mm', 'a4'); 
    const tableColumn = ["No", "NIM", "Nama", "Kelas", "Skor", "Status", "Keterangan", "Waktu Mulai", "Waktu Selesai"];
    const tableRows: any[] = [];

    filteredSubmissions.forEach((sub, index) => {
      const s = sub.student;
      const isPass = sub.score !== null && sub.score >= (settings?.passingScore || 70);
      const rowData = [
        index + 1,
        s?.nim || "",
        s?.fullName || "",
        s?.className || "",
        sub.score !== null ? sub.score : "0",
        sub.isCompleted ? "Selesai" : "Berlangsung",
        sub.score !== null ? (isPass ? "LULUS" : "TIDAK LULUS") : "-",
        sub.startTime ? new Date(sub.startTime).toLocaleString('en-US') : "",
        sub.endTime ? new Date(sub.endTime).toLocaleString('en-US') : ""
      ];
      tableRows.push(rowData);
    });

    doc.setFontSize(18);
    doc.text(settings.examTitle || "Hasil Ujian", 14, 22);
    
    doc.setFontSize(11);
    doc.setTextColor(100);
    const classText = classFilter === "all" ? "Semua Kelas" : `Kelas: ${classFilter}`;
    doc.text(`Laporan Hasil Ujian - ${classText}`, 14, 30);
    doc.text(`Tanggal Cetak: ${new Date().toLocaleString()}`, 14, 36);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 45,
      theme: 'grid',
      headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
      styles: { fontSize: 9 }
    });

    doc.save(`hasil_ujian_${classFilter === "all" ? "semua_kelas" : classFilter}.pdf`);
  };

  const exportToDOCX = async () => {
    try {
      const url = `/api/admin/questions/export?courseName=${courseFilter}`;
      window.open(url, '_blank');
      toast({ title: "Berhasil", description: "File DOCX sedang diunduh." });
    } catch (err) {
      toast({ variant: "destructive", title: "Gagal", description: "Gagal mengunduh file DOCX." });
    }
  };

  const downloadTemplate = () => {
    const templateData = [
      { NIM: "12345678", Nama: "Budi Santoso", Kelas: "PIN 1A", Role: "Mahasiswa", Password: "" },
      { NIM: "admin_test", Nama: "Admin Baru", Kelas: "System", Role: "Admin", Password: "admin" }
    ];
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "template_import_user.xlsx");
    toast({ title: "Template diunduh", description: "Gunakan format ini untuk import data user." });
  };

  const handleEditUser = (u: any) => {
    setEditingUser(u);
    setNewUser({
      nim: u.nim,
      fullName: u.fullName || "",
      className: u.className || "",
      isAdmin: u.isAdmin,
      role: u.role || (u.isAdmin ? "admin" : "student"),
      password: ""
    });
    setIsAddingUser(true);
  };

  const handleDeleteUser = async (id: number) => {
    if (!confirm("Hapus user ini? Semua data terkait juga akan terhapus.")) return;
    try {
      await apiRequest("DELETE", `/api/admin/students/${id}`);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/students"] });
      toast({ title: "Berhasil", description: "User telah dihapus" });
    } catch (err) {
      toast({ variant: "destructive", title: "Gagal", description: "Gagal menghapus user" });
    }
  };

  const handleSaveUser = async () => {
    try {
      const userData = {
        ...newUser,
        createdBy: currentUser?.id
      };
      if (editingUser) {
        await apiRequest("PATCH", `/api/admin/students/${editingUser.id}`, userData);
      } else {
        await apiRequest("POST", "/api/admin/students", userData);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/admin/students"] });
      setIsAddingUser(false);
      setEditingUser(null);
      setNewUser({ nim: "", fullName: "", className: "", isAdmin: false, role: "student", password: "" });
      toast({ title: "Berhasil", description: editingUser ? "Data user diperbarui" : "User baru ditambahkan" });
    } catch (err) {
      toast({ variant: "destructive", title: "Gagal", description: "Gagal menyimpan user" });
    }
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);
        
        for (const row of data as any[]) {
          const user = {
            nim: String(row.NIM || ""),
            fullName: String(row.Nama || ""),
            className: String(row.Kelas || ""),
            isAdmin: String(row.Role || "").toLowerCase() === "admin",
            password: String(row.Password || "")
          };
          if (user.nim) {
            await apiRequest("POST", "/api/admin/students", user);
          }
        }
        
        queryClient.invalidateQueries({ queryKey: ["/api/admin/students"] });
        toast({ title: "Berhasil", description: "Import data user selesai." });
        setIsImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      };
      reader.readAsBinaryString(file);
    } catch (err) {
      toast({ variant: "destructive", title: "Gagal", description: "Gagal import data" });
      setIsImporting(false);
    }
  };

  const handleUpdateSettings = async () => {
    setIsSavingSettings(true);
    try {
      await apiRequest("PATCH", "/api/admin/settings", settingsForm);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
      toast({ title: "Berhasil", description: "Pengaturan telah diperbarui" });
    } catch (err) {
      toast({ variant: "destructive", title: "Gagal", description: "Gagal memperbarui pengaturan" });
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleDeleteSubmission = async (id: number) => {
    if (!confirm("Apakah Anda yakin ingin memberikan kesempatan ujian ulang untuk siswa ini? Data ujian sebelumnya akan dihapus.")) return;
    try {
      await apiRequest("DELETE", `/api/admin/submissions/${id}`);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/submissions"] });
      toast({ title: "Berhasil", description: "Siswa sekarang dapat mengikuti ujian ulang." });
    } catch (err) {
      toast({ variant: "destructive", title: "Gagal", description: "Gagal mengizinkan ujian ulang." });
    }
  };

  const handleEditQuestion = (q: any) => {
    setEditingQuestion(q);
    setNewQuestion({
      text: q.text,
      type: q.type,
      options: q.options || ["", "", "", ""],
      correctIndex: q.correctIndex || 0,
      correctText: q.correctText || "",
      points: q.points || 3,
      courseName: q.courseName || ""
    });
    setIsAddingQuestion(true);
  };

  const handleSaveQuestion = async () => {
    try {
      const questionData = {
        ...newQuestion,
        courseName: newQuestion.courseName || (courseFilter !== "all" ? courseFilter : "")
      };
      if (editingQuestion) {
        await apiRequest("PATCH", `/api/admin/questions/${editingQuestion.id}`, questionData);
      } else {
        await apiRequest("POST", "/api/admin/questions", questionData);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/admin/questions"] });
      setIsAddingQuestion(false);
      setEditingQuestion(null);
      setNewQuestion({ 
        text: "", 
        type: "multiple_choice", 
        options: ["", "", "", ""], 
        correctIndex: 0, 
        correctText: "", 
        points: 3,
        courseName: courseFilter !== "all" ? courseFilter : ""
      });
      toast({ title: "Berhasil", description: editingQuestion ? "Soal diperbarui" : "Soal ditambahkan" });
    } catch (err) {
      toast({ variant: "destructive", title: "Gagal", description: "Gagal menyimpan soal" });
    }
  };

  const handleTypeChange = (val: string) => {
    let options: string[] = ["", "", "", ""];
    let correctIndex = 0;
    let correctText = "";
    
    if (val === 'true_false') {
      options = ["Benar", "Salah"];
    } else if (val === 'matching') {
      options = []; 
      correctText = "{}"; 
    } else if (val === 'ordering') {
      options = ["", "", ""];
    }

    setNewQuestion({
      ...newQuestion,
      type: val,
      options,
      correctIndex,
      correctText
    });
  };

  const handleDeleteQuestion = async (id: number) => {
    if (!confirm("Hapus soal ini?")) return;
    try {
      await apiRequest("DELETE", `/api/admin/questions/${id}`);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/questions"] });
      toast({ title: "Berhasil", description: "Soal dihapus" });
    } catch (err) {
      toast({ variant: "destructive", title: "Gagal", description: "Gagal menghapus soal" });
    }
  };

  const [archiveClassFilter, setArchiveClassFilter] = useState<string>("all");
  const filteredArchived = archivedSubmissions?.filter(sub => {
    if (archiveClassFilter === "all") return true;
    return sub.student?.className === archiveClassFilter;
  });

  const exportArchiveToPDF = () => {
    if (!filteredArchived || !settings) return;

    const doc = new jsPDF('l', 'mm', 'a4');
    const tableColumn = ["No", "NIM", "Nama", "Kelas", "Matkul", "Skor", "Tgl Ujian", "Tgl Arsip"];
    const tableRows: any[] = [];

    filteredArchived.forEach((sub, index) => {
      const s = sub.student;
      const actualSub = sub.submission || sub;
      tableRows.push([
        index + 1,
        s?.nim || "-",
        s?.fullName || "-",
        s?.className || "-",
        s?.course || "-",
        `${actualSub.score}%`,
        actualSub.endTime ? new Date(actualSub.endTime).toLocaleDateString() : "-",
        actualSub.archivedAt ? new Date(actualSub.archivedAt).toLocaleDateString() : "-"
      ]);
    });

    doc.setFontSize(18);
    doc.text("Arsip Hasil Ujian", 14, 22);
    doc.setFontSize(11);
    doc.text(`Filter Kelas: ${archiveClassFilter === "all" ? "Semua" : archiveClassFilter}`, 14, 30);
    doc.text(`Tanggal Cetak: ${new Date().toLocaleString()}`, 14, 36);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 45,
      theme: 'grid',
    });

    doc.save(`arsip_ujian_${archiveClassFilter}.pdf`);
  };

  const handleDeleteArchived = async (id: number) => {
    if (!confirm("Hapus permanen arsip ini?")) return;
    try {
      await apiRequest("DELETE", `/api/admin/submissions/archived/${id}`);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/submissions/archived"] });
      toast({ title: "Berhasil", description: "Arsip dihapus permanen" });
    } catch (err) {
      toast({ variant: "destructive", title: "Gagal", description: "Gagal menghapus arsip" });
    }
  };

  const handleClearArchive = async () => {
    const msg = archiveClassFilter === "all" 
      ? "Apakah Anda yakin ingin menghapus SEMUA data arsip secara permanen?" 
      : `Apakah Anda yakin ingin menghapus semua data arsip kelas ${archiveClassFilter} secara permanen?`;
    
    if (!confirm(msg)) return;
    try {
      await apiRequest("POST", "/api/admin/submissions/archived/clear", { 
        className: archiveClassFilter === "all" ? undefined : archiveClassFilter 
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/submissions/archived"] });
      toast({ title: "Berhasil", description: "Arsip telah dibersihkan" });
    } catch (err) {
      toast({ variant: "destructive", title: "Gagal", description: "Gagal membersihkan arsip" });
    }
  };

  if (loadingSettings || loadingStudents || loadingSubmissions || loadingQuestions) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="size-12 rounded-xl bg-teal-600 flex items-center justify-center text-white shadow-lg shadow-teal-600/20">
              <Settings className="size-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Admin Dashboard</h1>
              <p className="text-muted-foreground">Monitoring dan Manajemen Sistem Ujian</p>
            </div>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            className="gap-2 text-destructive border-destructive/20 hover:bg-destructive/10"
            onClick={() => {
              if (confirm("Apakah Anda yakin ingin keluar?")) {
                logout();
                window.location.href = "/";
              }
            }}
          >
            <LogOut className="size-4" /> Keluar
          </Button>
        </header>

        <Tabs defaultValue="submissions" className="space-y-6">
          <TabsList className="bg-background border p-1 rounded-xl h-auto flex-wrap">
            <TabsTrigger value="submissions" className="gap-2 px-4 py-2 rounded-lg data-[state=active]:bg-teal-50 data-[state=active]:text-teal-700">
              <CheckCircle className="size-4" /> Hasil Ujian
            </TabsTrigger>
            <TabsTrigger value="questions" className="gap-2 px-4 py-2 rounded-lg data-[state=active]:bg-teal-50 data-[state=active]:text-teal-700">
              <BookOpen className="size-4" /> Bank Soal
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-2 px-4 py-2 rounded-lg data-[state=active]:bg-teal-50 data-[state=active]:text-teal-700">
              <Users className="size-4" /> User Management
            </TabsTrigger>
            <TabsTrigger value="archive" className="gap-2 px-4 py-2 rounded-lg data-[state=active]:bg-teal-50 data-[state=active]:text-teal-700">
              <Clock className="size-4" /> Arsip & History
            </TabsTrigger>
            {currentUser?.role === 'admin' && (
              <TabsTrigger value="settings" className="gap-2 px-4 py-2 rounded-lg data-[state=active]:bg-teal-50 data-[state=active]:text-teal-700">
                <Settings className="size-4" /> Pengaturan
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="archive">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div className="space-y-1">
                  <CardTitle>Arsip & History Ujian</CardTitle>
                  <CardDescription>Data ujian yang telah di-reset tetap tersimpan di sini sebagai riwayat.</CardDescription>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium whitespace-nowrap">Filter Kelas:</span>
                    <Select value={archiveClassFilter} onValueChange={setArchiveClassFilter}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Semua Kelas" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Semua Kelas</SelectItem>
                        {classes.map((c: string) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button variant="outline" size="sm" onClick={exportArchiveToPDF} className="gap-2 bg-red-50 hover:bg-red-100 text-red-600 border-red-200">
                    <FileDown className="h-4 w-4" /> Export PDF
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleClearArchive} className="gap-2 text-destructive border-destructive/20 hover:bg-destructive/10">
                    <Trash2 className="h-4 w-4" /> Bersihkan Arsip
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead>No</TableHead>
                        <TableHead>NIM</TableHead>
                        <TableHead>Nama</TableHead>
                        <TableHead>Mata Kuliah</TableHead>
                        <TableHead className="text-center">Skor (%)</TableHead>
                        <TableHead className="text-center">Tgl Ujian</TableHead>
                        <TableHead className="text-center">Tgl Arsip</TableHead>
                        <TableHead className="text-right">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {!filteredArchived || filteredArchived.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                            Belum ada data arsip {archiveClassFilter !== "all" ? `untuk kelas ${archiveClassFilter}` : ""}.
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredArchived.map((sub, index) => {
                          const s = sub.student;
                          const actualSub = sub.submission || sub;
                          return (
                            <TableRow key={actualSub.id}>
                              <TableCell className="font-mono text-sm">{index + 1}</TableCell>
                              <TableCell className="font-mono text-sm">{s?.nim || "-"}</TableCell>
                              <TableCell className="font-medium">{s?.fullName || "-"}</TableCell>
                              <TableCell>{s?.course || "-"}</TableCell>
                              <TableCell className="text-center font-bold">{actualSub.score}%</TableCell>
                              <TableCell className="text-center text-[11px]">
                                {actualSub.endTime ? new Date(actualSub.endTime).toLocaleDateString() : "-"}
                              </TableCell>
                              <TableCell className="text-center text-[11px] text-muted-foreground italic">
                                {actualSub.archivedAt ? new Date(actualSub.archivedAt).toLocaleDateString() : "-"}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                  <Button 
                                    variant="ghost" 
                                    size="icon"
                                    onClick={() => setViewingReport(actualSub)}
                                    className="text-teal-600 hover:bg-teal-50"
                                    title="Lihat Detail"
                                  >
                                    <FileText className="size-4" />
                                  </Button>
                                  <Button 
                                    variant="ghost" 
                                    size="icon"
                                    onClick={() => handleDeleteArchived(actualSub.id)}
                                    className="text-destructive hover:bg-destructive/10"
                                    title="Hapus Permanen"
                                  >
                                    <Trash2 className="size-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <CardTitle>Pengaturan Ujian</CardTitle>
                <CardDescription>Konfigurasi parameter dasar pelaksanaan ujian.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <label className="text-sm font-medium">Logo Aplikasi</label>
                  <div className="flex items-center gap-4 p-4 border rounded-xl bg-muted/20">
                    <div className="size-24 rounded-lg border bg-background flex items-center justify-center overflow-hidden">
                      <img 
                        src={settingsForm.appLogo || defaultLogo} 
                        alt="App Logo" 
                        className="max-w-full max-h-full object-contain"
                      />
                    </div>
                    <div className="space-y-2">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        ref={logoInputRef}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          
                          setIsUploadingLogo(true);
                          try {
                            const reader = new FileReader();
                            reader.onload = async (evt) => {
                              const base64 = evt.target?.result as string;
                              setSettingsForm({ ...settingsForm, appLogo: base64 });
                              setIsUploadingLogo(false);
                            };
                            reader.readAsDataURL(file);
                          } catch (err) {
                            toast({ variant: "destructive", title: "Gagal", description: "Gagal mengupload logo." });
                            setIsUploadingLogo(false);
                          }
                        }}
                      />
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm"
                        onClick={() => logoInputRef.current?.click()}
                        disabled={isUploadingLogo}
                        className="gap-2"
                      >
                        {isUploadingLogo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                        Ganti Logo
                      </Button>
                          <div className="space-y-1">
                            <p className="text-[10px] text-muted-foreground font-medium">Ukuran yang disarankan:</p>
                            <ul className="text-[10px] text-muted-foreground list-disc list-inside space-y-0.5">
                              <li>Bebas menggunakan ukuran apa pun (Rasio 1:1 atau Landscape)</li>
                              <li>Tinggi minimal 100px agar terlihat tajam</li>
                              <li>Format PNG (transparan) lebih direkomendasikan</li>
                            </ul>
                          </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Judul Ujian</label>
                    <Input 
                      value={settingsForm.examTitle}
                      onChange={(e) => setSettingsForm({...settingsForm, examTitle: e.target.value})}
                      placeholder="Contoh: Ujian Tengah Semester Ganjil"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Durasi (Menit)</label>
                    <Input 
                      type="number"
                      value={settingsForm.examDuration}
                      onChange={(e) => setSettingsForm({...settingsForm, examDuration: parseInt(e.target.value) || 0})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-orange-600">Skor Minimal Kelulusan (KKM)</label>
                    <Input 
                      type="number"
                      value={settingsForm.passingScore}
                      onChange={(e) => setSettingsForm({...settingsForm, passingScore: parseInt(e.target.value) || 0})}
                      className="border-orange-200 focus-visible:ring-orange-500"
                    />
                    <p className="text-[11px] text-muted-foreground">Skor di bawah ini akan dianggap "Tidak Lulus".</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Instruksi Ujian</label>
                  <Textarea 
                    value={settingsForm.instructions}
                    onChange={(e) => setSettingsForm({...settingsForm, instructions: e.target.value})}
                    placeholder="Masukkan instruksi pengerjaan..."
                    className="min-h-[100px]"
                  />
                </div>

                <div className="space-y-4">
                  <label className="text-sm font-medium">Daftar Mata Kuliah / Ujian</label>
                  <div className="flex gap-2">
                    <Input 
                      id="new-course-input"
                      placeholder="Tambah mata kuliah baru..." 
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const val = e.currentTarget.value.trim();
                          if (val && !settingsForm.availableCourses.includes(val)) {
                            setSettingsForm({
                              ...settingsForm, 
                              availableCourses: [...settingsForm.availableCourses, val],
                              activeCourses: [...settingsForm.activeCourses, val]
                            });
                            e.currentTarget.value = "";
                          }
                        }
                      }}
                    />
                    <Button 
                      type="button" 
                      variant="outline"
                      onClick={() => {
                        const input = document.getElementById('new-course-input') as HTMLInputElement;
                        const val = input.value.trim();
                        if (val && !settingsForm.availableCourses.includes(val)) {
                          setSettingsForm({
                            ...settingsForm, 
                            availableCourses: [...settingsForm.availableCourses, val],
                            activeCourses: [...settingsForm.activeCourses, val]
                          });
                          input.value = "";
                        }
                      }}
                    >
                      Tambah
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {settingsForm.availableCourses?.map((course, idx) => {
                      const isActive = settingsForm.activeCourses.includes(course);
                      const duration = settingsForm.courseDurations[course] || settingsForm.examDuration;
                      return (
                        <div key={idx} className={`flex flex-col gap-3 p-3 rounded-xl border transition-all ${isActive ? 'bg-teal-50/50 border-teal-100' : 'bg-muted/30 border-muted opacity-60'}`}>
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <input 
                                type="checkbox"
                                checked={isActive}
                                onChange={(e) => {
                                  const newActive = e.target.checked 
                                    ? [...settingsForm.activeCourses, course]
                                    : settingsForm.activeCourses.filter(c => c !== course);
                                  setSettingsForm({ ...settingsForm, activeCourses: newActive });
                                }}
                                className="size-4 accent-teal-600 cursor-pointer"
                              />
                              <span className={`text-sm font-medium ${isActive ? 'text-teal-900' : 'text-muted-foreground'}`}>{course}</span>
                            </div>
                            <button 
                              onClick={() => setSettingsForm({
                                ...settingsForm, 
                                availableCourses: settingsForm.availableCourses.filter((_, i) => i !== idx),
                                activeCourses: settingsForm.activeCourses.filter(c => c !== course)
                              })}
                              className="text-muted-foreground hover:text-destructive transition-colors p-1"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <div className="flex items-center gap-2">
                            <label className="text-[10px] font-bold uppercase text-muted-foreground">Durasi (Menit):</label>
                            <Input 
                              type="number"
                              value={duration}
                              onChange={(e) => {
                                const newDurations = { ...settingsForm.courseDurations, [course]: parseInt(e.target.value) || 0 };
                                setSettingsForm({ ...settingsForm, courseDurations: newDurations });
                              }}
                              className="h-7 text-xs w-20"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-[11px] text-muted-foreground">Centang untuk mengaktifkan mata kuliah agar muncul di halaman pendaftaran mahasiswa.</p>
                </div>

                <div className="space-y-4">
                  <label className="text-sm font-medium">Daftar Kelas / Jurusan</label>
                  <div className="flex gap-2">
                    <Input 
                      id="new-class-input"
                      placeholder="Tambah kelas baru..." 
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const val = e.currentTarget.value.trim();
                          if (val && !settingsForm.availableClasses.includes(val)) {
                            setSettingsForm({...settingsForm, availableClasses: [...settingsForm.availableClasses, val]});
                            e.currentTarget.value = "";
                          }
                        }
                      }}
                    />
                    <Button 
                      type="button" 
                      variant="outline"
                      onClick={() => {
                        const input = document.getElementById('new-class-input') as HTMLInputElement;
                        const val = input.value.trim();
                        if (val && !settingsForm.availableClasses.includes(val)) {
                          setSettingsForm({...settingsForm, availableClasses: [...settingsForm.availableClasses, val]});
                          input.value = "";
                        }
                      }}
                    >
                      Tambah
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {settingsForm.availableClasses.map((cls, idx) => (
                      <div key={idx} className="flex items-center gap-2 bg-muted px-3 py-1.5 rounded-lg border">
                        <span className="text-sm font-medium">{cls}</span>
                        <button 
                          onClick={() => setSettingsForm({
                            ...settingsForm, 
                            availableClasses: settingsForm.availableClasses.filter((_, i) => i !== idx)
                          })}
                          className="text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <X className="size-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">Peserta akan memilih salah satu dari daftar kelas ini saat mengisi biodata.</p>
                </div>

                <Button onClick={handleUpdateSettings} disabled={isSavingSettings} className="gap-2">
                  {isSavingSettings ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Simpan Perubahan
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Daftar Pengguna</CardTitle>
                  <CardDescription>Kelola data Administrator dan Mahasiswa.</CardDescription>
                </div>
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-background p-4 border rounded-xl shadow-sm">
                  <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
                    <div className="relative w-full md:w-[250px]">
                      <Input
                        placeholder="Cari NIM / Nama / Kelas..."
                        value={userSearch}
                        onChange={(e) => setUserSearch(e.target.value)}
                        className="pl-8"
                      />
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex items-center gap-2 w-full md:w-auto">
                      <span className="text-sm font-medium whitespace-nowrap">Filter Kelas:</span>
                      <Select value={userClassFilter} onValueChange={setUserClassFilter}>
                        <SelectTrigger className="w-full md:w-[180px]">
                          <SelectValue placeholder="Semua Kelas" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Semua Kelas</SelectItem>
                          {classes.map((c: string) => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="file"
                      accept=".xlsx, .xls"
                      className="hidden"
                      ref={fileInputRef}
                      onChange={handleImportExcel}
                    />
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="gap-2"
                      onClick={downloadTemplate}
                    >
                      <FileDown className="h-4 w-4" /> Template
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="gap-2"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isImporting}
                    >
                      {isImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                      Import Excel
                    </Button>
                    <Dialog open={isAddingUser} onOpenChange={(open) => {
                      setIsAddingUser(open);
                      if (!open) {
                        setEditingUser(null);
                        setNewUser({ nim: "", fullName: "", className: "", isAdmin: false, role: "student", password: "" });
                      }
                    }}>
                      <DialogTrigger asChild>
                        <Button size="sm" className="gap-2">
                          <UserPlus className="h-4 w-4" /> Tambah Manual
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>{editingUser ? "Edit User" : "Tambah User Baru"}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <label className="text-sm font-medium">NIM / Username *</label>
                            <Input 
                              value={newUser.nim}
                              onChange={(e) => setNewUser({...newUser, nim: e.target.value})}
                              placeholder="NIM untuk Mahasiswa, Username untuk Admin"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Nama Lengkap *</label>
                            <Input 
                              value={newUser.fullName}
                              onChange={(e) => setNewUser({...newUser, fullName: e.target.value})}
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Kelas (Hanya Mahasiswa)</label>
                            <Select 
                              value={newUser.className} 
                              onValueChange={(val) => setNewUser({...newUser, className: val})}
                              disabled={newUser.isAdmin}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Pilih Kelas" />
                              </SelectTrigger>
                              <SelectContent>
                                {classes.map((c: string) => (
                                  <SelectItem key={c} value={c}>{c}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {!newUser.isAdmin && (
                              <p className="text-[10px] text-muted-foreground italic">
                                * Daftar kelas diambil dari pengaturan.
                              </p>
                            )}
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Role User</label>
                            <Select 
                              value={newUser.role} 
                              onValueChange={(val: any) => setNewUser({...newUser, role: val, isAdmin: val === "admin", className: val !== "student" ? "System" : newUser.className})}
                              disabled={currentUser?.role !== 'admin'}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Pilih Role" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="student">Mahasiswa</SelectItem>
                                <SelectItem value="pengawas">Pengawas</SelectItem>
                                {currentUser?.role === 'admin' && <SelectItem value="admin">Administrator</SelectItem>}
                              </SelectContent>
                            </Select>
                          </div>
                          {(newUser.role === "admin" || newUser.role === "pengawas") && (
                            <div className="space-y-2">
                              <label className="text-sm font-medium">Password {newUser.role === "admin" ? "Admin" : "Pengawas"}</label>
                              <Input 
                                type="password"
                                value={newUser.password}
                                onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                              />
                            </div>
                          )}
                          <Button className="w-full" onClick={handleSaveUser}>Simpan User</Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border max-h-[500px] overflow-auto">
                  <Table>
                    <TableHeader className="bg-muted/50 sticky top-0 z-10">
                      <TableRow>
                        <TableHead>NIM/User</TableHead>
                        <TableHead>Nama</TableHead>
                        <TableHead>Kelas</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead className="text-right">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {!filteredStudents || filteredStudents.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                            Belum ada user yang sesuai pencarian.
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredStudents.map((u) => (
                          <TableRow key={u.id}>
                            <TableCell className="font-mono">{u.nim}</TableCell>
                            <TableCell className="font-medium">{u.fullName || "-"}</TableCell>
                            <TableCell>{u.className || "-"}</TableCell>
                            <TableCell>
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 
                                u.role === 'pengawas' ? 'bg-amber-100 text-amber-700' : 
                                'bg-blue-100 text-blue-700'
                              }`}>
                                {u.role === 'admin' ? 'Admin' : u.role === 'pengawas' ? 'Pengawas' : 'Mhs'}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                {(currentUser?.role === 'admin' || 
                                 (currentUser?.role === 'pengawas' && u.role === 'student' && u.createdBy === currentUser?.id)) && (
                                  <>
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      onClick={() => handleEditUser(u)}
                                      className="h-8 w-8 hover:bg-muted"
                                      data-testid={`button-edit-user-${u.id}`}
                                    >
                                      <Settings className="h-4 w-4" />
                                    </Button>
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      onClick={() => handleDeleteUser(u.id)}
                                      className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                      data-testid={`button-delete-user-${u.id}`}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="submissions">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Hasil Ujian Peserta</CardTitle>
                  <CardDescription>Pantau nilai dan status pengerjaan siswa.</CardDescription>
                </div>
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <Input
                      placeholder="Cari Nama / NIM..."
                      value={submissionSearch}
                      onChange={(e) => setSubmissionSearch(e.target.value)}
                      className="w-[250px] pl-8"
                    />
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium whitespace-nowrap">Filter Kelas:</span>
                    <Select value={classFilter} onValueChange={setClassFilter}>
                      <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="Semua Kelas" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Semua Kelas</SelectItem>
                        {classes.map((c: string) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                <Dialog open={isBulkResetOpen} onOpenChange={setIsBulkResetOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="h-10 border-orange-200 text-orange-600 hover:bg-orange-50 hover:text-orange-700 gap-2">
                      <Trash2 className="size-4" />
                      Reset Masal
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Reset Masal Hasil Ujian</DialogTitle>
                      <DialogDescription>
                        Fitur ini memungkinkan Anda memberikan kesempatan ujian ulang kepada banyak siswa sekaligus.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Target Kelas</label>
                          <Select value={bulkResetClass} onValueChange={setBulkResetClass}>
                            <SelectTrigger>
                              <SelectValue placeholder="Pilih Kelas" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">Semua Kelas</SelectItem>
                              {classes.map((c: string) => (
                                <SelectItem key={c} value={c}>{c}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Mata Kuliah</label>
                          <Select value={bulkResetCourse} onValueChange={setBulkResetCourse}>
                            <SelectTrigger>
                              <SelectValue placeholder="Semua Matkul" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">Semua Matkul</SelectItem>
                              {availableCourses.map((c: string) => (
                                <SelectItem key={c} value={c}>{c}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium">Kriteria Reset</label>
                        <Select value={resetType} onValueChange={(val: any) => setResetType(val)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Semua Siswa (Apapun Nilainya)</SelectItem>
                            <SelectItem value="remedial">Siswa Remedial (Skor &lt; {settings?.passingScore || 70})</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg flex gap-3 text-amber-800 text-sm">
                        <AlertCircle className="size-5 shrink-0" />
                        <p>Tindakan ini akan menghapus data jawaban dan nilai siswa yang terpilih secara permanen.</p>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsBulkResetOpen(false)}>Batal</Button>
                      <Button 
                        variant="destructive" 
                        onClick={handleBulkReset}
                        disabled={isResetting}
                      >
                        {isResetting ? "Memproses..." : "Ya, Reset Sekarang"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <Button variant="outline" size="sm" onClick={exportToExcel} className="gap-2">
                  <Save className="h-4 w-4" /> Export Excel
                </Button>
                <Button variant="outline" size="sm" onClick={exportToPDF} className="gap-2 bg-red-50 hover:bg-red-100 text-red-600 border-red-200">
                  <FileDown className="h-4 w-4" /> Export PDF
                </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead>No</TableHead>
                  <TableHead>NIM</TableHead>
                        <TableHead>Nama</TableHead>
                        <TableHead>Kelas</TableHead>
                        <TableHead className="text-center">Waktu Mulai</TableHead>
                        <TableHead className="text-center">Waktu Selesai</TableHead>
                        <TableHead className="text-center">Skor (%)</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {!filteredSubmissions || filteredSubmissions.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                            Belum ada data yang sesuai filter.
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredSubmissions.map((sub, index) => {
                          const s = sub.student;
                          return (
                            <TableRow key={sub.id}>
                              <TableCell className="font-mono text-sm">{index + 1}</TableCell>
                              <TableCell className="font-mono text-sm">{s?.nim || sub.studentId}</TableCell>
                              <TableCell className="font-medium">{s?.fullName || "-"}</TableCell>
                              <TableCell>{s?.className || "-"}</TableCell>
                              <TableCell className="text-center font-mono text-[11px]">
                                {sub.startTime ? new Date(sub.startTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : "-"}
                              </TableCell>
                              <TableCell className="text-center font-mono text-[11px]">
                                {sub.endTime ? new Date(sub.endTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : "-"}
                              </TableCell>
                              <TableCell className="text-center">
                                <div className="flex flex-col items-center gap-1">
                                  <span className={`px-2 py-1 rounded-md font-bold ${sub.score !== null ? (sub.score >= (settings?.passingScore || 70) ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700') : ''}`}>
                                    {sub.score !== null ? `${sub.score}%` : "-"}
                                  </span>
                                  {sub.score !== null && (
                                    <span className={`text-[10px] font-bold uppercase ${sub.score >= (settings?.passingScore || 70) ? 'text-green-600' : 'text-red-600'}`}>
                                      {sub.score >= (settings?.passingScore || 70) ? 'Lulus' : 'Tidak Lulus'}
                                    </span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                {sub.isCompleted ? (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                    Selesai
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                    Berlangsung
                                  </span>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                  <Button 
                                    variant="ghost" 
                                    size="icon"
                                    onClick={() => setViewingReport(sub)}
                                    title="Lihat Detail Jawaban"
                                    className="text-teal-600 hover:text-teal-700 hover:bg-teal-50"
                                  >
                                    <FileText className="size-4" />
                                  </Button>
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    onClick={() => handleDeleteSubmission(sub.id)}
                                    className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                                    title="Izinkan Ujian Ulang"
                                  >
                                    <Trash2 className="h-4 w-4 mr-1" /> Ujian Ulang
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="questions" className="space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div className="space-y-1">
                  <CardTitle>Bank Soal</CardTitle>
                  <CardDescription>Kelola daftar soal ujian berdasarkan mata kuliah.</CardDescription>
                </div>
                <div className="flex items-center gap-4">
                  <Button variant="outline" size="sm" onClick={exportToDOCX} className="gap-2">
                    <FileText className="size-4" /> Export DOCX
                  </Button>
                  <div className="w-[200px]">
                    <Select value={courseFilter} onValueChange={setCourseFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="Filter Mata Kuliah" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Semua Mata Kuliah</SelectItem>
                        {availableCourses.map((course: string) => (
                          <SelectItem key={course} value={course}>{course}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Dialog open={isAddingQuestion} onOpenChange={setIsAddingQuestion}>
                    <DialogTrigger asChild>
                      <Button onClick={() => {
                        setEditingQuestion(null);
                        setNewQuestion({ 
                          text: "", 
                          type: "multiple_choice", 
                          options: ["", "", "", ""], 
                          correctIndex: 0, 
                          correctText: "", 
                          points: 3,
                          courseName: courseFilter !== "all" ? courseFilter : "" 
                        });
                      }} className="bg-teal-600 hover:bg-teal-700">
                        <Plus className="mr-2 h-4 w-4" /> Tambah Soal
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[500px]">
                      <DialogHeader>
                        <DialogTitle>{editingQuestion ? "Edit Pertanyaan" : "Tambah Pertanyaan Baru"}</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 py-4 max-h-[80vh] overflow-y-auto pr-2">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Pertanyaan *</label>
                          <Textarea 
                            value={newQuestion.text}
                            onChange={(e) => setNewQuestion({...newQuestion, text: e.target.value})}
                            placeholder="Ketik pertanyaan di sini..."
                            className="min-h-[100px]"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-medium">Tipe Soal</label>
                          <Select value={newQuestion.type} onValueChange={handleTypeChange}>
                            <SelectTrigger>
                              <SelectValue placeholder="Pilih Tipe Soal" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="multiple_choice">Pilihan Ganda</SelectItem>
                              <SelectItem value="true_false">Benar/Salah</SelectItem>
                              <SelectItem value="matching">Menjodohkan</SelectItem>
                              <SelectItem value="short_answer">Isian Singkat</SelectItem>
                              <SelectItem value="essay">Esai/Uraian</SelectItem>
                              <SelectItem value="ordering">Penyusunan Urutan</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {(newQuestion.type !== 'short_answer' && newQuestion.type !== 'essay' && newQuestion.type !== 'matching') && (
                          <div className="space-y-4">
                            <label className="text-sm font-medium">
                              {newQuestion.type === 'ordering' ? 'Urutan yang Benar (Atas ke Bawah)' : 'Pilihan Jawaban'}
                            </label>
                            <div className="grid grid-cols-1 gap-3">
                              {newQuestion.options.map((opt, i) => (
                                <div key={i} className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                                  <div className="size-8 rounded border bg-background flex items-center justify-center font-bold text-xs shrink-0">
                                    {newQuestion.type === 'ordering' ? (i + 1) : String.fromCharCode(65 + i)}
                                  </div>
                                  <Input 
                                    value={opt}
                                    onChange={(e) => {
                                      const newOpts = [...newQuestion.options];
                                      newOpts[i] = e.target.value;
                                      setNewQuestion({...newQuestion, options: newOpts});
                                    }}
                                    placeholder={newQuestion.type === 'ordering' ? `Urutan ke-${i+1}` : `Pilihan ${String.fromCharCode(65 + i)}`}
                                    className="border-none bg-transparent focus-visible:ring-0 h-8"
                                  />
                                  {newQuestion.type !== 'ordering' && (
                                    <input 
                                      type="radio" 
                                      name="correct" 
                                      checked={newQuestion.correctIndex === i}
                                      onChange={() => setNewQuestion({...newQuestion, correctIndex: i})}
                                      className="size-4 accent-primary shrink-0"
                                    />
                                  )}
                                </div>
                              ))}
                              {newQuestion.type === 'ordering' && (
                                 <Button 
                                   type="button" 
                                   variant="outline" 
                                   size="sm" 
                                   onClick={() => setNewQuestion({...newQuestion, options: [...newQuestion.options, ""]})}
                                 >
                                   Tambah Langkah
                                 </Button>
                              )}
                            </div>
                            {newQuestion.type !== 'ordering' && (
                              <p className="text-[10px] text-muted-foreground">Pilih jawaban yang benar dengan radio button</p>
                            )}
                          </div>
                        )}

                        {newQuestion.type === 'matching' && (
                          <div className="space-y-4 border p-4 rounded-lg bg-muted/20">
                            <div className="flex items-center justify-between">
                              <label className="text-sm font-medium">Pasangan Jawaban (Matching)</label>
                              <Button 
                                type="button" 
                                variant="outline" 
                                size="sm"
                                onClick={() => {
                                  const currentMatches = JSON.parse(newQuestion.correctText || "{}");
                                  const nextIdx = Object.keys(currentMatches).length + 1;
                                  const newKey = `Item ${nextIdx}`;
                                  const newMatches = { ...currentMatches, [newKey]: "" };
                                  setNewQuestion({
                                    ...newQuestion,
                                    correctText: JSON.stringify(newMatches)
                                  });
                                }}
                              >
                                <Plus className="size-3 mr-1" /> Tambah Baris
                              </Button>
                            </div>
                            <div className="space-y-3">
                              {(() => {
                                let matches: Record<string, string> = {};
                                try {
                                  matches = JSON.parse(newQuestion.correctText || "{}");
                                } catch (e) {}

                                return Object.entries(matches).map(([key, val], idx) => (
                                  <div key={idx} className="flex gap-2 items-center">
                                    <div className="flex-1 space-y-1">
                                      <label className="text-[10px] uppercase font-bold text-muted-foreground">Kolom A</label>
                                      <Input 
                                        placeholder="Pernyataan..."
                                        value={key}
                                        onChange={(e) => {
                                          const newKey = e.target.value;
                                          const newMatches = { ...matches };
                                          delete newMatches[key];
                                          newMatches[newKey] = val;
                                          setNewQuestion({
                                            ...newQuestion, 
                                            correctText: JSON.stringify(newMatches)
                                          });
                                        }}
                                      />
                                    </div>
                                    <div className="flex-none pt-4">
                                      <ChevronRight className="size-4 text-muted-foreground" />
                                    </div>
                                    <div className="flex-1 space-y-1">
                                      <label className="text-[10px] uppercase font-bold text-muted-foreground">Kolom B</label>
                                      <Input 
                                        placeholder="Jawaban..."
                                        value={val}
                                        onChange={(e) => {
                                          const newMatches = { ...matches, [key]: e.target.value };
                                          setNewQuestion({
                                            ...newQuestion,
                                            correctText: JSON.stringify(newMatches)
                                          });
                                        }}
                                      />
                                    </div>
                                    <Button 
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="mt-5 text-muted-foreground hover:text-destructive"
                                      onClick={() => {
                                        const newMatches = { ...matches };
                                        delete newMatches[key];
                                        setNewQuestion({
                                          ...newQuestion,
                                          correctText: JSON.stringify(newMatches)
                                        });
                                      }}
                                    >
                                      <Trash2 className="size-4" />
                                    </Button>
                                  </div>
                                ));
                              })()}
                              {Object.keys(JSON.parse(newQuestion.correctText || "{}")).length === 0 && (
                                <p className="text-xs text-center text-muted-foreground py-2 italic">Klik Tambah Baris untuk membuat pasangan</p>
                              )}
                            </div>
                          </div>
                        )}

                        {(newQuestion.type === 'short_answer' || newQuestion.type === 'essay') && (
                          <div className="space-y-2">
                            <label className="text-sm font-medium">
                              {newQuestion.type === 'essay' ? 'Kunci Jawaban / Referensi (Keyword)' : 'Jawaban Benar (Kata Kunci)'}
                            </label>
                            <Textarea 
                              value={newQuestion.correctText || ""}
                              onChange={(e) => setNewQuestion({...newQuestion, correctText: e.target.value})}
                              placeholder={newQuestion.type === 'essay' ? "Masukkan poin-poin kunci jawaban..." : "Contoh: Jakarta"}
                              className={newQuestion.type === 'essay' ? "min-h-[100px]" : "h-10"}
                            />
                          </div>
                        )}

                        <div className="space-y-2">
                          <label className="text-sm font-medium">Mata Kuliah / Ujian</label>
                          <Select 
                            value={newQuestion.courseName} 
                            onValueChange={(val) => setNewQuestion({...newQuestion, courseName: val})}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Pilih Mata Kuliah" />
                            </SelectTrigger>
                            <SelectContent>
                              {settings?.availableCourses?.map((course: string) => (
                                <SelectItem key={course} value={course}>{course}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-medium">Poin</label>
                          <Input 
                            type="number"
                            value={newQuestion.points}
                            onChange={(e) => setNewQuestion({...newQuestion, points: parseInt(e.target.value) || 0})}
                          />
                        </div>
                        
                        <div className="flex gap-3 pt-4">
                          <Button variant="outline" onClick={() => {
                            setIsAddingQuestion(false);
                            setEditingQuestion(null);
                            setNewQuestion({ 
                              text: "", 
                              type: "multiple_choice", 
                              options: ["", "", "", ""], 
                              correctIndex: 0, 
                              correctText: "",
                              points: 3,
                              courseName: courseFilter !== "all" ? courseFilter : "" 
                            });
                          }} className="flex-1">
                            Batal
                          </Button>
                          <Button onClick={handleSaveQuestion} className="flex-1 bg-teal-600 hover:bg-teal-700">
                            {editingQuestion ? "Simpan Perubahan" : "Tambah Soal"}
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="w-[50px]">No</TableHead>
                        <TableHead>Pertanyaan</TableHead>
                        <TableHead>Kunci Jawaban</TableHead>
                        <TableHead className="text-right">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredQuestions && filteredQuestions.length > 0 ? (
                        filteredQuestions.map((q, idx) => (
                          <TableRow key={q.id}>
                            <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                            <TableCell className="font-medium max-w-md truncate">
                              <div className="flex flex-col gap-1">
                                <span>{q.text}</span>
                                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
                                  {q.courseName || "Tanpa Mata Kuliah"}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              {q.type === "multiple_choice" || q.type === "true_false" ? (
                                <span className="text-sm font-medium">{q.options[q.correctIndex]}</span>
                              ) : q.type === "essay" || q.type === "short_answer" ? (
                                <span className="text-sm italic">{q.correctText}</span>
                              ) : (
                                <span className="text-xs text-muted-foreground">Lihat Detail</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  onClick={() => handleEditQuestion(q)}
                                  className="hover:bg-muted"
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  onClick={() => handleDeleteQuestion(q.id)}
                                  className="text-destructive hover:bg-destructive/10"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                            Belum ada soal untuk mata kuliah ini.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      {/* Submission Report Modal */}
      <Dialog open={!!viewingReport} onOpenChange={(open) => !open && setViewingReport(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="size-5 text-teal-600" />
              Laporan Jawaban Peserta
            </DialogTitle>
            <DialogDescription>
              Detail jawaban untuk {reportDetails?.student?.fullName} ({reportDetails?.student?.nim}) - {reportDetails?.student?.course}
            </DialogDescription>
          </DialogHeader>

          {loadingReport ? (
            <div className="flex justify-center py-12">
              <Loader2 className="size-8 animate-spin text-teal-600" />
            </div>
          ) : (
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-xl bg-muted/30 border">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Skor Akhir</p>
                  <p className="text-2xl font-bold text-teal-700">{reportDetails?.submission?.score || 0}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Status</p>
                  <p className="font-semibold text-sm">
                    {reportDetails?.submission?.score >= (settings?.passingScore || 70) ? (
                      <span className="text-green-600">LULUS</span>
                    ) : (
                      <span className="text-destructive">TIDAK LULUS</span>
                    )}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Waktu Mulai</p>
                  <p className="text-xs font-medium">{new Date(reportDetails?.submission?.startTime).toLocaleString()}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Selesai</p>
                  <p className="text-xs font-medium">{reportDetails?.submission?.endTime ? new Date(reportDetails?.submission?.endTime).toLocaleString() : "-"}</p>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-bold text-sm flex items-center gap-2">
                  <BookOpen className="size-4 text-muted-foreground" />
                  Analisis Jawaban
                </h3>
                <div className="space-y-4">
                  {reportDetails?.questions?.map((q: any, idx: number) => {
                    const studentAnswer = reportDetails?.submission?.answers?.[String(q.id)];
                    let isCorrect = false;

                    if (q.type === 'multiple_choice' || q.type === 'true_false') {
                      isCorrect = studentAnswer == q.correctIndex;
                    } else if (q.type === 'short_answer') {
                      isCorrect = String(studentAnswer || "").toLowerCase().trim() === (q.correctText || "").toLowerCase().trim();
                    } else if (q.type === 'ordering') {
                      isCorrect = JSON.stringify(studentAnswer) === JSON.stringify(q.options);
                    }

                    return (
                      <div key={q.id} className={cn(
                        "p-4 rounded-xl border-2 transition-colors",
                        isCorrect ? "border-green-100 bg-green-50/30" : "border-destructive/10 bg-destructive/5"
                      )}>
                        <div className="flex items-start justify-between gap-4 mb-3">
                          <div className="flex-1">
                            <p className="text-xs font-bold text-muted-foreground mb-1 uppercase tracking-wider">Soal {idx + 1}</p>
                            <p className="font-medium text-sm leading-relaxed">{q.text}</p>
                          </div>
                          <div className={cn(
                            "px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider",
                            isCorrect ? "bg-green-100 text-green-700" : "bg-destructive/10 text-destructive"
                          )}>
                            {isCorrect ? "Benar" : "Salah"}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                          <div className="space-y-1">
                            <p className="text-muted-foreground font-medium">Jawaban Peserta:</p>
                            <p className="font-bold">
                              {q.type === 'multiple_choice' || q.type === 'true_false' 
                                ? (q.options[studentAnswer] || "-") 
                                : Array.isArray(studentAnswer) ? studentAnswer.join(" -> ") : (studentAnswer || "-")}
                            </p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-muted-foreground font-medium">Kunci Jawaban:</p>
                            <p className="font-bold text-teal-700">
                              {q.type === 'multiple_choice' || q.type === 'true_false'
                                ? q.options[q.correctIndex]
                                : q.type === 'ordering' ? q.options.join(" -> ") : (q.correctText || "-")}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewingReport(null)}>Tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const loadingSettings = false; 
