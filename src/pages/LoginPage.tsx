import { useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase";
import { Mail, Loader2, ArrowRight } from "lucide-react";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/request-magic-link`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          email: email.trim(),
          redirectUrl: `${window.location.origin}/dashboard`,
        }),
      });

      // Always show the same message regardless of response
      // to prevent email enumeration
      setSubmitted(true);
    } catch {
      // Even on error, show the same message
      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#202020] flex items-center justify-center px-4">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#0C969C] mb-6">
              <Mail className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-3">Check your inbox</h1>
            <p className="text-gray-400 leading-relaxed">
              If this email is authorized, a login link has been sent to your inbox.
              Click the link to sign in to your account.
            </p>
          </div>
          <button
            onClick={() => {
              setSubmitted(false);
              setEmail("");
            }}
            className="w-full py-3 px-4 rounded-xl border border-gray-700 text-gray-300 hover:bg-gray-800 transition-colors"
          >
            Use a different email
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#202020] flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#0C969C] mb-6">
            <ArrowRight className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Mutadawel Academy</h1>
          <p className="text-gray-400">أكاديمية متداول</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                disabled={loading}
                className="w-full pl-11 pr-4 py-3 rounded-xl bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-[#0C969C] focus:ring-1 focus:ring-[#0C969C] transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !email.trim()}
            className="w-full py-3 px-4 rounded-xl bg-[#0C969C] text-white font-medium hover:bg-[#0a8085] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Sending link...
              </>
            ) : (
              "Send login link"
            )}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          Access is by invitation only. No public registration.
        </p>
      </div>
    </div>
  );
}
