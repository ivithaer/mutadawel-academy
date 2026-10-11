import { Shield, XCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";

export function NotAuthorizedPage() {
  async function handleSignOut() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <div className="min-h-screen bg-[#202020] flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-red-500/10 mb-6">
          <XCircle className="w-8 h-8 text-red-500" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-3">Access Denied</h1>
        <p className="text-gray-400 leading-relaxed mb-6">
          Your account is not authorized to access this platform. If you believe this is an error,
          please contact the platform administrator.
        </p>
        <button
          onClick={handleSignOut}
          className="inline-flex items-center gap-2 py-3 px-6 rounded-xl bg-gray-800 text-white hover:bg-gray-700 transition-colors"
        >
          <Shield className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </div>
  );
}
