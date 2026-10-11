import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { Profile, UserRole } from "@/types/database";

type AuthStatus = "loading" | "authenticated" | "unauthenticated" | "not_authorized";

interface AuthState {
  status: AuthStatus;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  role: UserRole | null;
}

interface AuthContextValue extends AuthState {
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    status: "loading",
    session: null,
    user: null,
    profile: null,
    role: null,
  });

  async function loadProfile(user: User): Promise<{ profile: Profile | null; status: AuthStatus }> {
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (error || !profile) {
      return { profile: null, status: "not_authorized" };
    }

    const typedProfile = profile as Profile;

    // Use the server-side RPC to verify authorization.
    // This checks student_access (which students can't read via RLS)
    // and returns a boolean without exposing any sensitive data.
    const { data: isAuthorized, error: rpcError } = await supabase.rpc(
      "check_student_authorization"
    );

    if (rpcError || !isAuthorized) {
      return { profile: typedProfile, status: "not_authorized" };
    }

    return { profile: typedProfile, status: "authenticated" };
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        setState({
          status: "unauthenticated",
          session: null,
          user: null,
          profile: null,
          role: null,
        });
        return;
      }

      (async () => {
        const { profile, status } = await loadProfile(session.user);
        setState({
          status,
          session,
          user: session.user,
          profile,
          role: profile?.role ?? null,
        });

        if (status === "authenticated" && profile) {
          await supabase
            .from("profiles")
            .update({ last_login_at: new Date().toISOString() })
            .eq("id", session.user.id);
        }
      })();
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      (async () => {
        if (event === "SIGNED_OUT" || !session) {
          setState({
            status: "unauthenticated",
            session: null,
            user: null,
            profile: null,
            role: null,
          });
          return;
        }

        const { profile, status } = await loadProfile(session.user);
        setState({
          status,
          session,
          user: session.user,
          profile,
          role: profile?.role ?? null,
        });

        if (status === "authenticated" && profile) {
          await supabase
            .from("profiles")
            .update({ last_login_at: new Date().toISOString() })
            .eq("id", session.user.id);
        }
      })();
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    setState({
      status: "unauthenticated",
      session: null,
      user: null,
      profile: null,
      role: null,
    });
  }

  async function refreshProfile() {
    if (!state.user) return;
    const { profile, status } = await loadProfile(state.user);
    setState((prev) => ({
      ...prev,
      profile,
      status,
      role: profile?.role ?? null,
    }));
  }

  return (
    <AuthContext.Provider value={{ ...state, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
