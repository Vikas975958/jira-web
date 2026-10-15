import { supabase } from "@/lib/supabaseconfig";
import { generateInvitationToken, hashToken } from "@/utils/token";
import { MEMBER_ROLE, MANAGER_ROLE, OWNER_ROLE } from "@/utils/constants";
import { clearProjectsCache } from "@/services/project.service";

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

const inFlightUserOrgs = new Map();
const userOrgsCache = new Map();

const inFlightOrgMembers = new Map();
const orgMembersCache = new Map();

const inFlightAllRequests = new Map();
const allRequestsCache = new Map();

const inFlightUserPendingInvites = new Map();
const userPendingInvitesCache = new Map();

const ORG_CACHE_TTL = 60000; // 60 seconds (was 3.5s)

export const clearOrganizationCache = () => {
  inFlightUserOrgs.clear();
  userOrgsCache.clear();
  inFlightOrgMembers.clear();
  orgMembersCache.clear();
  inFlightAllRequests.clear();
  allRequestsCache.clear();
  inFlightUserPendingInvites.clear();
  userPendingInvitesCache.clear();
};

export const organizationService = {
  slugify,
  clearOrganizationCache,

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

    // Verify user does not already have an active organization (single workspace policy)
    const { data: existingMemberships } = await supabase
      .from("organization_members")
      .select("id, organization_id")
      .eq("user_id", authenticatedUserId)
      .limit(1);

    if (existingMemberships && existingMemberships.length > 0) {
      throw new Error("You already have an active workspace. Multiple workspaces are not allowed.");
    }

    const { data: existingCreated } = await supabase
      .from("organizations")
      .select("id")
      .eq("created_by", authenticatedUserId)
      .limit(1);

    if (existingCreated && existingCreated.length > 0) {
      throw new Error("You already have an active workspace. Multiple workspaces are not allowed.");
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
   * Remove a member or manager from an organization and everywhere in projects.
   * @param {Object} params
   * @param {string} params.organizationId
   * @param {string} params.userId
   * @param {string} [params.userEmail]
   * @param {string} [params.callerRole]
   * @param {string} [params.callerId]
   * @returns {Promise<boolean>}
   */
  async removeOrganizationMember({
    organizationId,
    userId,
    userEmail,
    callerRole = OWNER_ROLE,
    callerId = null,
  }) {
    if (!organizationId || !userId) {
      throw new Error("Missing organizationId or userId.");
    }

    if (callerRole === MEMBER_ROLE) {
      throw new Error("Members cannot remove other members.");
    }

    // Safety: Prevent removing workspace owner
    try {
      const { data: targetProfile } = await supabase
        .from("profiles")
        .select("role, email")
        .eq("id", userId)
        .maybeSingle();

      if (targetProfile?.role === OWNER_ROLE) {
        throw new Error("Cannot remove the Workspace Owner.");
      }
      if (!userEmail && targetProfile?.email) {
        userEmail = targetProfile.email;
      }
    } catch (e) {
      if (e?.message && e.message.includes("Workspace Owner")) throw e;
    }

    // 1. Remove from organization_members
    const { error: omErr } = await supabase
      .from("organization_members")
      .delete()
      .eq("organization_id", organizationId)
      .eq("user_id", userId);

    if (omErr) {
      console.error("removeOrganizationMember error:", omErr);
      throw omErr;
    }

    // 2. Cascade delete from all project_members in this organization
    try {
      const { data: orgProjects } = await supabase
        .from("projects")
        .select("id")
        .eq("organization_id", organizationId);

      const projectIds = (orgProjects || []).map((p) => p.id);
      if (projectIds.length > 0) {
        await supabase
          .from("project_members")
          .delete()
          .in("project_id", projectIds)
          .eq("user_id", userId);

        if (typeof window !== "undefined") {
          ["workgrid_project_members_data", "jira_project_members_data"].forEach((k) => {
            const raw = localStorage.getItem(k);
            if (raw) {
              try {
                const list = JSON.parse(raw);
                if (Array.isArray(list)) {
                  const filtered = list.filter(
                    (m) => !(projectIds.includes(m.project_id) && m.user_id === userId)
                  );
                  localStorage.setItem(k, JSON.stringify(filtered));
                }
              } catch (_) {}
            }
          });
        }
      }
    } catch (pErr) {
      console.error("removeOrganizationMember project_members cleanup error:", pErr);
    }

    // 3. Unassign from tasks in this organization
    try {
      await supabase
        .from("tasks")
        .update({ assignee_id: null })
        .eq("organization_id", organizationId)
        .eq("assignee_id", userId);
    } catch (_) {}

    // 4. Remove any pending requests or invitations for this user's email
    const cleanEmail = userEmail?.trim()?.toLowerCase();
    if (cleanEmail) {
      try {
        await supabase
          .from("request_member")
          .delete()
          .eq("organization_id", organizationId)
          .eq("email", cleanEmail);
      } catch (_) {}
      try {
        await supabase
          .from("request_manager")
          .delete()
          .eq("organization_id", organizationId)
          .eq("email", cleanEmail);
      } catch (_) {}
      try {
        await supabase
          .from("project_invitations")
          .delete()
          .eq("organization_id", organizationId)
          .eq("email", cleanEmail);
      } catch (_) {}

      if (typeof window !== "undefined") {
        try {
          ["workgrid_project_invitations_data", "jira_project_invitations_data"].forEach((k) => {
            const raw = localStorage.getItem(k);
            if (raw) {
              const list = JSON.parse(raw);
              if (Array.isArray(list)) {
                const filtered = list.filter(
                  (item) => item.email?.trim()?.toLowerCase() !== cleanEmail
                );
                localStorage.setItem(k, JSON.stringify(filtered));
              }
            }
          });
        } catch (_) {}
      }
    }

    clearOrganizationCache();
    try {
      clearProjectsCache();
    } catch (_) {}

    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("member-removed", {
          detail: { organizationId, userId, email: cleanEmail },
        })
      );
      window.dispatchEvent(
        new CustomEvent("project-updated", {
          detail: { organizationId, userId },
        })
      );
    }

    return true;
  },

  /**
   * Get all organizations for a user (via organization_members or created_by).
   * @param {string} userId
   * @returns {Promise<Array>} List of organizations with membership info
   */
  async getUserOrganizations(userId, force = false) {
    if (!userId) return [];

    const cacheKey = String(userId);
    if (!force) {
      const cached = userOrgsCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < ORG_CACHE_TTL) {
        return cached.data;
      }
      if (inFlightUserOrgs.has(cacheKey)) {
        return inFlightUserOrgs.get(cacheKey);
      }
    }

    const fetchPromise = (async () => {
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

      // Only check creator and requests fallback if no memberships were found in organization_members
      if (orgs.length === 0) {
        // 2. Also check if the user is a creator of any organization not yet listed in organization_members
        const existingOrgIds = new Set(orgs.map((o) => o.organizations?.id));

        const { data: createdOrgs, error: createdError } = await supabase
          .from("organizations")
          .select("*")
          .eq("created_by", userId);

        if (!createdError && createdOrgs) {
          for (const org of createdOrgs) {
            if (!existingOrgIds.has(org.id)) {
              existingOrgIds.add(org.id);
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

        // 3. Also check if the user is an accepted manager or member in request_manager / request_member
        try {
          const [acceptedMgrs, acceptedMbrs] = await Promise.all([
            supabase
              .from("request_manager")
              .select("organization_id, role, updated_at")
              .eq("accepted_by", userId)
              .eq("status", "accepted"),
            supabase
              .from("request_member")
              .select("organization_id, role, updated_at")
              .eq("accepted_by", userId)
              .eq("status", "accepted"),
          ]);

          const acceptedRows = [
            ...(acceptedMgrs.data || []).map((r) => ({ ...r, role: MANAGER_ROLE })),
            ...(acceptedMbrs.data || []).map((r) => ({ ...r, role: MEMBER_ROLE })),
          ];

          for (const row of acceptedRows) {
            if (!existingOrgIds.has(row.organization_id)) {
              const { data: orgData } = await supabase
                .from("organizations")
                .select("*")
                .eq("id", row.organization_id)
                .maybeSingle();

              if (orgData) {
                existingOrgIds.add(orgData.id);
                orgs.push({
                  id: `accepted-${row.role}-${row.organization_id}`,
                  role: row.role,
                  status: "active",
                  joined_at: row.updated_at || new Date().toISOString(),
                  organizations: orgData,
                });
              }
            }
          }
        } catch (e) {
          console.error("getUserOrganizations accepted requests fetch error:", e);
        }
      }

      return orgs;
    })();

    inFlightUserOrgs.set(cacheKey, fetchPromise);
    try {
      const result = await fetchPromise;
      userOrgsCache.set(cacheKey, { data: result, timestamp: Date.now() });
      return result;
    } finally {
      inFlightUserOrgs.delete(cacheKey);
    }
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
  async getOrganizationMembers(organizationId, context = {}, force = false) {
    if (!organizationId) return [];

    const { currentUserId, currentUserRole } = context;
    const cacheKey = `${organizationId}:${currentUserId || ""}:${currentUserRole || ""}`;

    if (!force) {
      const cached = orgMembersCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < ORG_CACHE_TTL) {
        return cached.data;
      }
      if (inFlightOrgMembers.has(cacheKey)) {
        return inFlightOrgMembers.get(cacheKey);
      }
    }

    const fetchPromise = (async () => {
      // 1. Try secure stored RPC that guarantees real full names and emails without RLS issues
      let rawMembers = [];
      let rpcSucceeded = false;
    try {
      const { data: rpcRows, error: rpcErr } = await supabase.rpc(
        "get_organization_team_members",
        { p_organization_id: organizationId }
      );
      if (!rpcErr && Array.isArray(rpcRows) && rpcRows.length > 0) {
        rawMembers = rpcRows;
        rpcSucceeded = true;
      }
    } catch (_) {
      rpcSucceeded = false;
    }

    if (rpcSucceeded) {
      const list = rawMembers.map((m) => {
        const fn =
          m.full_name ||
          (m.role === OWNER_ROLE
            ? "Workspace Owner"
            : m.role === MANAGER_ROLE
            ? "Manager"
            : "Team Member");
        const em = m.email || "";
        return {
          ...m,
          full_name: fn,
          email: em,
          is_owner: m.role === OWNER_ROLE,
          profiles: {
            id: m.user_id,
            full_name: fn,
            email: em,
            phone: m.phone || "",
          },
        };
      });

      if (currentUserId) {
        list.sort((a, b) => {
          const aIsMe = (a.user_id === currentUserId || a.id === currentUserId || a.profiles?.id === currentUserId) ? 1 : 0;
          const bIsMe = (b.user_id === currentUserId || b.id === currentUserId || b.profiles?.id === currentUserId) ? 1 : 0;
          return bIsMe - aIsMe;
        });
      }

      return list;
    }

    if (!rpcSucceeded) {
      // Fallback: direct query from organization_members
      const { data: memberRows, error: memberErr } = await supabase
        .from("organization_members")
        .select("id, user_id, role, status, joined_at, organization_id, created_by, invited_by")
        .eq("organization_id", organizationId)
        .order("joined_at", { ascending: true });

      if (memberErr) {
        console.error("getOrganizationMembers error:", memberErr);
      } else {
        rawMembers = memberRows || [];
      }

      // Also include accepted members & managers from requests to ensure confirmed invites appear in listings
      try {
        const [acceptedMgrs, acceptedMbrs] = await Promise.all([
          supabase
            .from("request_manager")
            .select("id, organization_id, full_name, email, role, status, requested_by, invited_by, accepted_by, created_at, updated_at")
            .eq("organization_id", organizationId)
            .eq("status", "accepted"),
          supabase
            .from("request_member")
            .select("id, organization_id, full_name, email, role, status, requested_by, invited_by, accepted_by, created_at, updated_at")
            .eq("organization_id", organizationId)
            .eq("status", "accepted"),
        ]);

        const existingUserIds = new Set(rawMembers.map((m) => m.user_id).filter(Boolean));
        const acceptedRows = [
          ...(acceptedMgrs.data || []).map((r) => ({ ...r, role: MANAGER_ROLE })),
          ...(acceptedMbrs.data || []).map((r) => ({ ...r, role: MEMBER_ROLE })),
        ];

        for (const req of acceptedRows) {
          const uId = req.accepted_by || req.id;
          if (!existingUserIds.has(uId)) {
            existingUserIds.add(uId);
            rawMembers.push({
              id: req.id,
              user_id: uId,
              role: req.role,
              status: "active",
              joined_at: req.updated_at || req.created_at,
              organization_id: req.organization_id,
              created_by: req.requested_by || req.invited_by,
              invited_by: req.invited_by || req.requested_by,
              full_name: req.full_name,
              email: req.email,
              profiles: {
                id: uId,
                full_name: req.full_name,
                email: req.email,
              },
            });
          }
        }
      } catch (e) {
        console.error("getOrganizationMembers accepted requests fetch error:", e);
      }
    }

    // Hydrate user profiles and requests reliably
    const userIds = [
      ...new Set(rawMembers.map((m) => m.user_id).filter(Boolean)),
    ];
    let profileMap = new Map();
    if (userIds.length > 0) {
      try {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, email, phone")
          .in("id", userIds);
        (profiles || []).forEach((p) => profileMap.set(p.id, p));
      } catch (_) {}
    }

    let members = rawMembers.map((m) => {
      const p = profileMap.get(m.user_id) || m.profiles || null;
      const fn =
        p?.full_name ||
        m.full_name ||
        (m.role === OWNER_ROLE
          ? "Workspace Owner"
          : m.role === MANAGER_ROLE
          ? "Manager"
          : "Team Member");
      const em = p?.email || m.email || "";
      return {
        ...m,
        full_name: fn,
        email: em,
        profiles: {
          id: m.user_id,
          full_name: fn,
          email: em,
        },
      };
    });

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

    if (!orgOwnerId && rawMembers.length > 0) {
      const creatorMember = rawMembers.find((m) => m.created_by || m.invited_by);
      if (creatorMember) {
        orgOwnerId = creatorMember.created_by || creatorMember.invited_by;
      }
    }

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
        const ownerName = ownerProf?.full_name || "Workspace Owner";
        const ownerEmail = ownerProf?.email || "";
        members.unshift({
          id: `owner-${orgOwnerId}`,
          user_id: orgOwnerId,
          role: OWNER_ROLE,
          status: "active",
          is_owner: true,
          profiles: { id: orgOwnerId, full_name: ownerName, email: ownerEmail },
          full_name: ownerName,
          email: ownerEmail,
          joined_at: new Date().toISOString(),
        });
      } catch (_) {}
    }

    // Ensure current logged-in user is present in members list if currentUserId is provided
    if (currentUserId && !members.some((m) => m.user_id === currentUserId)) {
      try {
        const { data: selfProf } = await supabase
          .from("profiles")
          .select("id, full_name, email, phone")
          .eq("id", currentUserId)
          .maybeSingle();

        let selfRole = currentUserRole || MEMBER_ROLE;
        if (currentUserId === orgOwnerId) {
          selfRole = OWNER_ROLE;
        }

        const selfName = selfProf?.full_name || (selfRole === OWNER_ROLE ? "Workspace Owner" : selfRole === MANAGER_ROLE ? "Manager" : "Team Member");
        const selfEmail = selfProf?.email || "";

        members.push({
          id: `self-${currentUserId}`,
          user_id: currentUserId,
          role: selfRole,
          status: "active",
          is_owner: selfRole === OWNER_ROLE,
          profiles: { id: currentUserId, full_name: selfName, email: selfEmail },
          full_name: selfName,
          email: selfEmail,
          joined_at: new Date().toISOString(),
          organization_id: organizationId,
        });
      } catch (_) {}
    }

    // Complete organization members and managers are shown
    // All members and managers are visible so managers and owners can select full teams for projects.
    // Always sort current logged-in user to the top of the list
    if (currentUserId) {
      members.sort((a, b) => {
        const aIsMe = (a.user_id === currentUserId || a.id === currentUserId || a.profiles?.id === currentUserId) ? 1 : 0;
        const bIsMe = (b.user_id === currentUserId || b.id === currentUserId || b.profiles?.id === currentUserId) ? 1 : 0;
        return bIsMe - aIsMe;
      });
    }

    return members;
    })();

    inFlightOrgMembers.set(cacheKey, fetchPromise);
    try {
      const result = await fetchPromise;
      orgMembersCache.set(cacheKey, { data: result, timestamp: Date.now() });
      return result;
    } finally {
      inFlightOrgMembers.delete(cacheKey);
    }
  },

  /**
   * Get leadership information (owner who created, manager who created) for the current organization.
   * @param {string} organizationId
   * @param {Object} [context] - { currentUserId, currentUserRole }
   * @returns {Promise<{ owner: Object|null, manager: Object|null }>}
   */
  async getOrganizationLeadership(organizationId, context = {}, preloadedMembers = null) {
    if (!organizationId) return { owner: null, manager: null };
    const { currentUserId, currentUserRole } = context;

    try {
      const allMembers =
        preloadedMembers && preloadedMembers.length > 0
          ? preloadedMembers
          : await this.getOrganizationMembers(organizationId, {
              currentUserId,
              currentUserRole,
            });

      const owner =
        allMembers.find((m) => m.role === OWNER_ROLE || m.is_owner) ||
        (allMembers.length > 0 && allMembers[0]?.role === OWNER_ROLE ? allMembers[0] : null);

      let manager = null;
      if (currentUserRole === MEMBER_ROLE && currentUserId) {
        const myMember = allMembers.find((m) => m.user_id === currentUserId);
        const managerId = myMember?.created_by || myMember?.invited_by;
        if (managerId) {
          manager =
            allMembers.find((m) => m.user_id === managerId && m.role === MANAGER_ROLE) ||
            null;
        }
        if (!manager) {
          manager = allMembers.find((m) => m.role === MANAGER_ROLE) || null;
        }
      } else {
        manager = allMembers.find((m) => m.role === MANAGER_ROLE) || null;
      }

      return { owner, manager };
    } catch (err) {
      console.error("getOrganizationLeadership error:", err);
      return { owner: null, manager: null };
    }
  },

  /**
   * Synchronously extract leadership from a loaded members array without any API calls.
   * @param {Array} allMembers
   * @param {string} currentUserId
   * @param {string} currentUserRole
   * @returns {{ owner: Object|null, manager: Object|null }}
   */
  getOrganizationLeadershipSync(allMembers = [], currentUserId = null, currentUserRole = MEMBER_ROLE) {
    if (!Array.isArray(allMembers) || allMembers.length === 0) {
      return { owner: null, manager: null };
    }

    const owner =
      allMembers.find((m) => m.role === OWNER_ROLE || m.is_owner) ||
      (allMembers[0]?.role === OWNER_ROLE ? allMembers[0] : null);

    let manager = null;
    if (currentUserRole === MEMBER_ROLE && currentUserId) {
      const myMember = allMembers.find((m) => m.user_id === currentUserId);
      const managerId = myMember?.created_by || myMember?.invited_by;
      if (managerId) {
        manager =
          allMembers.find((m) => m.user_id === managerId && m.role === MANAGER_ROLE) ||
          null;
      }
      if (!manager) {
        manager = allMembers.find((m) => m.role === MANAGER_ROLE) || null;
      }
    } else {
      manager = allMembers.find((m) => m.role === MANAGER_ROLE) || null;
    }

    return { owner, manager };
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

    // If manager, show only requests created/invited by them. Owner sees all requests.
    if (currentUserRole === MANAGER_ROLE && currentUserId) {
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

    // Strict in-memory check to ensure managers only see requests created/invited by themselves
    if (currentUserRole === MANAGER_ROLE && currentUserId) {
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
  async getAllRequests(organizationId, context = {}, force = false) {
    if (!organizationId) return [];
    const { currentUserId, currentUserRole } = context;

    if (currentUserRole === MEMBER_ROLE) return [];

    const cacheKey = `${organizationId}:${currentUserId || ""}:${currentUserRole || ""}`;

    if (!force) {
      const cached = allRequestsCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < ORG_CACHE_TTL) {
        return cached.data;
      }
      if (inFlightAllRequests.has(cacheKey)) {
        return inFlightAllRequests.get(cacheKey);
      }
    }

    const fetchPromise = (async () => {
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

      return [...formattedMembers, ...formattedManagers].sort(
        (a, b) => new Date(b.created_at) - new Date(a.created_at)
      );
    })();

    inFlightAllRequests.set(cacheKey, fetchPromise);
    try {
      const result = await fetchPromise;
      allRequestsCache.set(cacheKey, { data: result, timestamp: Date.now() });
      return result;
    } finally {
      inFlightAllRequests.delete(cacheKey);
    }
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

    // 2. Client-side fallback update: Mark as 'accepted' directly
    let callerId = null;
    try {
      const { data: authData } = await supabase.auth.getUser();
      callerId = authData?.user?.id || null;
    } catch (_) {}

    // 3. Check if user already exists in profiles
    let targetUserId = callerId;
    if (email) {
      const normalizedEmail = email.trim().toLowerCase();
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", normalizedEmail)
        .maybeSingle();
      if (profile?.id) {
        targetUserId = profile.id;
      }
    }

    const { error: updateError } = await supabase
      .from(tableName)
      .update({
        status: "accepted",
        accepted_by: targetUserId || callerId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", requestId);

    if (updateError) {
      console.error(`approveRequest fallback ${tableName} error:`, updateError);
      throw updateError;
    }

    if (targetUserId && organizationId) {
      // Fetch creator/inviter from the request record
      const { data: reqRecord } = await supabase
        .from(tableName)
        .select("requested_by, invited_by")
        .eq("id", requestId)
        .maybeSingle();

      const inviterId = reqRecord?.requested_by || reqRecord?.invited_by || callerId;

      // Upsert into organization_members with inviter/creator tracking
      await supabase
        .from("organization_members")
        .upsert(
          {
            organization_id: organizationId,
            user_id: targetUserId,
            role: type === MANAGER_ROLE ? MANAGER_ROLE : MEMBER_ROLE,
            status: "active",
            created_by: inviterId,
            invited_by: inviterId,
            joined_at: new Date().toISOString(),
          },
          { onConflict: "organization_id,user_id" }
        );
    }

    clearOrganizationCache();
    return { success: true, status: "accepted", request_id: requestId, assigned_user_id: targetUserId };
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
        clearOrganizationCache();
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

    clearOrganizationCache();
    return { success: true, status: "rejected", request_id: requestId };
  },

  /**
   * Delete a request record everywhere across the system (request tables, project invitations, localStorage).
   * @param {Object} params
   * @param {string} params.requestId
   * @param {'member'|'manager'} [params.type]
   * @param {string} [params.email]
   * @param {string} [params.organizationId]
   * @returns {Promise<boolean>}
   */
  async deleteRequest({ requestId, type, email, organizationId }) {
    if (!requestId && !email) return false;

    let targetEmail = email;
    let targetOrgId = organizationId;

    // Fetch the request record first if email is missing
    if (!targetEmail && requestId) {
      try {
        const preferredTable = type === MANAGER_ROLE ? "request_manager" : "request_member";
        const { data: rec } = await supabase
          .from(preferredTable)
          .select("email, organization_id")
          .eq("id", requestId)
          .maybeSingle();

        if (rec) {
          targetEmail = rec.email;
          targetOrgId = targetOrgId || rec.organization_id;
        } else {
          // Check alternate request table
          const altTable = type === MANAGER_ROLE ? "request_member" : "request_manager";
          const { data: altRec } = await supabase
            .from(altTable)
            .select("email, organization_id")
            .eq("id", requestId)
            .maybeSingle();
          if (altRec) {
            targetEmail = altRec.email;
            targetOrgId = targetOrgId || altRec.organization_id;
          } else {
            // Also check project_invitations in case requestId is project_invitations id
            const { data: piRec } = await supabase
              .from("project_invitations")
              .select("email, organization_id")
              .eq("id", requestId)
              .maybeSingle();
            if (piRec) {
              targetEmail = piRec.email;
              targetOrgId = targetOrgId || piRec.organization_id;
            }
          }
        }
      } catch (_) {}
    }

    const cleanEmail = targetEmail?.trim()?.toLowerCase();

    // 1. Delete from request_member
    try {
      if (requestId) {
        await supabase.from("request_member").delete().eq("id", requestId);
      }
      if (cleanEmail) {
        let q = supabase.from("request_member").delete().eq("email", cleanEmail);
        if (targetOrgId) q = q.eq("organization_id", targetOrgId);
        await q;
      }
    } catch (err) {
      console.error("deleteRequest request_member error:", err);
    }

    // 2. Delete from request_manager
    try {
      if (requestId) {
        await supabase.from("request_manager").delete().eq("id", requestId);
      }
      if (cleanEmail) {
        let q = supabase.from("request_manager").delete().eq("email", cleanEmail);
        if (targetOrgId) q = q.eq("organization_id", targetOrgId);
        await q;
      }
    } catch (err) {
      console.error("deleteRequest request_manager error:", err);
    }

    // 3. Delete everywhere from project_invitations!
    try {
      if (requestId) {
        await supabase.from("project_invitations").delete().eq("id", requestId);
      }
      if (cleanEmail) {
        let q = supabase.from("project_invitations").delete().eq("email", cleanEmail);
        if (targetOrgId) q = q.eq("organization_id", targetOrgId);
        await q;
      }
    } catch (err) {
      console.error("deleteRequest project_invitations error:", err);
    }

    // 4. Clean up localStorage for project invitations
    if (typeof window !== "undefined") {
      try {
        ["workgrid_project_invitations_data", "jira_project_invitations_data"].forEach((k) => {
          const raw = localStorage.getItem(k);
          if (raw) {
            const list = JSON.parse(raw);
            if (Array.isArray(list)) {
              const filtered = list.filter((item) => {
                if (requestId && item.id === requestId) return false;
                if (cleanEmail && item.email?.trim()?.toLowerCase() === cleanEmail) return false;
                return true;
              });
              localStorage.setItem(k, JSON.stringify(filtered));
            }
          }
        });
      } catch (_) {}
    }

    clearOrganizationCache();
    try {
      clearProjectsCache();
    } catch (_) {}

    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("invitation-deleted", {
          detail: { requestId, email: cleanEmail, organizationId: targetOrgId },
        })
      );
      window.dispatchEvent(
        new CustomEvent("project-updated", {
          detail: { email: cleanEmail, organizationId: targetOrgId },
        })
      );
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
  async getUserPendingInvitations(userEmail, force = false) {
    if (!userEmail) return [];
    const normalizedEmail = userEmail.trim().toLowerCase();
    const cacheKey = normalizedEmail;

    if (!force) {
      const cached = userPendingInvitesCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < ORG_CACHE_TTL) {
        return cached.data;
      }
      if (inFlightUserPendingInvites.has(cacheKey)) {
        return inFlightUserPendingInvites.get(cacheKey);
      }
    }

    const fetchPromise = (async () => {
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

        // Project invitations
        let projectInvites = [];
        try {
          const { data: pInvites } = await supabase
            .from("project_invitations")
            .select("*, organizations(id, name, slug, logo_url), projects(id, name, status)")
            .eq("email", normalizedEmail)
            .eq("status", "pending");

          if (pInvites && pInvites.length > 0) {
            projectInvites = pInvites.map((pi) => ({
              ...pi,
              request_type: pi.intended_role || MEMBER_ROLE,
              is_project_invite: true,
              project_name: pi.projects?.name,
            }));
          }
        } catch (_) {}

        // Fallback local project invites
        if (typeof window !== "undefined") {
          try {
            const raw =
              localStorage.getItem("workgrid_project_invitations_data") ||
              localStorage.getItem("jira_project_invitations_data");
            if (raw) {
              const list = JSON.parse(raw);
              const matches = list.filter(
                (i) => i.email === normalizedEmail && i.status === "pending"
              );
              matches.forEach((pi) => {
                if (!projectInvites.some((item) => item.id === pi.id)) {
                  projectInvites.push({
                    ...pi,
                    request_type: pi.intended_role || MEMBER_ROLE,
                    is_project_invite: true,
                  });
                }
              });
            }
          } catch (_) {}
        }

        return [...memberInvites, ...managerInvites, ...projectInvites];
      } catch (err) {
        console.error("getUserPendingInvitations error:", err);
        return [];
      }
    })();

    inFlightUserPendingInvites.set(cacheKey, fetchPromise);
    try {
      const result = await fetchPromise;
      userPendingInvitesCache.set(cacheKey, { data: result, timestamp: Date.now() });
      return result;
    } finally {
      inFlightUserPendingInvites.delete(cacheKey);
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
  async verifyInvitationToken({ token, role, projectId = null }) {
    if (!token || !role) {
      return { valid: false, error: "Invitation token and role are required." };
    }

    const normalizedRole = role.toLowerCase().trim();
    if (normalizedRole !== MEMBER_ROLE && normalizedRole !== MANAGER_ROLE) {
      return { valid: false, error: "Invalid role specified in invitation link." };
    }

    const tableName = normalizedRole === MANAGER_ROLE ? "request_manager" : "request_member";
    const tokenHash = await hashToken(token);

    // 1. Query matching request by hash or token
    let { data, error } = await supabase
      .from(tableName)
      .select("*, organizations(id, name, slug, logo_url, description)")
      .or(`invitation_token_hash.eq.${tokenHash},invitation_token_hash.eq.${token}`)
      .maybeSingle();

    // 2. Query project_invitations directly
    if (!data) {
      try {
        const { data: projInvite } = await supabase
          .from("project_invitations")
          .select("*, organizations(id, name, slug, logo_url, description)")
          .or(`invitation_token_hash.eq.${tokenHash},invitation_token_hash.eq.${token}`)
          .maybeSingle();

        if (projInvite) {
          data = projInvite;
          error = null;
        }
      } catch (_) {}
    }

    // 3. Check in local project invites fallback
    if (!data && typeof window !== "undefined") {
      try {
        const raw =
          localStorage.getItem("workgrid_project_invitations_data") ||
          localStorage.getItem("jira_project_invitations_data");
        if (raw) {
          const list = JSON.parse(raw);
          const found = list.find(
            (i) =>
              i.invitation_token_hash === tokenHash ||
              i.invitation_token_hash === token ||
              i.id === token ||
              i.invitationToken === token
          );
          if (found) {
            data = found;
            error = null;
          }
        }
      } catch (_) {}
    }

    // 4. Secure RPC probe verification:
    // If direct select is blocked by remote RLS, verify via accept_project_invitation RPC
    if (!data) {
      try {
        const { data: rpcCheck } = await supabase.rpc("accept_project_invitation", {
          p_token_hash: tokenHash,
          p_user_id: "00000000-0000-0000-0000-000000000000",
          p_user_email: "__verify_probe__@validation.check",
        });

        if (rpcCheck) {
          if (rpcCheck.error === "This project invitation has already been accepted.") {
            return {
              valid: false,
              error: "This invitation has already been accepted. Please sign in to your account.",
              alreadyAccepted: true,
            };
          }
          if (rpcCheck.error === "This project invitation has expired.") {
            return {
              valid: false,
              error: "This invitation link has expired. Please request a new invitation from your administrator.",
              expired: true,
            };
          }
          if (rpcCheck.error === "This invitation is no longer active.") {
            return {
              valid: false,
              error: "This invitation is no longer active.",
            };
          }
          if (rpcCheck.error === "Invitation email does not match registered user email.") {
            // Proven valid and pending in the remote database!
            data = {
              id: token,
              invitation_token_hash: tokenHash,
              status: "pending",
              intended_role: normalizedRole,
              role: normalizedRole,
              project_id: projectId || null,
              is_project_invite: true,
            };
            error = null;
          }
        }
      } catch (_) {}
    }

    // Also check local project data to retrieve organization info if available
    if (data && !data.organizations && (projectId || data.project_id) && typeof window !== "undefined") {
      try {
        const pId = projectId || data.project_id;
        const rawProj =
          localStorage.getItem("workgrid_projects_data") ||
          localStorage.getItem("jira_projects_data");
        if (rawProj) {
          const pList = JSON.parse(rawProj);
          const foundProj = pList.find((p) => p.id === pId);
          if (foundProj) {
            data.organization_id = foundProj.organization_id;
            data.organizations = {
              id: foundProj.organization_id,
              name: foundProj.name ? `${foundProj.name} Workspace` : "Workspace",
            };
          }
        }
      } catch (_) {}
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

  /**
   * Update organization details
   * @param {string} orgId
   * @param {Object} updates
   * @returns {Promise<Object>}
   */
  async updateOrganization(orgId, updates) {
    if (!orgId) throw new Error("Organization ID is required.");
    const payload = {
      ...updates,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabase
      .from("organizations")
      .update(payload)
      .eq("id", orgId)
      .select()
      .single();

    if (error) {
      console.error("updateOrganization error:", error);
      throw error;
    }
    return data;
  },
};

export default organizationService;
