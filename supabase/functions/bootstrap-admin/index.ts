/*
 * bootstrap-admin Edge Function
 *
 * Secure, one-time Super Admin initialization.
 *
 * Security:
 * - Protected by a BOOTSTRAP_TOKEN secret that must be passed in the X-Bootstrap-Token header.
 * - Reads the admin email from the BOOTSTRAP_ADMIN_EMAIL secret (never in frontend code).
 * - Idempotent: checks platform_settings.bootstrap_completed. If true, returns "locked" and does nothing.
 * - After success, sets bootstrap_completed = true so it can never run again.
 * - Uses the service role key server-side only. Never exposed to the browser.
 * - verify_jwt = false because no admin exists yet to have a JWT.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-Bootstrap-Token",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // Only allow POST
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify the bootstrap token
    const bootstrapToken = Deno.env.get("BOOTSTRAP_TOKEN");
    if (!bootstrapToken) {
      return new Response(
        JSON.stringify({ error: "Bootstrap not configured" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const providedToken = req.headers.get("X-Bootstrap-Token");
    if (!providedToken || providedToken !== bootstrapToken) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get Supabase config
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const adminEmail = Deno.env.get("BOOTSTRAP_ADMIN_EMAIL");
    if (!adminEmail) {
      return new Response(
        JSON.stringify({ error: "Admin email not configured" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase admin client with service role key
    const { createClient } = await import("npm:@supabase/supabase-js@2.57.4");
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Check if bootstrap has already been completed
    const { data: bootstrapSetting, error: checkError } = await supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "bootstrap_completed")
      .maybeSingle();

    if (checkError) {
      return new Response(
        JSON.stringify({ error: "Failed to check bootstrap status" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (bootstrapSetting && bootstrapSetting.value === true) {
      return new Response(
        JSON.stringify({ error: "Bootstrap already completed. This endpoint is permanently locked." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if a user with this email already exists in auth.users
    const { data: existingUsers, error: listError } = await supabase.auth.admin.listUsers();

    let authUserId: string | null = null;

    if (!listError && existingUsers) {
      const existing = existingUsers.users.find(
        (u: { email?: string }) => u.email?.toLowerCase() === adminEmail.toLowerCase()
      );
      if (existing) {
        authUserId = existing.id;
      }
    }

    // If no existing user, create one via inviteUserByEmail
    if (!authUserId) {
      const { data: inviteData, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(
        adminEmail
      );

      if (inviteError) {
        return new Response(
          JSON.stringify({ error: "Failed to create admin user: " + inviteError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      authUserId = inviteData?.user?.id ?? null;
    }

    if (!authUserId) {
      return new Response(
        JSON.stringify({ error: "Failed to obtain admin user ID" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Set the user's role to super_admin in raw_app_meta_data (JWT-embedded, user-immutable)
    const { error: updateError } = await supabase.auth.admin.updateUserById(authUserId, {
      app_metadata: { role: "super_admin" },
    });

    if (updateError) {
      return new Response(
        JSON.stringify({ error: "Failed to set admin role: " + updateError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Ensure profiles row exists with super_admin role
    const { error: profileError } = await supabase
      .from("profiles")
      .upsert({
        id: authUserId,
        email: adminEmail,
        role: "super_admin",
        status: "active",
        updated_at: new Date().toISOString(),
      }, { onConflict: "id" });

    if (profileError) {
      return new Response(
        JSON.stringify({ error: "Failed to create admin profile: " + profileError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create or update student_access record for the admin email
    const { error: accessError } = await supabase
      .from("student_access")
      .upsert({
        email: adminEmail.toLowerCase(),
        status: "authorized",
        authorized_by: authUserId,
        updated_at: new Date().toISOString(),
      }, { onConflict: "email" });

    if (accessError) {
      // Non-fatal — admin can still function without this
      console.error("Failed to create student_access record:", accessError.message);
    }

    // Mark bootstrap as completed
    const { error: lockError } = await supabase
      .from("platform_settings")
      .upsert({
        key: "bootstrap_completed",
        value: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: "key" });

    if (lockError) {
      return new Response(
        JSON.stringify({ error: "Failed to lock bootstrap: " + lockError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log to audit_logs
    await supabase.from("audit_logs").insert({
      actor_user_id: authUserId,
      action: "bootstrap_admin_completed",
      target_type: "platform_settings",
      metadata: { admin_email: adminEmail },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: "Super Admin bootstrap completed successfully. An invitation email has been sent to " + adminEmail + ". Click the link in the email to complete authentication.",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
