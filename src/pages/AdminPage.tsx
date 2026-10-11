import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { StudentsManager } from "@/components/admin/StudentsManager";
import { CoursesManager } from "@/components/admin/CoursesManager";
import { LogOut, Shield, Users, BookOpen, AlertCircle, X } from "lucide-react";

type Tab = "students" | "courses";

export function AdminPage() {
  const { profile, signOut } = useAuth();
  const [tab, setTab] = useState<Tab>("students");
  const [error, setError] = useState<string | null>(null);

  const tabs: { id: Tab; label: string; icon: typeof Users }[] = [
    { id: "students", label: "Students", icon: Users },
    { id: "courses", label: "Courses", icon: BookOpen },
  ];

  return (
    <div className="min-h-screen bg-[#202020]">
      <header className="border-b border-gray-800 sticky top-0 bg-[#202020] z-40">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6 text-[#0C969C]" />
            <h1 className="text-xl font-bold text-white">Admin Panel</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-400 hidden sm:block">{profile?.email}</span>
            <button
              onClick={signOut}
              className="flex items-center gap-2 text-sm text-gray-300 hover:text-white transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign out
            </button>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-1">
            {tabs.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    tab === t.id
                      ? "border-[#0C969C] text-white"
                      : "border-transparent text-gray-400 hover:text-gray-200"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {error && (
          <div className="mb-6 flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <p className="text-sm text-red-300 flex-1">{error}</p>
            <button
              onClick={() => setError(null)}
              className="text-red-400 hover:text-red-300 transition-colors shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {tab === "students" && <StudentsManager onError={setError} />}
        {tab === "courses" && <CoursesManager onError={setError} />}
      </main>
    </div>
  );
}
