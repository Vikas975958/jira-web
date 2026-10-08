// @ts-nocheck
// Supabase Edge Function: invite-user
// Handles sending secure invitations with role, organization_name, and created_by metadata.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
  serve(handler: (req: Request) => Promise<Response> | Response): void;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return new Response(
        JSON.stringify({
          error: "Server configuration missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 1. Verify caller authorization
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing Authorization header" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseClient = createClient(
      supabaseUrl,
      supabaseAnonKey || "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const {
      data: { user: callerUser },
      error: callerError,
    } = await supabaseClient.auth.getUser();

    if (callerError || !callerUser) {
      return new Response(
        JSON.stringify({
          error: "Unauthorized. Valid session token required to invite users.",
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 2. Parse and validate request body
    const body = await req.json();
    const { email, role, organizationName, createdBy } = body;

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return new Response(
        JSON.stringify({ error: "A valid email address is required." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const normalizedRole = (role || "").toLowerCase();
    if (!["manager", "member"].includes(normalizedRole)) {
      return new Response(
        JSON.stringify({ error: "Role must be either 'manager' or 'member'." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!organizationName || typeof organizationName !== "string") {
      return new Response(
        JSON.stringify({ error: "Organization name is required." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Use caller's verified ID as inviter if createdBy is provided or fallback to callerUser.id
    const inviterId = callerUser.id || createdBy;

    // 3. Initialize admin client with service role key
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const siteUrl =
      Deno.env.get("SITE_URL") ||
      req.headers.get("origin") ||
      "http://localhost:3000";

    const redirectUrl = `${siteUrl}/signup?invited=true&email=${encodeURIComponent(
      email
    )}&role=${encodeURIComponent(normalizedRole)}&org=${encodeURIComponent(
      organizationName
    )}&created_by=${encodeURIComponent(inviterId)}`;

    // 4. Send invite email with user metadata
    const { data: inviteData, error: inviteError } =
      await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        data: {
          role: normalizedRole,
          organization_name: organizationName,
          created_by: inviterId,
          invited_by_email: callerUser.email,
        },
        redirectTo: redirectUrl,
      });

    if (inviteError) {
      console.error("Supabase invite error:", inviteError);
      return new Response(
        JSON.stringify({
          error: inviteError.message || "Failed to send invitation email.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Invitation email sent successfully to ${email}`,
        data: inviteData,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err: any) {
    console.error("Edge function unexpected error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
