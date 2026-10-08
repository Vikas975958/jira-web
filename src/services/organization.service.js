import { supabase } from "@/lib/supabaseconfig";

/**
 * Generate a clean URL-friendly slug from a string.
 * @param {string} text
 * @returns {string}
 */
export const slugify = (text = "") => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-") // Replace spaces with -
    .replace(/&/g, "-and-") // Replace & with 'and'
    .replace(/[^\w-]+/g, "") // Remove all non-word chars
    .replace(/--+/g, "-") // Replace multiple - with single -
    .replace(/^-+/, "") // Trim - from start of text
    .replace(/-+$/, ""); // Trim - from end of text
};

export const organizationService = {
  slugify,

  /**
   * Check if a slug is available.
   * @param {string} slug
   * @param {string} [excludeOrgId]
   * @returns {Promise<boolean>}
   */
  async checkSlugAvailable(slug, excludeOrgId = null) {
    if (!slug) return false;

    let query = supabase
      .from("organizations")
      .select("id")
      .eq("slug", slug.toLowerCase().trim());

    if (excludeOrgId) {
      query = query.neq("id", excludeOrgId);
    }

    const { data, error } = await query.maybeSingle();
    if (error) {
      console.error("checkSlugAvailable error:", error);
      return false;
    }
    return !data;
  },

  /**
   * Create a new organization with complete fields.
   * @param {Object} params
   * @returns {Promise<Object>}
   */
  async createOrganization(params) {
    const {
      name,
      slug,
      logo_url,
      email,
      phone,
      website,
      industry,
      company_size,
      description,
      address,
      city,
      state,
      country,
      postal_code,
      timezone = "UTC",
      currency = "USD",
      status = "active",
      created_by,
      ownerId,
      owner_id,
    } = params;

    const creatorId = created_by || ownerId || owner_id;

    // Ensure slug is generated if not provided
    let finalSlug = slug ? slugify(slug) : slugify(name);
    if (!finalSlug) {
      finalSlug = `org-${Math.random().toString(36).substring(2, 8)}`;
    }

    // Build the insert payload
    const insertPayload = {
      name: name?.trim(),
      slug: finalSlug,
      logo_url: logo_url || null,
      email: email?.trim() || null,
      phone: phone?.trim() || null,
      website: website?.trim() || null,
      industry: industry || null,
      company_size: company_size || null,
      description: description?.trim() || null,
      address: address?.trim() || null,
      city: city?.trim() || null,
      state: state?.trim() || null,
      country: country?.trim() || null,
      postal_code: postal_code?.trim() || null,
      timezone: timezone || "UTC",
      currency: currency || "USD",
      status: status || "active",
      created_by: creatorId,
      owner_id: creatorId,
    };

    const { data, error } = await supabase
      .from("organizations")
      .insert(insertPayload)
      .select()
      .single();

    if (error) {
      console.error("createOrganization error:", error);
      throw error;
    }

    return data;
  },

  /**
   * Add a user as a member of an organization.
   * @param {Object} params
   * @param {string} params.organizationId
   * @param {string} params.userId
   * @param {string} params.role - 'owner' | 'manager' | 'member'
   * @returns {Promise<Object>}
   */
  async addMember({ organizationId, userId, role = "member" }) {
    const { data, error } = await supabase
      .from("organization_members")
      .insert({
        organization_id: organizationId,
        user_id: userId,
        role,
        status: "active",
      })
      .select()
      .single();

    if (error) {
      console.error("addMember error:", error);
      throw error;
    }

    return data;
  },

  /**
   * Get all organizations for a user (via organization_members).
   * @param {string} userId
   * @returns {Promise<Array>} List of organizations with membership info
   */
  async getUserOrganizations(userId) {
    const { data, error } = await supabase
      .from("organization_members")
      .select(`
        id,
        role,
        status,
        joined_at,
        organizations (
          id,
          name,
          slug,
          logo_url,
          email,
          phone,
          website,
          industry,
          company_size,
          description,
          address,
          city,
          state,
          country,
          postal_code,
          timezone,
          currency,
          status,
          created_by,
          owner_id,
          created_at,
          updated_at
        )
      `)
      .eq("user_id", userId)
      .eq("status", "active");

    if (error) {
      console.error("getUserOrganizations error:", error);
      throw error;
    }

    return data || [];
  },

  /**
   * Get a single organization by ID.
   * @param {string} orgId
   * @returns {Promise<Object|null>}
   */
  async getOrganizationById(orgId) {
    if (!orgId) return null;

    const { data, error } = await supabase
      .from("organizations")
      .select("*")
      .eq("id", orgId)
      .maybeSingle();

    if (error) {
      console.error("getOrganizationById error:", error);
      throw error;
    }

    return data;
  },

  /**
   * Get an organization by slug.
   * @param {string} slug
   * @returns {Promise<Object|null>}
   */
  async getOrganizationBySlug(slug) {
    if (!slug) return null;

    const { data, error } = await supabase
      .from("organizations")
      .select("*")
      .eq("slug", slug.toLowerCase().trim())
      .maybeSingle();

    if (error) {
      console.error("getOrganizationBySlug error:", error);
      throw error;
    }

    return data;
  },

  /**
   * Get members of an organization with user profiles.
   * @param {string} organizationId
   * @returns {Promise<Array>}
   */
  async getOrganizationMembers(organizationId) {
    const { data, error } = await supabase
      .from("organization_members")
      .select(`
        id,
        user_id,
        role,
        status,
        joined_at,
        profiles (
          id,
          full_name,
          email,
          phone,
          profile_photo
        )
      `)
      .eq("organization_id", organizationId)
      .order("joined_at", { ascending: true });

    if (error) {
      console.error("getOrganizationMembers error:", error);
      throw error;
    }

    return data || [];
  },

  /**
   * Update organization details.
   * @param {string} orgId
   * @param {Object} updates
   * @returns {Promise<Object>}
   */
  async updateOrganization(orgId, updates) {
    const cleanUpdates = { ...updates, updated_at: new Date().toISOString() };

    const { data, error } = await supabase
      .from("organizations")
      .update(cleanUpdates)
      .eq("id", orgId)
      .select()
      .single();

    if (error) {
      console.error("updateOrganization error:", error);
      throw error;
    }

    return data;
  },

  /**
   * Delete an organization.
   * @param {string} orgId
   * @returns {Promise<boolean>}
   */
  async deleteOrganization(orgId) {
    const { error } = await supabase
      .from("organizations")
      .delete()
      .eq("id", orgId);

    if (error) {
      console.error("deleteOrganization error:", error);
      throw error;
    }

    return true;
  },
};

export default organizationService;
