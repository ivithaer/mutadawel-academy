import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { LoginPage } from "@/pages/LoginPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { AdminPage } from "@/pages/AdminPage";
import { NotAuthorizedPage } from "@/pages/NotAuthorizedPage";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Loader2 } from "lucide-react";

function App() {
  const { status, role } = useAuth();

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-[#202020] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#0C969C] animate-spin" />
      </div>
    );
  }

  const authenticated = status === "authenticated";
  const notAuthorized = status === "not_authorized";
  const isAdmin = authenticated && role === "super_admin";
  const isStudent = authenticated && role === "student";

  if (notAuthorized && !window.location.pathname.startsWith("/not-authorized")) {
    return <Navigate to="/not-authorized" replace />;
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={authenticated ? <Navigate to={isAdmin ? "/admin" : "/dashboard"} replace /> : <LoginPage />}
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute requiredRole="super_admin">
            <AdminPage />
          </ProtectedRoute>
        }
      />
      <Route path="/not-authorized" element={<NotAuthorizedPage />} />
      <Route
        path="*"
        element={
          <Navigate
            to={isStudent ? "/dashboard" : isAdmin ? "/admin" : "/login"}
            replace
          />
        }
      />
    </Routes>
  );
}

export default App;
