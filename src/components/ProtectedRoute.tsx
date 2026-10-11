import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import type { UserRole } from "@/types/database";

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: UserRole;
}

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { status, role } = useAuth();

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-[#202020] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#0C969C] animate-spin" />
      </div>
    );
  }

  if (status === "not_authorized") {
    return <Navigate to="/not-authorized" replace />;
  }

  if (status === "unauthenticated") {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && role !== requiredRole) {
    return <Navigate to={role === "super_admin" ? "/admin" : "/dashboard"} replace />;
  }

  return <>{children}</>;
}
