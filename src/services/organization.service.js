import { supabase } from "@/lib/supabaseconfig";
import { generateInvitationToken, hashToken } from "@/utils/token";
import { MEMBER_ROLE, MANAGER_ROLE, OWNER_ROLE } from "@/utils/constants";

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
   * Automatically sets created_by to the currently authenticated user's ID.
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
    } = params;

    // Automatically resolve creator ID from active auth session
    let authenticatedUserId = created_by;
    try {
      const { data: authData } = await supabase.auth.getUser();
      if (authData?.user?.id) {
        authenticatedUserId = authData.user.id;
      }
    } catch (_) {}

    if (!authenticatedUserId) {
      throw new Error("Authentication required to create an organization.");
    }

    // Ensure slug is generated if not provided
    let finalSlug = slug ? slugify(slug) : slugify(name);
    if (!finalSlug) {
      finalSlug = `org-${Math.random().toString(36).substring(2, 8)}`;
    }

    // Build the insert payload with strictly allowed fields
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
      created_by: authenticatedUserId,
      owner_id: authenticatedUserId,
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
   * Add a user as a member of an organization in organization_members.
   * @param {Object} params
   * @param {string} params.organizationId
   * @param {string} params.userId
   * @param {string} params.role - 'owner' | 'manager' | 'member'
   * @returns {Promise<Object>}
   */
  async addMember({ organizationId, userId, role = MEMBER_ROLE }) {
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
   * Get all organizations for a user (via organization_members or created_by).
   * @param {string} userId
   * @returns {Promise<Array>} List of organizations with membership info
   */
  async getUserOrganizations(userId) {
    if (!userId) return [];

    // 1. Fetch memberships from organization_members
    const { data: memberData, error: memberError } = await supabase
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

    if (memberError) {
      console.error("getUserOrganizations member fetch error:", memberError);
    }

    const orgs = (memberData || []).filter((item) => item.organizations);

    // 2. Also check if the user is a creator of any organization not yet listed in organization_members
    const existingOrgIds = new Set(orgs.map((o) => o.organizations?.id));

    const { data: createdOrgs, error: createdError } = await supabase
      .from("organizations")
      .select("*")
      .eq("created_by", userId);

    if (!createdError && createdOrgs) {
      for (const org of createdOrgs) {
        if (!existingOrgIds.has(org.id)) {
          orgs.push({
            id: `creator-${org.id}`,
            role: OWNER_ROLE,
            status: "active",
            joined_at: org.created_at,
            organizations: org,
          });
        }
      }
    }

    return orgs;
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
   * Get active members of an organization with user profiles.
   * Enforces role-based visibility and privacy:
   * - Owners: See only members they created or invited (plus self).
   * - Managers: Team members visible, but original owner's private account details masked.
   * - Members: Restricted to task details only; returns only self.
   *
   * @param {string} organizationId
   * @param {Object} [context] - { currentUserId, currentUserRole }
   * @returns {Promise<Array>}
   */
  async getOrganizationMembers(organizationId, context = {}) {
    if (!organizationId) return [];

    const { currentUserId, currentUserRole } = context;

    // 1. Fetch from organization_members
    let rawMembers = null;
    let queryError = null;

    const resWithCreatedBy = await supabase
      .from("organization_members")
      .select(`
        id,
        user_id,
        role,
        status,
        joined_at,
        created_by,
        invited_by,
        profiles (
          id,
          full_name,
          email,
          phone
        )
      `)
      .eq("organization_id", organizationId)
      .order("joined_at", { ascending: true });

    if (!resWithCreatedBy.error && resWithCreatedBy.data) {
      rawMembers = resWithCreatedBy.data;
    } else {
      // Fallback if created_by / invited_by columns not in remote schema yet
      const fallbackRes = await supabase
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
            phone
          )
        `)
        .eq("organization_id", organizationId)
        .order("joined_at", { ascending: true });

      rawMembers = fallbackRes.data || [];
      queryError = fallbackRes.error;
    }

    if (queryError) {
      console.error("getOrganizationMembers error:", queryError);
    }

    let members = rawMembers || [];

    // Fetch organization info to reliably identify Owner / Workspace Creator
    let orgOwnerId = null;
    try {
      const { data: orgData } = await supabase
        .from("organizations")
        .select("id, name, created_by, owner_id")
        .eq("id", organizationId)
        .maybeSingle();
      orgOwnerId = orgData?.owner_id || orgData?.created_by || null;
    } catch (_) {}

    // Tag the owner in raw members
    members = members.map((m) => {
      if (m.role === OWNER_ROLE || (orgOwnerId && m.user_id === orgOwnerId)) {
        return { ...m, is_owner: true, role: OWNER_ROLE };
      }
      return m;
    });

    // If owner is not in members list (e.g. org created without explicit membership row), inject them
    if (orgOwnerId && !members.some((m) => m.user_id === orgOwnerId || m.role === OWNER_ROLE)) {
      try {
        const { data: ownerProf } = await supabase
          .from("profiles")
          .select("id, full_name, email, phone")
          .eq("id", orgOwnerId)
          .maybeSingle();
        if (ownerProf) {
          members.unshift({
            id: `owner-${orgOwnerId}`,
            user_id: orgOwnerId,
            role: OWNER_ROLE,
            status: "active",
            is_owner: true,
            profiles: ownerProf,
            joined_at: new Date().toISOString(),
          });
        }
      } catch (_) {}
    }

    // 2. Fetch requests created by this owner to cross-reference invited members
    let ownerInvitedIdentifiers = new Set();
    if (currentUserRole === OWNER_ROLE && currentUserId) {
      try {
        const [reqMembers, reqManagers] = await Promise.all([
          supabase
            .from("request_member")
            .select("email, accepted_by, invited_by, requested_by")
            .eq("organization_id", organizationId)
            .or(`requested_by.eq.${currentUserId},invited_by.eq.${currentUserId}`),
          supabase
            .from("request_manager")
            .select("email, accepted_by, invited_by, requested_by")
            .eq("organization_id", organizationId)
            .or(`requested_by.eq.${currentUserId},invited_by.eq.${currentUserId}`),
        ]);

        (reqMembers.data || []).forEach((r) => {
          if (r.email) ownerInvitedIdentifiers.add(r.email.toLowerCase().trim());
          if (r.accepted_by) ownerInvitedIdentifiers.add(r.accepted_by);
        });
        (reqManagers.data || []).forEach((r) => {
          if (r.email) ownerInvitedIdentifiers.add(r.email.toLowerCase().trim());
          if (r.accepted_by) ownerInvitedIdentifiers.add(r.accepted_by);
        });
      } catch (_) {}
    }

    // 3. Apply role-based filtering and visibility rules

    // A. OWNER:
    // Sign in: owner; show details; organisation member or manager
    // Owner sees all members and managers in their organization.
    if (currentUserRole === OWNER_ROLE) {
      return members;
    }

    // B. MANAGER:
    // Sign in: manager; show lisitng of members only who create your shelf member
    // Manager: present owner, who created
    if (currentUserRole === MANAGER_ROLE && currentUserId) {
      let managerInvitedEmails = new Set();
      try {
        const { data: reqMembers } = await supabase
          .from("request_member")
          .select("email, accepted_by, invited_by, requested_by")
          .eq("organization_id", organizationId)
          .or(`requested_by.eq.${currentUserId},invited_by.eq.${currentUserId}`);

        (reqMembers || []).forEach((r) => {
          if (r.email) managerInvitedEmails.add(r.email.toLowerCase().trim());
          if (r.accepted_by) managerInvitedEmails.add(r.accepted_by);
        });
      } catch (_) {}

      return members.filter((m) => {
        // 1. Present Owner, who created
        if (m.role === OWNER_ROLE || (orgOwnerId && m.user_id === orgOwnerId)) {
          return true;
        }

        // 2. Hide all other managers completely (no manager listing shown)
        if (m.role === MANAGER_ROLE) {
          return false;
        }

        // 3. ONLY show members created or invited by this manager itself
        if (m.created_by === currentUserId || m.invited_by === currentUserId) return true;
        if (
          managerInvitedEmails.has(m.user_id) ||
          (m.profiles?.email && managerInvitedEmails.has(m.profiles.email.toLowerCase().trim()))
        ) {
          return true;
        }

        return false;
      });
    }

    // C. MEMBER:
    // Sign in: member: no organisation details; manager listing and other member listing shown
    // Member: present owner and manager who created
    if (currentUserRole === MEMBER_ROLE) {
      const myRecord = members.find((m) => m.user_id === currentUserId);
      let creatorManagerId = myRecord?.created_by || myRecord?.invited_by || null;

      if (!creatorManagerId) {
        try {
          const { data: req } = await supabase
            .from("request_member")
            .select("requested_by, invited_by")
            .eq("organization_id", organizationId)
            .or(
              `accepted_by.eq.${currentUserId}${
                myRecord?.profiles?.email ? `,email.eq.${myRecord.profiles.email}` : ""
              }`
            )
            .maybeSingle();
          creatorManagerId = req?.requested_by || req?.invited_by || null;
        } catch (_) {}
      }

      if (!creatorManagerId) {
        // Fallback: if only 1 manager exists in the org, they are the manager
        const managers = members.filter((m) => m.role === MANAGER_ROLE);
        if (managers.length === 1) {
          creatorManagerId = managers[0].user_id;
        }
      }

      return members.filter((m) => {
        // 1. Present Owner, who created
        if (m.role === OWNER_ROLE || (orgOwnerId && m.user_id === orgOwnerId)) {
          return true;
        }

        // 2. Present Manager, who created this member
        if (creatorManagerId && m.user_id === creatorManagerId && m.role === MANAGER_ROLE) {
          return true;
        }

        // 3. Self is always shown
        if (m.user_id === currentUserId) {
          return true;
        }

        // 4. Other member listing shown (teammates created by that same manager/creator)
        if (
          creatorManagerId &&
          m.role === MEMBER_ROLE &&
          (m.created_by === creatorManagerId || m.invited_by === creatorManagerId)
        ) {
          return true;
        }

        return false;
      });
    }

    return members;
  },

  /**
   * Get leadership information (owner who created, manager who created) for the current organization.
   * @param {string} organizationId
   * @param {Object} [context] - { currentUserId, currentUserRole }
   * @returns {Promise<{ owner: Object|null, manager: Object|null }>}
   */
  async getOrganizationLeadership(organizationId, context = {}) {
    if (!organizationId) return { owner: null, manager: null };
    const { currentUserId, currentUserRole } = context;

    try {
      const allMembers = await this.getOrganizationMembers(organizationId, {
        currentUserId,
        currentUserRole: OWNER_ROLE, // fetch full list to extract leadership profiles
      });

      const { data: orgData } = await supabase
        .from("organizations")
        .select("id, name, created_by, owner_id")
        .eq("id", organizationId)
        .maybeSingle();

      let owner =
        allMembers.find(
          (m) => m.role === OWNER_ROLE || (orgOwnerId && m.user_id === orgOwnerId)
        ) || null;

      if (!owner && orgOwnerId) {
        try {
          const { data: ownerProf } = await supabase
            .from("profiles")
            .select("id, full_name, email, phone")
            .eq("id", orgOwnerId)
            .maybeSingle();
          if (ownerProf) {
            owner = {
              id: `owner-${orgOwnerId}`,
              user_id: orgOwnerId,
              role: OWNER_ROLE,
              is_owner: true,
              profiles: ownerProf,
            };
          }
        } catch (_) {}
      }

      let manager = null;
      if (currentUserRole === MEMBER_ROLE && currentUserId) {
        const myMember = allMembers.find((m) => m.user_id === currentUserId);
        let managerId = myMember?.created_by || myMember?.invited_by;
        if (!managerId) {
          const { data: req } = await supabase
            .from("request_member")
            .select("requested_by, invited_by")
            .eq("organization_id", organizationId)
            .or(
              `accepted_by.eq.${currentUserId}${
                myMember?.profiles?.email ? `,email.eq.${myMember.profiles.email}` : ""
              }`
            )
            .maybeSingle();
          managerId = req?.requested_by || req?.invited_by;
        }

        if (managerId) {
          manager =
            allMembers.find((m) => m.user_id === managerId && m.role === MANAGER_ROLE) ||
            null;

          if (!manager) {
            try {
              const { data: managerProf } = await supabase
                .from("profiles")
                .select("id, full_name, email, phone")
                .eq("id", managerId)
                .maybeSingle();
              if (managerProf) {
                manager = {
                  id: `manager-${managerId}`,
                  user_id: managerId,
                  role: MANAGER_ROLE,
                  profiles: managerProf,
                };
              }
            } catch (_) {}
          }
        }
        if (!manager) {
          manager = allMembers.find((m) => m.role === MANAGER_ROLE) || null;
        }
      }

      return { owner, manager };
    } catch (err) {
      console.error("getOrganizationLeadership error:", err);
      return { owner: null, manager: null };
    }
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

  // ============================================================
  // MEMBER REQUEST MANAGEMENT (request_member table)
  // ============================================================
  // MEMBER REQUEST MANAGEMENT (request_member table)
  // Fields: id, organization_id, email, role, requested_by, status,
  //         invitation_token_hash, expires_at, accepted_by, created_at, updated_at
  // ============================================================

  /**
   * Submit an Add Member request to the request_member table.
   * Generates a secure invitation token, hashes it, and stores the hash and expiry.
   * @param {Object} params
   * @param {string} params.organizationId
   * @param {string} params.email
   * @param {string} [params.fullName]
   * @param {string} [params.message]
   * @param {string} [params.requestedBy]
   * @param {string} [params.invitedBy]
   * @returns {Promise<Object>}
   */
  async createMemberRequest({
    organizationId,
    email,
    fullName = "",
    message = "",
    requestedBy = null,
    invitedBy = null,
  }) {
    if (!organizationId) throw new Error("Organization ID is required.");
    if (!email?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      throw new Error("A valid email address is required.");
    }

    let senderId = requestedBy || invitedBy;
    if (!senderId) {
      try {
        const { data: authData } = await supabase.auth.getUser();
        senderId = authData?.user?.id || null;
      } catch (_) {}
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanFullName = (fullName?.trim()) || cleanEmail.split("@")[0];
    const token = generateInvitationToken();
    const tokenHash = await hashToken(token);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const payload = {
      organization_id: organizationId,
      email: cleanEmail,
      role: MEMBER_ROLE,
      requested_by: senderId,
      invited_by: senderId,
      status: "pending",
      invitation_token_hash: tokenHash,
      expires_at: expiresAt,
      full_name: cleanFullName,
      message: message?.trim() || null,
    };

    let insertedData = null;
    const { data, error } = await supabase
      .from("request_member")
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.warn("Retrying createMemberRequest with fallback payload:", error.message);
      const fallbackPayload = {
        organization_id: organizationId,
        email: cleanEmail,
        full_name: cleanFullName,
        message: message?.trim() || null,
        status: "pending",
        invited_by: senderId,
      };
      const { data: fbData, error: fbErr } = await supabase
        .from("request_member")
        .insert(fallbackPayload)
        .select()
        .single();

      if (fbErr) {
        console.error("createMemberRequest fallback error:", fbErr);
        throw fbErr;
      }
      insertedData = fbData;
    } else {
      insertedData = data;
    }

    const origin =
      typeof window !== "undefined"
        ? window.location.origin
        : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const signupUrl = `${origin}/signup?role=member&token=${token}`;

    return {
      ...insertedData,
      token,
      signupUrl,
      role: MEMBER_ROLE,
    };
  },

  /**
   * Fetch all member requests for an organization.
   * @param {string} organizationId
   * @param {Object} [context] - { currentUserId, currentUserRole }
   * @returns {Promise<Array>}
   */
  async getMemberRequests(organizationId, context = {}) {
    if (!organizationId) return [];
    const { currentUserId, currentUserRole } = context;

    if (currentUserRole === MEMBER_ROLE) return [];

    let query = supabase
      .from("request_member")
      .select("*")
      .eq("organization_id", organizationId);

    // If owner or manager, show only requests created/invited by them
    if ((currentUserRole === OWNER_ROLE || currentUserRole === MANAGER_ROLE) && currentUserId) {
      query = query.or(`requested_by.eq.${currentUserId},invited_by.eq.${currentUserId}`);
    }

    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) {
      console.error("getMemberRequests error:", error);
      return [];
    }

    let results = (data || []).map((r) => ({
      ...r,
      status: r.status === "approved" ? "pending" : r.status,
    }));

    // Strict in-memory check to ensure managers and owners only see requests created/invited by themselves
    if ((currentUserRole === OWNER_ROLE || currentUserRole === MANAGER_ROLE) && currentUserId) {
      results = results.filter(
        (r) => r.requested_by === currentUserId || r.invited_by === currentUserId
      );
    }

    return results;
  },

  // ============================================================
  // MANAGER REQUEST MANAGEMENT (request_manager table)
  // Fields: id, organization_id, email, role, requested_by, status,
  //         invitation_token_hash, expires_at, accepted_by, created_at, updated_at
  // ============================================================

  /**
   * Submit an Add Manager request to the request_manager table.
   * Generates a secure invitation token, hashes it, and stores the hash and expiry.
   * @param {Object} params
   * @param {string} params.organizationId
   * @param {string} params.email
   * @param {string} [params.fullName]
   * @param {string} [params.message]
   * @param {string} [params.requestedBy]
   * @param {string} [params.invitedBy]
   * @returns {Promise<Object>}
   */
  async createManagerRequest({
    organizationId,
    email,
    fullName = "",
    message = "",
    requestedBy = null,
    invitedBy = null,
  }) {
    if (!organizationId) throw new Error("Organization ID is required.");
    if (!email?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      throw new Error("A valid email address is required.");
    }

    let senderId = requestedBy || invitedBy;
    if (!senderId) {
      try {
        const { data: authData } = await supabase.auth.getUser();
        senderId = authData?.user?.id || null;
      } catch (_) {}
    }

    if (senderId && organizationId) {
      try {
        const { data: memberRecord } = await supabase
          .from("organization_members")
          .select("role")
          .eq("organization_id", organizationId)
          .eq("user_id", senderId)
          .maybeSingle();

        if (memberRecord && memberRecord.role !== OWNER_ROLE) {
          throw new Error("Managers are not authorized to invite managers. Only the workspace owner can invite managers.");
        }
      } catch (err) {
        if (err.message && err.message.includes("workspace owner")) {
          throw err;
        }
      }
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanFullName = (fullName?.trim()) || cleanEmail.split("@")[0];
    const token = generateInvitationToken();
    const tokenHash = await hashToken(token);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const payload = {
      organization_id: organizationId,
      email: cleanEmail,
      role: MANAGER_ROLE,
      requested_by: senderId,
      invited_by: senderId,
      status: "pending",
      invitation_token_hash: tokenHash,
      expires_at: expiresAt,
      full_name: cleanFullName,
      message: message?.trim() || null,
    };

    let insertedData = null;
    const { data, error } = await supabase
      .from("request_manager")
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.warn("Retrying createManagerRequest with fallback payload:", error.message);
      const fallbackPayload = {
        organization_id: organizationId,
        email: cleanEmail,
        full_name: cleanFullName,
        message: message?.trim() || null,
        status: "pending",
        invited_by: senderId,
      };
      const { data: fbData, error: fbErr } = await supabase
        .from("request_manager")
        .insert(fallbackPayload)
        .select()
        .single();

      if (fbErr) {
        console.error("createManagerRequest fallback error:", fbErr);
        throw fbErr;
      }
      insertedData = fbData;
    } else {
      insertedData = data;
    }

    const origin =
      typeof window !== "undefined"
        ? window.location.origin
        : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const signupUrl = `${origin}/signup?role=manager&token=${token}`;

    return {
      ...insertedData,
      token,
      signupUrl,
      role: MANAGER_ROLE,
    };
  },

  /**
   * Fetch all manager requests for an organization.
   * @param {string} organizationId
   * @param {Object} [context] - { currentUserId, currentUserRole }
   * @returns {Promise<Array>}
   */
  async getManagerRequests(organizationId, context = {}) {
    if (!organizationId) return [];
    const { currentUserId, currentUserRole } = context;

    // Managers and members should NEVER see manager requests or listings!
    if (currentUserRole === MEMBER_ROLE || currentUserRole === MANAGER_ROLE) return [];

    let query = supabase
      .from("request_manager")
      .select("*")
      .eq("organization_id", organizationId);

    // If owner, show only requests created/invited by them
    if (currentUserRole === OWNER_ROLE && currentUserId) {
      query = query.or(`requested_by.eq.${currentUserId},invited_by.eq.${currentUserId}`);
    }

    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) {
      console.error("getManagerRequests error:", error);
      return [];
    }

    let results = (data || []).map((r) => ({
      ...r,
      status: r.status === "approved" ? "pending" : r.status,
    }));

    if (currentUserRole === OWNER_ROLE && currentUserId) {
      results = results.filter(
        (r) => r.requested_by === currentUserId || r.invited_by === currentUserId
      );
    }

    return results;
  },

  /**
   * Fetch all combined requests (both members & managers) for an organization.
   * @param {string} organizationId
   * @param {Object} [context] - { currentUserId, currentUserRole }
   * @returns {Promise<Array>}
   */
  async getAllRequests(organizationId, context = {}) {
    if (!organizationId) return [];
    const { currentUserId, currentUserRole } = context;

    if (currentUserRole === MEMBER_ROLE) return [];

    // If manager, strictly return only member requests created by this manager
    if (currentUserRole === MANAGER_ROLE) {
      const members = await this.getMemberRequests(organizationId, context);
      return members
        .filter(
          (item) =>
            !currentUserId ||
            item.requested_by === currentUserId ||
            item.invited_by === currentUserId
        )
        .map((item) => ({
          ...item,
          request_type: MEMBER_ROLE,
        }))
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }

    const [members, managers] = await Promise.all([
      this.getMemberRequests(organizationId, context),
      this.getManagerRequests(organizationId, context),
    ]);

    const formattedMembers = members.map((item) => ({
      ...item,
      request_type: MEMBER_ROLE,
    }));

    const formattedManagers = managers.map((item) => ({
      ...item,
      request_type: MANAGER_ROLE,
    }));

    let combined = [...formattedMembers, ...formattedManagers].sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at)
    );

    if (currentUserRole === OWNER_ROLE && currentUserId) {
      combined = combined.filter(
        (r) => r.requested_by === currentUserId || r.invited_by === currentUserId
      );
    }

    return combined;
  },

  // ============================================================
  // APPROVAL AND REJECTION FLOW
  // ============================================================

  /**
   * Approve a request (member or manager).
   * Secure server-side RPC is attempted first, with graceful client fallback.
   * Updates status to 'approved' and assigns membership if user is registered.
   * @param {Object} params
   * @param {string} params.requestId
   * @param {'member'|'manager'} params.type
   * @param {string} params.organizationId
   * @param {string} params.email
   * @returns {Promise<Object>}
   */
  async approveRequest({ requestId, type, organizationId, email }) {
    if (!requestId) throw new Error("Request ID is required.");
    const tableName = type === MANAGER_ROLE ? "request_manager" : "request_member";
    const rpcName = type === MANAGER_ROLE ? "approve_manager_request" : "approve_member_request";

    // 1. Try secure stored RPC
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc(rpcName, {
        req_id: requestId,
      });

      if (!rpcError && rpcData?.success) {
        return rpcData;
      }
    } catch (_) {
      // Fallback below
    }

    // 2. Client-side fallback update
    const { error: updateError } = await supabase
      .from(tableName)
      .update({ status: "approved", updated_at: new Date().toISOString() })
      .eq("id", requestId);

    if (updateError) {
      console.error(`approveRequest fallback ${tableName} error:`, updateError);
      throw updateError;
    }

    // 3. Check if user already exists in profiles
    if (email && organizationId) {
      const normalizedEmail = email.trim().toLowerCase();
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", normalizedEmail)
        .maybeSingle();

      if (profile?.id) {
        // Fetch creator/inviter from the request record
        const { data: reqRecord } = await supabase
          .from(tableName)
          .select("requested_by, invited_by")
          .eq("id", requestId)
          .maybeSingle();

        const inviterId = reqRecord?.requested_by || reqRecord?.invited_by || null;

        // Upsert into organization_members with inviter/creator tracking
        await supabase
          .from("organization_members")
          .upsert(
            {
              organization_id: organizationId,
              user_id: profile.id,
              role: type === MANAGER_ROLE ? MANAGER_ROLE : MEMBER_ROLE,
              status: "active",
              created_by: inviterId,
              invited_by: inviterId,
              joined_at: new Date().toISOString(),
            },
            { onConflict: "organization_id,user_id" }
          );
      }
    }

    return { success: true, status: "approved", request_id: requestId };
  },

  /**
   * Reject a request (member or manager).
   * @param {Object} params
   * @param {string} params.requestId
   * @param {'member'|'manager'} params.type
   * @returns {Promise<Object>}
   */
  async rejectRequest({ requestId, type }) {
    if (!requestId) throw new Error("Request ID is required.");
    const tableName = type === MANAGER_ROLE ? "request_manager" : "request_member";
    const rpcName = type === MANAGER_ROLE ? "reject_manager_request" : "reject_member_request";

    // 1. Try RPC
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc(rpcName, {
        req_id: requestId,
      });

      if (!rpcError && rpcData?.success) {
        return rpcData;
      }
    } catch (_) {}

    // 2. Fallback direct update
    const { error: updateError } = await supabase
      .from(tableName)
      .update({ status: "rejected", updated_at: new Date().toISOString() })
      .eq("id", requestId);

    if (updateError) {
      console.error(`rejectRequest fallback ${tableName} error:`, updateError);
      throw updateError;
    }

    return { success: true, status: "rejected", request_id: requestId };
  },

  /**
   * Delete a request record.
   * @param {Object} params
   * @param {string} params.requestId
   * @param {'member'|'manager'} params.type
   * @returns {Promise<boolean>}
   */
  async deleteRequest({ requestId, type }) {
    if (!requestId) return false;
    const tableName = type === MANAGER_ROLE ? "request_manager" : "request_member";

    const { error } = await supabase
      .from(tableName)
      .delete()
      .eq("id", requestId);

    if (error) {
      console.error("deleteRequest error:", error);
      throw error;
    }

    return true;
  },

  // ============================================================
  // USER INVITATION LOOKUPS & SYNC ON LOGIN / SIGNUP
  // ============================================================

  /**
   * Get all pending or approved invitations directed to a user's email.
   * @param {string} userEmail
   * @returns {Promise<Array>}
   */
  async getUserPendingInvitations(userEmail) {
    if (!userEmail) return [];
    const normalizedEmail = userEmail.trim().toLowerCase();

    try {
      const [membersRes, managersRes] = await Promise.all([
        supabase
          .from("request_member")
          .select("*, organizations(id, name, slug, logo_url)")
          .eq("email", normalizedEmail),
        supabase
          .from("request_manager")
          .select("*, organizations(id, name, slug, logo_url)")
          .eq("email", normalizedEmail),
      ]);

      const memberInvites = (membersRes.data || []).map((m) => ({
        ...m,
        request_type: MEMBER_ROLE,
        status: m.status === "approved" ? "pending" : m.status,
      }));

      const managerInvites = (managersRes.data || []).map((m) => ({
        ...m,
        request_type: MANAGER_ROLE,
        status: m.status === "approved" ? "pending" : m.status,
      }));

      return [...memberInvites, ...managerInvites];
    } catch (err) {
      console.error("getUserPendingInvitations error:", err);
      return [];
    }
  },

  /**
   * Sync user with any approved requests matching their email.
   * Called during login and signup to assign memberships automatically
   * once an approved request exists.
   * @param {string} userEmail
   * @param {string} userId
   * @returns {Promise<number>} Number of newly assigned memberships
   */
  async syncUserWithPendingRequests(userEmail, userId) {
    if (!userEmail || !userId) return 0;
    const normalizedEmail = userEmail.trim().toLowerCase();
    let assignedCount = 0;

    // 1. Try RPC claim_approved_requests
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc(
        "claim_approved_requests",
        {
          target_user_id: userId,
          target_email: normalizedEmail,
        }
      );
      if (!rpcError && rpcData?.claimed_memberships !== undefined) {
        return rpcData.claimed_memberships;
      }
    } catch (_) {}

    // 2. Client-side fallback: check approved requests in request_member
    try {
      const { data: approvedMembers } = await supabase
        .from("request_member")
        .select("organization_id")
        .eq("email", normalizedEmail)
        .eq("status", "approved");

      if (approvedMembers && approvedMembers.length > 0) {
        for (const item of approvedMembers) {
          const { error: insErr } = await supabase
            .from("organization_members")
            .upsert(
              {
                organization_id: item.organization_id,
                user_id: userId,
                role: MEMBER_ROLE,
                status: "active",
                joined_at: new Date().toISOString(),
              },
              { onConflict: "organization_id,user_id" }
            );
          if (!insErr) assignedCount++;
        }
      }

      // Check approved requests in request_manager
      const { data: approvedManagers } = await supabase
        .from("request_manager")
        .select("organization_id")
        .eq("email", normalizedEmail)
        .eq("status", "approved");

      if (approvedManagers && approvedManagers.length > 0) {
        for (const item of approvedManagers) {
          const { error: insErr } = await supabase
            .from("organization_members")
            .upsert(
              {
                organization_id: item.organization_id,
                user_id: userId,
                role: MANAGER_ROLE,
                status: "active",
                joined_at: new Date().toISOString(),
              },
              { onConflict: "organization_id,user_id" }
            );
          if (!insErr) assignedCount++;
        }
      }
    } catch (err) {
      console.error("syncUserWithPendingRequests fallback error:", err);
    }

    return assignedCount;
  },

  // ============================================================
  // INVITATION TOKEN VERIFICATION & ACCEPTANCE
  // ============================================================

  /**
   * Validate an invitation token and role against request_member or request_manager.
   * Ensures the invitation is pending, not expired, and role matches.
   * @param {Object} params
   * @param {string} params.token
   * @param {'member'|'manager'} params.role
   * @returns {Promise<Object>}
   */
  async verifyInvitationToken({ token, role }) {
    if (!token || !role) {
      return { valid: false, error: "Invitation token and role are required." };
    }

    const normalizedRole = role.toLowerCase().trim();
    if (normalizedRole !== MEMBER_ROLE && normalizedRole !== MANAGER_ROLE) {
      return { valid: false, error: "Invalid role specified in invitation link." };
    }

    const tableName = normalizedRole === MANAGER_ROLE ? "request_manager" : "request_member";
    const tokenHash = await hashToken(token);

    // 1. Query matching request by hash
    let { data, error } = await supabase
      .from(tableName)
      .select("*, organizations(id, name, slug, logo_url, description)")
      .eq("invitation_token_hash", tokenHash)
      .maybeSingle();

    // Fallback: check by ID if token happens to be UUID or column is missing
    if (!data && (error?.message?.includes("column") || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token))) {
      const { data: idData } = await supabase
        .from(tableName)
        .select("*, organizations(id, name, slug, logo_url, description)")
        .eq("id", token)
        .maybeSingle();
      if (idData) {
        data = idData;
        error = null;
      }
    }

    if (error || !data) {
      return {
        valid: false,
        error: "This invitation link is invalid, expired, or does not exist.",
      };
    }

    // 2. Check if already accepted
    if (data.status === "accepted") {
      return {
        valid: false,
        error: "This invitation has already been accepted. Please sign in to your account.",
        alreadyAccepted: true,
      };
    }

    // 2b. Check if rejected
    if (data.status === "rejected") {
      return {
        valid: false,
        error: "This invitation has been rejected by an administrator.",
      };
    }

    // 3. Active status check: both 'pending' and 'approved' are valid for signup
    if (data.status !== "pending" && data.status !== "approved") {
      return {
        valid: false,
        error: `This invitation is no longer active (status: ${data.status}).`,
      };
    }

    // 4. Check expiration
    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      return {
        valid: false,
        error: "This invitation link has expired. Please request a new invitation from your administrator.",
        expired: true,
      };
    }

    return {
      valid: true,
      role: normalizedRole,
      invitation: data,
      organization: data.organizations || { id: data.organization_id },
      email: data.email,
      fullName: data.full_name || "",
    };
  },

  /**
   * Complete invitation acceptance:
   * 1. Atomically marks request as accepted (via RPC if available).
   * 2. Sets accepted_by to user ID.
   * 3. Upserts profile with validated role and employee details.
   * 4. Adds user to organization_members.
   * @param {Object} params
   * @param {string} params.token
   * @param {'member'|'manager'} params.role
   * @param {string} params.userId
   * @param {string} params.userEmail
   * @param {Object} [params.employeeDetails]
   * @returns {Promise<Object>}
   */
  async acceptInvitation({
    token,
    role,
    userId,
    userEmail,
    employeeDetails = {},
  }) {
    if (!token || !role || !userId) {
      throw new Error("Missing required parameters to accept invitation.");
    }

    const normalizedRole = role.toLowerCase().trim();
    if (normalizedRole !== MEMBER_ROLE && normalizedRole !== MANAGER_ROLE) {
      throw new Error("Invalid role for invitation acceptance.");
    }

    const tokenHash = await hashToken(token);

    // 1. Try secure stored RPC first
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc(
        "accept_invitation",
        {
          p_token_hash: tokenHash,
          p_role: normalizedRole,
          p_user_id: userId,
          p_user_email: userEmail,
          p_employee_details: employeeDetails,
        }
      );

      if (!rpcError && rpcData?.success) {
        return rpcData;
      }
    } catch (_) {
      // Proceed to fallback
    }

    // 2. Resilient Client-side fallback
    const tableName = normalizedRole === MANAGER_ROLE ? "request_manager" : "request_member";

    let req = null;
    if (tokenHash) {
      const { data } = await supabase
        .from(tableName)
        .select("*")
        .eq("invitation_token_hash", tokenHash)
        .maybeSingle();
      req = data;
    }

    if (!req && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) {
      const { data } = await supabase
        .from(tableName)
        .select("*")
        .eq("id", token)
        .maybeSingle();
      req = data;
    }

    if (!req && userEmail) {
      const { data } = await supabase
        .from(tableName)
        .select("*")
        .eq("email", userEmail.toLowerCase().trim())
        .in("status", ["pending", "approved"])
        .maybeSingle();
      req = data;
    }

    const orgId = req?.organization_id || employeeDetails?.organization_id;

    // 2a. Update profile with role and employee details
    const profilePayload = {
      id: userId,
      email: userEmail,
      full_name: employeeDetails?.full_name || req?.full_name || "",
      role: normalizedRole,
      organization_id: orgId || null,
      department: employeeDetails?.department || null,
      employee_type: employeeDetails?.employee_type || null,
      job_title: employeeDetails?.job_title || null,
      company_name: employeeDetails?.company_name || null,
      phone: employeeDetails?.phone || null,
      profile_photo: employeeDetails?.profile_photo || null,
      updated_at: new Date().toISOString(),
    };

    const { error: profileErr } = await supabase
      .from("profiles")
      .upsert(profilePayload, { onConflict: "id" });

    if (profileErr) {
      // If employee columns not yet in DB, retry with essential columns
      await supabase.from("profiles").upsert(
        {
          id: userId,
          email: userEmail,
          full_name: employeeDetails?.full_name || req?.full_name || "",
          phone: employeeDetails?.phone || null,
          role: normalizedRole,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      );
    }

    // 2b. Add to organization_members with inviter/creator tracking
    if (orgId) {
      await supabase.from("organization_members").upsert(
        {
          organization_id: orgId,
          user_id: userId,
          role: normalizedRole,
          status: "active",
          created_by: req?.requested_by || req?.invited_by || null,
          invited_by: req?.invited_by || req?.requested_by || null,
          joined_at: new Date().toISOString(),
        },
        { onConflict: "organization_id,user_id" }
      );
    }

    // 2c. Mark request record as accepted
    if (req?.id) {
      await supabase
        .from(tableName)
        .update({
          status: "accepted",
          accepted_by: userId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", req.id);
    }

    return {
      success: true,
      organization_id: orgId,
      role: normalizedRole,
      request_id: req?.id,
    };
  },
};

export default organizationService;
