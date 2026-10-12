import { supabase } from "@/lib/supabaseconfig";
import { MEMBER_ROLE, MANAGER_ROLE, OWNER_ROLE } from "@/utils/constants";

export const profileService = {
  /**
   * Fetch all profiles from Supabase 'profiles' table.
   * Protects owner private details from managers and limits members to self.
   * @param {Object} [context] - { currentUserId, currentUserRole }
   * @returns {Promise<Array>} List of user profiles
   */
  async fetchProfiles(context = {}) {
    const { currentUserId, currentUserRole } = context;

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("fetchProfiles error:", error);
      throw error;
    }

    let profiles = data || [];

    // Managers cannot see original owner's private profile details
    if (currentUserRole === MANAGER_ROLE) {
      profiles = profiles.map((p) => {
        if (p.role === OWNER_ROLE) {
          return {
            ...p,
            full_name: p.full_name || "Workspace Owner",
            email: "[Protected Owner Account]",
            phone: null,
            is_owner_protected: true,
          };
        }
        return p;
      });
    }

    // Members see only themselves
    if (currentUserRole === MEMBER_ROLE && currentUserId) {
      profiles = profiles.filter((p) => p.id === currentUserId);
    }

    return profiles;
  },

  /**
   * Fetch a single user profile by ID.
   * @param {string} userId
   * @param {Object} [context] - { currentUserId, currentUserRole }
   * @returns {Promise<Object|null>}
   */
  async getProfileById(userId, context = {}) {
    if (!userId) return null;
    const { currentUserRole } = context;

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      console.error("getProfileById error:", error);
      throw error;
    }

    if (!data) return null;

    if (currentUserRole === MANAGER_ROLE && data.role === OWNER_ROLE) {
      return {
        ...data,
        full_name: data.full_name || "Workspace Owner",
        email: "[Protected Owner Account]",
        phone: null,
        is_owner_protected: true,
      };
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
