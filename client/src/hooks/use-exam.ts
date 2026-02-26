import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { useAuthStore } from "./use-auth";
import { useToast } from "./use-toast";

// Fetch Questions
export function useQuestions() {
  const selectedCourse = localStorage.getItem("exam_selected_course");
  return useQuery<any[]>({
    queryKey: [api.exam.questions.path, selectedCourse],
    queryFn: async () => {
      const url = selectedCourse 
        ? `${api.exam.questions.path}?courseName=${encodeURIComponent(selectedCourse)}`
        : api.exam.questions.path;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Gagal memuat soal');
      const data = await res.json();
      
      // Secondary safety filter on frontend
      if (selectedCourse) {
        const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
        const normalizedSelected = normalize(selectedCourse);
        return data.filter((q: any) => q.courseName && normalize(q.courseName) === normalizedSelected);
      }
      return data;
    },
    staleTime: Infinity,
  });
}

// Start Exam
export function useStartExam() {
  const { student, setSubmissionId } = useAuthStore();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      if (!student) throw new Error("Not authenticated");
      
      const res = await fetch(api.exam.start.path, {
        method: api.exam.start.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: student.id }),
      });

      if (!res.ok) throw new Error("Gagal memulai ujian");
      return api.exam.start.responses[201].parse(await res.json());
    },
    onSuccess: (data) => {
      setSubmissionId(data.id);
      toast({
        title: "Ujian Dimulai",
        description: "Waktu Anda 60 menit dari sekarang.",
      });
    }
  });
}

// Submit Answers
export function useSubmitExam() {
  const { activeSubmissionId, setSubmissionId } = useAuthStore();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (answers: Record<string, number>) => {
      if (!activeSubmissionId) throw new Error("No active exam");
      
      const url = buildUrl(api.exam.submit.path, { submissionId: activeSubmissionId });
      
      const res = await fetch(url, {
        method: api.exam.submit.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers }),
      });

      if (!res.ok) throw new Error("Gagal mengirim jawaban");
      return api.exam.submit.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      setSubmissionId(0); // Clear active submission (using 0 as null-ish)
      toast({
        title: "Ujian Selesai",
        description: "Jawaban Anda telah tersimpan.",
      });
    }
  });
}

// Get Result
export function useExamResult(submissionId: number) {
  return useQuery({
    queryKey: [api.exam.result.path, submissionId],
    queryFn: async () => {
      if (!submissionId) return null;
      const url = buildUrl(api.exam.result.path, { submissionId });
      const res = await fetch(url);
      if (!res.ok) throw new Error("Gagal memuat hasil");
      return api.exam.result.responses[200].parse(await res.json());
    },
    enabled: !!submissionId,
  });
}
