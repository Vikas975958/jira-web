import { supabase } from "@/lib/supabaseconfig";

export const profileService = {
  /**
   * Fetch all profiles from Supabase 'profiles' table.
   * @returns {Promise<Array>} List of user profiles
   */
  async fetchProfiles() {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("fetchProfiles error:", error);
      throw error;
    }

    return data || [];
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
   * Update profile record.
   * @param {string} userId
   * @param {Object} updates - Fields to update (full_name, phone, profile_photo, etc.)
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
