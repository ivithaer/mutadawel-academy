import { useAuth } from "@/contexts/AuthContext";
import { LogOut } from "lucide-react";

export function DashboardPage() {
  const { profile, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-[#202020]">
      <header className="border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-white">Mutadawel Academy</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-400">{profile?.email}</span>
            <button
              onClick={signOut}
              className="flex items-center gap-2 text-sm text-gray-300 hover:text-white transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <h2 className="text-2xl font-bold text-white mb-2">
          Welcome, {profile?.display_name || profile?.email}
        </h2>
        <p className="text-gray-400">
          Your dashboard will be built in Phase 4. You are authenticated as a {profile?.role}.
        </p>
      </main>
    </div>
  );
}
