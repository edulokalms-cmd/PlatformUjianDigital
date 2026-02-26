import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@shared/routes';
import { useToast } from '@/hooks/use-toast';
import type { Student } from '@shared/schema';
import { z } from 'zod';

// Define types locally based on schemas to avoid circular or missing export issues
type LoginRequest = z.infer<typeof api.auth.login.input>;

// === STORE ===
interface AuthState {
  student: Student | null;
  hasBiodata: boolean;
  activeSubmissionId: number | null;
  setAuth: (data: { student: Student; hasBiodata: boolean; activeSubmissionId?: number }) => void;
  updateStudent: (student: Student) => void;
  setSubmissionId: (id: number) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      student: null,
      hasBiodata: false,
      activeSubmissionId: null,
      setAuth: (data) => set({ 
        student: data.student, 
        hasBiodata: data.hasBiodata, 
        activeSubmissionId: data.activeSubmissionId ?? null 
      }),
      updateStudent: (student) => set({ student, hasBiodata: true }),
      setSubmissionId: (id) => set({ activeSubmissionId: id }),
      logout: () => set({ student: null, hasBiodata: false, activeSubmissionId: null }),
    }),
    { name: 'exam-auth-storage' }
  )
);

// === HOOKS ===

export function useLogin() {
  const { setAuth } = useAuthStore();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async (data: LoginRequest) => {
      // Validate with Zod
      const validated = api.auth.login.input.parse(data);
      
      const res = await fetch(api.auth.login.path, {
        method: api.auth.login.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validated),
      });
      
      if (!res.ok) {
        throw new Error('NIM tidak ditemukan');
      }
      
      return api.auth.login.responses[200].parse(await res.json());
    },
    onSuccess: (data) => {
      setAuth(data);
      toast({
        title: "Login Berhasil",
        description: `Selamat datang, ${data.student.nim}`,
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Gagal Login",
        description: error.message,
      });
    }
  });
}

export function useUpdateBiodata() {
  const { student, updateStudent } = useAuthStore();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { fullName: string; className: string; course: string }) => {
      if (!student) throw new Error("Not authenticated");

      const res = await fetch(`/api/students/${student.id}`, {
        method: "PUT",
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) throw new Error("Gagal menyimpan biodata");
      
      return await res.json();
    },
    onSuccess: (updatedStudent) => {
      updateStudent(updatedStudent);
      toast({
        title: "Biodata Disimpan",
        description: "Data diri Anda berhasil diperbarui.",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Gagal",
        description: error.message,
      });
    }
  });
}
