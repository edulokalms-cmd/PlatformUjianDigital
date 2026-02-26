import { useAuthStore } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { LogOut, User } from "lucide-react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";

import appLogo from "@assets/generated_images/official_logo_for_ujian_kita_application.png";

export function Header() {
  const { student, logout } = useAuthStore();
  const [, setLocation] = useLocation();
  const { data: settings } = useQuery<any>({ queryKey: ["/api/admin/settings"] });

  const logoToDisplay = settings?.appLogo || appLogo;

  const handleLogout = () => {
    logout();
    setLocation("/");
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src={logoToDisplay} alt="Ujian Kita" className="h-10 w-auto object-contain" />
        </div>

        {student && (
          <div className="flex items-center gap-4">
            <div className="hidden md:flex flex-col items-end">
              <span className="text-sm font-medium">{student.fullName || (student.isAdmin ? "Administrator" : student.nim)}</span>
              <span className="text-xs text-muted-foreground">{student.isAdmin ? "Panitia" : (student.className || "Peserta")}</span>
            </div>
            
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleLogout} 
              className="gap-2 text-muted-foreground hover:text-destructive hover:bg-destructive/5 border-muted-foreground/20"
            >
              <LogOut className="size-4" />
              <span>Keluar</span>
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}
