import { ReactNode, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuthStore } from "@/hooks/use-auth";

interface ProtectedRouteProps {
  children: ReactNode;
  requireBiodata?: boolean;
}

export function ProtectedRoute({ children, requireBiodata = true }: ProtectedRouteProps) {
  const [location, setLocation] = useLocation();
  const { student, hasBiodata } = useAuthStore();

  useEffect(() => {
    if (!student) {
      setLocation("/");
    } else if (requireBiodata && !hasBiodata) {
      setLocation("/biodata");
    }
  }, [student, hasBiodata, requireBiodata, setLocation]);

  if (!student) return null;
  if (requireBiodata && !hasBiodata) return null;

  return <>{children}</>;
}
