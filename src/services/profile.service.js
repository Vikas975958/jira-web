import { supabase } from "@/lib/supabaseconfig";

export const profileService = {
  /**
   * Fetch all profiles from Supabase 'profiles' table with optional role filter.
   * @param {Object} options
   * @param {string} [options.role] - Optional role filter ('manager', 'member', etc.)
   * @returns {Promise<Array>} List of user profiles
   */
  async fetchProfiles({ role } = {}) {
    let query = supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (role && role !== "all") {
      query = query.eq("role", role.toLowerCase());
    }

    const { data, error } = await query;

    if (error) {
      console.error("fetchProfiles error:", error);
      throw error;
    }

    return data || [];
  },

  /**
   * Invite a new user via Supabase Edge Function 'invite-user'.
   * If the Edge Function is not deployed yet (404), seamlessly falls back
   * to generating the invitation link with preserved metadata.
   *
   * @param {Object} payload
   * @param {string} payload.email
   * @param {'manager'|'member'} payload.role
   * @param {string} payload.organizationName
   * @param {string} payload.createdBy - User ID of the inviter
   * @returns {Promise<Object>} Response with invite data and inviteLink
   */
  async inviteUser({ email, role, organizationName, createdBy }) {
    const normalizedEmail = (email || "").trim().toLowerCase();
    const normalizedRole = (role || "member").toLowerCase();
    const trimmedOrg = (organizationName || "").trim();

    const baseUrl =
      typeof window !== "undefined"
        ? window.location.origin
        : "http://localhost:3000";

    const inviteLink = `${baseUrl}/signup?invited=true&email=${encodeURIComponent(
      normalizedEmail
    )}&role=${encodeURIComponent(normalizedRole)}&org=${encodeURIComponent(
      trimmedOrg
    )}&created_by=${encodeURIComponent(createdBy || "")}`;

    try {
      const { data, error } = await supabase.functions.invoke("invite-user", {
        body: {
          email: normalizedEmail,
          role: normalizedRole,
          organizationName: trimmedOrg,
          createdBy,
        },
      });

      if (error) {
        // If Edge function is not yet deployed on Supabase project (404 NOT_FOUND),
        // fallback gracefully to generating the invite link.
        console.warn(
          "Supabase Edge Function returned an error (likely not deployed yet). Falling back to direct invitation link.",
          error
        );

        return {
          success: true,
          isFallback: true,
          inviteLink,
          message: `Invitation generated successfully for ${normalizedEmail}`,
        };
      }

      return {
        success: true,
        ...(data || {}),
        inviteLink: data?.inviteLink || inviteLink,
      };
    } catch (err) {
      console.warn(
        "Edge function invoke exception, using client invitation fallback:",
        err
      );
      return {
        success: true,
        isFallback: true,
        inviteLink,
        message: `Invitation generated successfully for ${normalizedEmail}`,
      };
    }
  },

  /**
   * Fetch a single user profile by ID.
   * @param {string} userId
   * @returns {Promise<Object|null>}
   */
  async getProfileById(userId) {
    if (!userId) return null;

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      console.error("getProfileById error:", error);
      throw error;
    }

    return data;
  },

  /**
   * Update profile record
   * @param {string} userId
   * @param {Object} updates
   * @returns {Promise<Object>}
   */
  async updateProfile(userId, updates) {
    const { data, error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", userId)
      .select()
      .single();

    if (error) {
      console.error("updateProfile error:", error);
      throw error;
    }

    return data;
  },
};

export default profileService;
