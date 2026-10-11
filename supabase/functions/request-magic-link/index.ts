/*
 * request-magic-link Edge Function
 *
 * The authorized-email gate for passwordless login.
 *
 * Security:
 * - Receives an email from the frontend.
 * - Uses the service role key to check student_access for an authorized, non-expired record.
 * - If authorized: sends a magic link via signInWithOtp.
 * - If NOT authorized: does nothing (no email sent, no user created).
 * - In BOTH cases, returns the same generic success-looking response.
 *   This prevents email enumeration — an attacker cannot distinguish
 *   authorized from unauthorized emails.
 * - verify_jwt = false because this is called before authentication.
 * - Never returns the service role key or any secret.
 * - Never reveals whether the email exists in the database.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const GENERIC_RESPONSE = JSON.stringify({
  success: true,
  message: "If this email is authorized, a login link has been sent to your inbox.",
});

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const email = body?.email?.trim()?.toLowerCase();

    if (!email || !email.includes("@")) {
      // Return generic response even for invalid input to avoid information leakage
      return new Response(GENERIC_RESPONSE, {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const { createClient } = await import("npm:@supabase/supabase-js@2.57.4");

    // Create admin client with service role key for the authorization check
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Check if the email is authorized in student_access
    const { data: accessRecord, error: accessError } = await adminClient
      .from("student_access")
      .select("status, expires_at")
      .eq("email", email)
      .maybeSingle();

    // If there's an error checking, or no record, or status is not 'authorized',
    // or the access has expired — return the generic response without sending anything.
    if (accessError || !accessRecord) {
      return new Response(GENERIC_RESPONSE, {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (accessRecord.status !== "authorized") {
      return new Response(GENERIC_RESPONSE, {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check expiration
    if (accessRecord.expires_at) {
      const expiry = new Date(accessRecord.expires_at);
      if (expiry <= new Date()) {
        return new Response(GENERIC_RESPONSE, {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Also check if this is an admin email — admins should be able to log in too.
    // The student_access check above covers admins since bootstrap creates a
    // student_access record for the admin email as well.

    // Email is authorized — send the magic link.
    // We use the anon-key client for signInWithOtp since it's a client-side auth operation
    // that doesn't require service role privileges, but we trigger it server-side
    // so the authorization check stays on the server.
    const authClient = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { error: otpError } = await authClient.auth.signInWithOtp({
      email: email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: body?.redirectUrl || undefined,
      },
    });

    if (otpError) {
      // Don't reveal the error to the client — return generic response
      console.error("Magic link send failed for authorized email:", otpError.message);
      return new Response(GENERIC_RESPONSE, {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Success — return the same generic response
    return new Response(GENERIC_RESPONSE, {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    // On any error, return the generic response to avoid information leakage
    return new Response(GENERIC_RESPONSE, {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
