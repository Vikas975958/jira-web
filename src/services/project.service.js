import { supabase } from "@/lib/supabaseconfig";
import { generateInvitationToken, hashToken } from "@/utils/token";
import { MEMBER_ROLE, MANAGER_ROLE, OWNER_ROLE } from "@/utils/constants";

const LOCAL_STORAGE_PROJECTS_KEY = "workgrid_projects_data";
const LOCAL_STORAGE_MEMBERS_KEY = "workgrid_project_members_data";
const LOCAL_STORAGE_INVITES_KEY = "workgrid_project_invitations_data";

const LEGACY_STORAGE_PROJECTS_KEY = "jira_projects_data";
const LEGACY_STORAGE_MEMBERS_KEY = "jira_project_members_data";
const LEGACY_STORAGE_INVITES_KEY = "jira_project_invitations_data";

const getStorageItem = (key, legacyKey) => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(key) || localStorage.getItem(legacyKey);
};

const inFlightProjects = new Map();
const projectsCache = new Map();

const inFlightSingleProject = new Map();
const singleProjectCache = new Map();

const inFlightProjectInvitations = new Map();
const projectInvitationsCache = new Map();

const PROJECTS_CACHE_TTL = 60000; // 60 seconds (was 3.5s)

export const clearProjectsCache = () => {
  inFlightProjects.clear();
  projectsCache.clear();
  inFlightSingleProject.clear();
  singleProjectCache.clear();
  inFlightProjectInvitations.clear();
  projectInvitationsCache.clear();
};

export const projectService = {
  clearProjectsCache,

  /**
   * Fetch all projects for an organization, scoped by caller role.
   * - Owner / Manager: See all projects belonging to the organization.
   * - Member: See only projects to which they are assigned or created.
   *
   * @param {Object} params
   * @param {string} params.organizationId
   * @param {string} params.userId
   * @param {string} [params.userRole]
   * @param {boolean} [params.force]
   * @returns {Promise<Array>}
   */
  async getProjects({ organizationId, userId, userRole = MEMBER_ROLE, force = false }) {
    if (!organizationId) return [];

    const cacheKey = `${organizationId}:${userId || ""}:${userRole}`;

    if (!force) {
      const cached = projectsCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < PROJECTS_CACHE_TTL) {
        return cached.data;
      }
      if (inFlightProjects.has(cacheKey)) {
        return inFlightProjects.get(cacheKey);
      }
    }

    const fetchPromise = (async () => {
      let projectsFromDb = null;

      try {
        let query = supabase
          .from("projects")
          .select(`
            id,
            organization_id,
            name,
            description,
            status,
            start_date,
            due_date,
            created_by,
            created_at,
            updated_at,
            project_members (
              id,
              project_id,
              user_id,
              role,
              joined_at
            )
          `)
          .eq("organization_id", organizationId)
          .order("created_at", { ascending: false });

        const { data, error } = await query;
        if (!error && data) {
          const allUserIds = [
            ...new Set(
              data
                .flatMap((p) => (p.project_members || []).map((m) => m.user_id))
                .filter(Boolean)
            ),
          ];

          let profileMap = new Map();
          if (allUserIds.length > 0) {
            try {
              const { data: profs } = await supabase
                .from("profiles")
                .select("id, full_name, email, phone, profile_photo")
                .in("id", allUserIds);
              (profs || []).forEach((pr) => profileMap.set(pr.id, pr));
            } catch (_) {}
          }

          projectsFromDb = data.map((p) => ({
            ...p,
            project_members: (p.project_members || []).map((pm) => ({
              ...pm,
              profiles: profileMap.get(pm.user_id) || null,
            })),
          }));
        }
      } catch (err) {
        console.warn("Supabase projects table query notice:", err?.message || err);
      }

      let allProjects = projectsFromDb;
      if (!allProjects) {
        allProjects = this.getLocalProjects(organizationId);
      }

      // Role-based filtering:
      // - Owner: Full CRUD on all projects in the workspace.
      // - Manager: Only sees and works on projects assigned by the owner or created by themselves.
      // - Member: Only sees projects where they are assigned or created by them.
      if (userRole === MEMBER_ROLE || userRole === MANAGER_ROLE) {
        allProjects = (allProjects || []).filter((p) => {
          if (p.created_by === userId) return true;
          const membersList = p.project_members || [];
          return membersList.some((m) => (m.user_id || m.userId) === userId);
        });
      }

      // Normalize project data with assigned managers and members
      return (allProjects || []).map((project) => {
        const pmList = project.project_members || [];
        const assignedManagers = [];
        const assignedMembers = [];

        pmList.forEach((pm) => {
          const profile = pm.profiles || {
            id: pm.user_id,
            full_name: pm.full_name || "Team Member",
            email: pm.email || "",
          };

          const item = {
            id: pm.id || pm.user_id,
            userId: pm.user_id,
            role: pm.role || MEMBER_ROLE,
            fullName: profile.full_name || profile.email || "Team Member",
            email: profile.email || "",
            profilePhoto: profile.profile_photo || null,
          };

          if (pm.role === MANAGER_ROLE) {
            assignedManagers.push(item);
          } else {
            assignedMembers.push(item);
          }
        });

        return {
          ...project,
          assignedManagers,
          assignedMembers,
          totalTeamCount: assignedManagers.length + assignedMembers.length,
        };
      });
    })();

    inFlightProjects.set(cacheKey, fetchPromise);

    try {
      const result = await fetchPromise;
      projectsCache.set(cacheKey, { data: result, timestamp: Date.now() });
      return result;
    } finally {
      inFlightProjects.delete(cacheKey);
    }
  },

  /**
   * Get single project by ID with members and invitations.
   * Scoped by role: Owners see any project; Managers and Members only see projects they created or are assigned to.
   * @param {string} projectId
   * @param {Object} [context] - { userId, userRole }
   * @returns {Promise<Object|null>}
   */
  async getProjectById(projectId, context = {}, force = false) {
    if (!projectId) return null;
    const { userId, userRole } = context;
    const cacheKey = `${projectId}:${userId || ""}:${userRole || ""}`;

    if (!force) {
      const cached = singleProjectCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < PROJECTS_CACHE_TTL) {
        return cached.data;
      }
      if (inFlightSingleProject.has(cacheKey)) {
        return inFlightSingleProject.get(cacheKey);
      }
    }

    const fetchPromise = (async () => {
      let projectResult = null;

      try {
        const { data, error } = await supabase
          .from("projects")
          .select(`
            *,
            project_members (
              id,
              project_id,
              user_id,
              role,
              joined_at
            )
          `)
          .eq("id", projectId)
          .single();

        if (!error && data) {
          const userIds = [
            ...new Set(
              (data.project_members || []).map((m) => m.user_id).filter(Boolean)
            ),
          ];
          if (userIds.length > 0) {
            try {
              const { data: profs } = await supabase
                .from("profiles")
                .select("id, full_name, email, phone, profile_photo")
                .in("id", userIds);
              const profileMap = new Map((profs || []).map((pr) => [pr.id, pr]));
              data.project_members = (data.project_members || []).map((pm) => ({
                ...pm,
                profiles: profileMap.get(pm.user_id) || null,
              }));
            } catch (_) {}
          }

          const assignedManagers = [];
          const assignedMembers = [];
          (data.project_members || []).forEach((pm) => {
            const profile = pm.profiles || {
              id: pm.user_id,
              full_name: pm.full_name || "Team Member",
              email: pm.email || "",
            };
            const item = {
              id: pm.id || pm.user_id,
              userId: pm.user_id,
              role: pm.role || MEMBER_ROLE,
              fullName: profile.full_name || profile.email || "Team Member",
              email: profile.email || "",
              profilePhoto: profile.profile_photo || null,
            };
            if (pm.role === MANAGER_ROLE) {
              assignedManagers.push(item);
            } else {
              assignedMembers.push(item);
            }
          });

          projectResult = {
            ...data,
            assignedManagers,
            assignedMembers,
            totalTeamCount: assignedManagers.length + assignedMembers.length,
          };
        }
      } catch (_) {}

      if (!projectResult) {
        const localList = this.getAllLocalProjects();
        projectResult = localList.find((p) => p.id === projectId) || null;
      }

      if (!projectResult) return null;

      // Strict role check:
      // If not OWNER, only allowed if user created the project or is in project_members
      if (userRole && userRole !== OWNER_ROLE && userId) {
        const isCreator = projectResult.created_by === userId;
        const isMember = (projectResult.project_members || []).some(
          (m) => (m.user_id || m.userId) === userId
        );
        if (!isCreator && !isMember) {
          return null;
        }
      }

      return projectResult;
    })();

    inFlightSingleProject.set(cacheKey, fetchPromise);
    try {
      const result = await fetchPromise;
      singleProjectCache.set(cacheKey, { data: result, timestamp: Date.now() });
      return result;
    } finally {
      inFlightSingleProject.delete(cacheKey);
    }
  },

  /**
   * Create a new project and assign initial team members.
   *
   * @param {Object} projectData
   * @param {string} projectData.organizationId
   * @param {string} projectData.name
   * @param {string} [projectData.description]
   * @param {string} [projectData.status]
   * @param {string} [projectData.startDate]
   * @param {string} [projectData.dueDate]
   * @param {Array<string>} [projectData.assignedManagerIds]
   * @param {Array<string>} [projectData.assignedMemberIds]
   * @param {Array<Object>} [projectData.newInvitations] - [{ email, fullName, role }]
   * @param {Object} context
   * @param {string} context.creatorId
   * @param {string} context.creatorRole
   * @returns {Promise<Object>}
   */
  async createProject(projectData, context = {}) {
    const {
      organizationId,
      name,
      description = "",
      status = "active",
      startDate = null,
      dueDate = null,
      assignedManagerIds = [],
      assignedMemberIds = [],
      newInvitations = [],
    } = projectData;

    const { creatorId, creatorRole } = context;

    if (!organizationId) throw new Error("Organization ID is required to create a project.");
    if (!name?.trim()) throw new Error("Project name is required.");
    if (creatorRole === MEMBER_ROLE) {
      throw new Error("Members are not authorized to create projects.");
    }

    const projectId = typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `proj_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    const newRecord = {
      id: projectId,
      organization_id: organizationId,
      name: name.trim(),
      description: description.trim(),
      status: status || "active",
      start_date: startDate || null,
      due_date: dueDate || null,
      created_by: creatorId || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    let createdProject = null;

    // 1. Try Supabase insert
    try {
      const { data, error } = await supabase
        .from("projects")
        .insert(newRecord)
        .select()
        .single();

      if (!error && data) {
        createdProject = data;
      }
    } catch (_) {}

    if (!createdProject) {
      createdProject = newRecord;
    }

    // 2. Insert assigned managers and members into project_members
    const membersToInsert = [];

    // Creator is always added as manager if they are creator (Owner or Manager)
    if (creatorId && !assignedManagerIds.includes(creatorId) && (creatorRole === OWNER_ROLE || creatorRole === MANAGER_ROLE)) {
      membersToInsert.push({
        project_id: createdProject.id,
        user_id: creatorId,
        role: MANAGER_ROLE,
        assigned_by: creatorId,
        joined_at: new Date().toISOString(),
      });
    }

    assignedManagerIds.forEach((mId) => {
      if (mId && !membersToInsert.some((item) => item.user_id === mId)) {
        membersToInsert.push({
          project_id: createdProject.id,
          user_id: mId,
          role: MANAGER_ROLE,
          assigned_by: creatorId,
          joined_at: new Date().toISOString(),
        });
      }
    });

    assignedMemberIds.forEach((mId) => {
      if (mId && !membersToInsert.some((item) => item.user_id === mId)) {
        membersToInsert.push({
          project_id: createdProject.id,
          user_id: mId,
          role: MEMBER_ROLE,
          assigned_by: creatorId,
          joined_at: new Date().toISOString(),
        });
      }
    });

    if (membersToInsert.length > 0) {
      try {
        await supabase.from("project_members").insert(membersToInsert);
      } catch (_) {}
      this.saveLocalProjectMembers(membersToInsert);
    }

    // 3. Process any new invitations for this project
    const createdInvites = [];
    if (newInvitations && newInvitations.length > 0) {
      for (const inv of newInvitations) {
        try {
          const invRes = await this.inviteToProject({
            organizationId,
            projectId: createdProject.id,
            email: inv.email,
            fullName: inv.fullName,
            role: inv.role || MEMBER_ROLE,
            invitedBy: creatorId,
          });
          createdInvites.push(invRes);
        } catch (invErr) {
          console.error("Project invitation creation error:", invErr);
        }
      }
    }

    // Always update local cache
    this.saveLocalProject(createdProject);

    clearProjectsCache();
    return {
      ...createdProject,
      invitationsSent: createdInvites,
    };
  },

  /**
   * Update project details.
   * @param {string} projectId
   * @param {Object} updates
   * @param {Object} context
   * @returns {Promise<Object>}
   */
  async updateProject(projectId, updates, context = {}) {
    const { userRole, userId } = context;
    if (userRole === MEMBER_ROLE) {
      throw new Error("Members cannot modify project settings.");
    }

    if (userRole === MANAGER_ROLE && userId) {
      const proj = await this.getProjectById(projectId, { userRole, userId });
      if (!proj) {
        throw new Error("Managers can only modify projects created by themselves or assigned to them.");
      }
    }

    const payload = {
      ...updates,
      updated_at: new Date().toISOString(),
    };

    try {
      const { data, error } = await supabase
        .from("projects")
        .update(payload)
        .eq("id", projectId)
        .select()
        .single();

      if (!error && data) {
        this.updateLocalProject(projectId, data);
        return data;
      }
    } catch (_) {}

    this.updateLocalProject(projectId, payload);
    clearProjectsCache();
    return { id: projectId, ...payload };
  },

  /**
   * Delete a project. Authorized exclusively for Workspace Owner.
   * Neither members nor managers can delete projects.
   * @param {string} projectId
   * @param {Object} context
   * @returns {Promise<boolean>}
   */
  async deleteProject(projectId, context = {}) {
    const { userRole } = context;
    if (userRole !== OWNER_ROLE) {
      throw new Error("Only the workspace owner can delete a project. Managers and members are not authorized.");
    }

    try {
      await supabase.from("projects").delete().eq("id", projectId);
    } catch (_) {}

    this.deleteLocalProject(projectId);
    clearProjectsCache();
    return true;
  },

  /**
   * Directly assign or invite an existing org member to a project.
   */
  async assignProjectMember({ projectId, userId, role = MEMBER_ROLE, assignedBy = null }) {
    if (!projectId || !userId) return null;

    const record = {
      project_id: projectId,
      user_id: userId,
      role: role || MEMBER_ROLE,
      assigned_by: assignedBy,
      joined_at: new Date().toISOString(),
    };

    try {
      const { data, error } = await supabase
        .from("project_members")
        .insert(record)
        .select()
        .single();

      if (!error && data) {
        this.saveLocalProjectMembers([data]);
        return data;
      }
    } catch (_) {}

    this.saveLocalProjectMembers([record]);
    clearProjectsCache();
    return record;
  },

  /**
   * Remove a member from a project.
   */
  async removeProjectMember({ projectId, userId, userRole = MEMBER_ROLE, callerId = null }) {
    if (userRole === MEMBER_ROLE) {
      throw new Error("Members are not authorized to remove team members.");
    }

    if (userRole === MANAGER_ROLE && callerId) {
      const proj = await this.getProjectById(projectId, { userRole, userId: callerId });
      if (!proj) {
        throw new Error("Managers can only manage members in projects created by themselves or assigned to them.");
      }
    }

    try {
      const { data: targetUser } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .maybeSingle();
      if (targetUser && targetUser.role === OWNER_ROLE) {
        throw new Error("Cannot remove the Workspace Owner from a project.");
      }
    } catch (e) {
      if (e?.message && e.message.includes("Workspace Owner")) throw e;
    }

    try {
      await supabase
        .from("project_members")
        .delete()
        .eq("project_id", projectId)
        .eq("user_id", userId);
    } catch (_) {}

    // Cascade: Clean up matching project invitations for this user's email
    try {
      const { data: prof } = await supabase
        .from("profiles")
        .select("email")
        .eq("id", userId)
        .maybeSingle();

      if (prof?.email) {
        const cleanEmail = prof.email.trim().toLowerCase();
        await supabase
          .from("project_invitations")
          .delete()
          .eq("project_id", projectId)
          .eq("email", cleanEmail);
        this.removeLocalProjectInvite(null, cleanEmail);
      }
    } catch (_) {}

    // Cascade: Unassign any tasks in this project assigned to this user
    try {
      await supabase
        .from("tasks")
        .update({ assignee_id: null })
        .eq("project_id", projectId)
        .eq("assignee_id", userId);
    } catch (_) {}

    this.removeLocalProjectMember(projectId, userId);
    clearProjectsCache();

    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("project-updated", { detail: { id: projectId, userId } })
      );
    }

    return true;
  },

  /**
   * Send an invitation to a project.
   * Handles:
   * - Case A: User already has an account & belongs to org -> Pending invitation or assignment
   * - Case B: User does not have an account -> Pending invitation with signup URL token
   *
   * @param {Object} params
   * @param {string} params.organizationId
   * @param {string} params.projectId
   * @param {string} params.email
   * @param {string} [params.fullName]
   * @param {string} [params.role]
   * @param {string} [params.invitedBy]
   * @returns {Promise<Object>}
   */
  async inviteToProject({
    organizationId,
    projectId,
    email,
    fullName = "",
    role = MEMBER_ROLE,
    invitedBy = null,
  }) {
    if (!organizationId || !projectId || !email) {
      throw new Error("Missing required parameters for project invitation.");
    }

    const cleanEmail = email.trim().toLowerCase();
    const token = generateInvitationToken();
    const tokenHash = await hashToken(token);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const inviteRecord = {
      id: typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `pi_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      organization_id: organizationId,
      project_id: projectId,
      email: cleanEmail,
      full_name: fullName.trim(),
      intended_role: role || MEMBER_ROLE,
      invitation_token_hash: tokenHash,
      status: "pending",
      invited_by: invitedBy,
      expires_at: expiresAt,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    let savedInvite = null;

    try {
      const { data, error } = await supabase
        .from("project_invitations")
        .insert(inviteRecord)
        .select()
        .single();

      if (!error && data) {
        savedInvite = data;
      }
    } catch (_) {}

    // Also mirror to request_member / request_manager so public invitation read policy applies
    try {
      const reqTable = role === MANAGER_ROLE ? "request_manager" : "request_member";
      await supabase.from(reqTable).insert({
        organization_id: organizationId,
        email: cleanEmail,
        full_name: fullName.trim(),
        role: role || MEMBER_ROLE,
        invitation_token_hash: tokenHash,
        status: "pending",
        invited_by: invitedBy,
        requested_by: invitedBy,
        expires_at: expiresAt,
      });
    } catch (_) {}

    if (!savedInvite) {
      savedInvite = inviteRecord;
    }

    this.saveLocalProjectInvite(savedInvite);
    clearProjectsCache();

    const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
    const signupUrl = `${origin}/signup?token=${token}&role=${role}&projectId=${projectId}`;

    return {
      ...savedInvite,
      invitationToken: token,
      signupUrl,
    };
  },

  /**
   * Get project invitations for a project or an organization.
   * Automatically reconciles with request tables so cancelled/deleted invitations are purged.
   * @param {string} [projectId]
   * @param {string} [organizationId]
   * @param {boolean} [force]
   * @returns {Promise<Array>}
   */
  async getProjectInvitations({ projectId, organizationId }, force = false) {
    const cacheKey = `${projectId || ""}:${organizationId || ""}`;

    if (!force) {
      const cached = projectInvitationsCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < PROJECTS_CACHE_TTL) {
        return cached.data;
      }
      if (inFlightProjectInvitations.has(cacheKey)) {
        return inFlightProjectInvitations.get(cacheKey);
      }
    }

    const fetchPromise = (async () => {
      let invitations = [];
      try {
        let query = supabase.from("project_invitations").select("*");
        if (projectId) query = query.eq("project_id", projectId);
        if (organizationId) query = query.eq("organization_id", organizationId);

        const { data, error } = await query.order("created_at", { ascending: false });
        if (!error && Array.isArray(data)) {
          invitations = data;
        }
      } catch (_) {}

      if (invitations.length === 0) {
        const list = this.getLocalProjectInvites();
        invitations = list.filter((item) => {
          if (projectId && item.project_id !== projectId) return false;
          if (organizationId && item.organization_id !== organizationId) return false;
          return true;
        });
      }

      // Reconcile and purge any invitations whose requests have been deleted
      if (invitations.length > 0) {
        try {
          const emails = [
            ...new Set(invitations.map((i) => i.email?.trim()?.toLowerCase()).filter(Boolean)),
          ];
          if (emails.length > 0) {
            const [memRes, mgrRes] = await Promise.all([
              supabase.from("request_member").select("email, status").in("email", emails),
              supabase.from("request_manager").select("email, status").in("email", emails),
            ]);

            if (!memRes?.error && !mgrRes?.error) {
              const activeEmails = new Set();
              (memRes?.data || []).forEach((r) => {
                if (r.status === "pending") activeEmails.add(r.email?.trim()?.toLowerCase());
              });
              (mgrRes?.data || []).forEach((r) => {
                if (r.status === "pending") activeEmails.add(r.email?.trim()?.toLowerCase());
              });

              const staleInvites = invitations.filter((inv) => {
                const e = inv.email?.trim()?.toLowerCase();
                return e && !activeEmails.has(e);
              });

              if (staleInvites.length > 0) {
                staleInvites.forEach((inv) => {
                  this.removeLocalProjectInvite(inv.id, inv.email);
                  supabase.from("project_invitations").delete().eq("id", inv.id).then(() => {});
                });
                invitations = invitations.filter((inv) => {
                  const e = inv.email?.trim()?.toLowerCase();
                  return e && activeEmails.has(e);
                });
              }
            }
          }
        } catch (_) {}
      }

      return invitations;
    })();

    inFlightProjectInvitations.set(cacheKey, fetchPromise);
    try {
      const result = await fetchPromise;
      projectInvitationsCache.set(cacheKey, { data: result, timestamp: Date.now() });
      return result;
    } finally {
      inFlightProjectInvitations.delete(cacheKey);
    }
  },

  /**
   * Delete a project invitation everywhere (project_invitations, request tables, localStorage).
   * @param {string} invitationId
   * @param {Object} [details] - { email, projectId, organizationId }
   * @returns {Promise<boolean>}
   */
  async deleteProjectInvitation(invitationId, { email, projectId, organizationId } = {}) {
    if (!invitationId && !email) return false;

    let targetEmail = email;
    let targetOrgId = organizationId;
    let targetProjectId = projectId;

    if (!targetEmail || !targetOrgId) {
      try {
        const { data } = await supabase
          .from("project_invitations")
          .select("email, organization_id, project_id")
          .eq("id", invitationId)
          .maybeSingle();
        if (data) {
          if (!targetEmail) targetEmail = data.email;
          if (!targetOrgId) targetOrgId = data.organization_id;
          if (!targetProjectId) targetProjectId = data.project_id;
        }
      } catch (_) {}
    }

    if (!targetEmail) {
      const local = this.getLocalProjectInvites().find((i) => i.id === invitationId);
      if (local) {
        targetEmail = local.email;
        targetOrgId = targetOrgId || local.organization_id;
        targetProjectId = targetProjectId || local.project_id;
      }
    }

    const cleanEmail = targetEmail?.trim()?.toLowerCase();

    // 1. Delete from project_invitations
    try {
      if (invitationId) {
        await supabase.from("project_invitations").delete().eq("id", invitationId);
      }
      if (cleanEmail) {
        let q = supabase.from("project_invitations").delete().eq("email", cleanEmail);
        if (targetProjectId) q = q.eq("project_id", targetProjectId);
        await q;
      }
    } catch (err) {
      console.error("deleteProjectInvitation error:", err);
    }

    // 2. Cascade delete from request_member and request_manager
    try {
      if (cleanEmail) {
        let q1 = supabase.from("request_member").delete().eq("email", cleanEmail);
        if (targetOrgId) q1 = q1.eq("organization_id", targetOrgId);
        await q1;

        let q2 = supabase.from("request_manager").delete().eq("email", cleanEmail);
        if (targetOrgId) q2 = q2.eq("organization_id", targetOrgId);
        await q2;
      }
    } catch (_) {}

    // 3. Remove from localStorage
    this.removeLocalProjectInvite(invitationId, cleanEmail);

    // 4. Clear cache and notify
    clearProjectsCache();
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("invitation-deleted", {
          detail: {
            id: invitationId,
            email: cleanEmail,
            projectId: targetProjectId,
            organizationId: targetOrgId,
          },
        })
      );
      window.dispatchEvent(
        new CustomEvent("project-updated", {
          detail: { projectId: targetProjectId, email: cleanEmail },
        })
      );
    }

    return true;
  },

  /**
   * Accept project invitation.
   */
  async acceptProjectInvitation({ token, userId, userEmail }) {
    if (!token || !userId || !userEmail) {
      throw new Error("Missing parameters for project invitation acceptance.");
    }

    const tokenHash = await hashToken(token);

    // 1. Try Supabase RPC
    try {
      const { data, error } = await supabase.rpc("accept_project_invitation", {
        p_token_hash: tokenHash,
        p_user_id: userId,
        p_user_email: userEmail,
      });

      if (!error && data) {
        if (data.success) return data;
        if (data.error && data.error.includes("email does not match")) {
          throw new Error(data.error);
        }
      }
    } catch (err) {
      if (err.message && err.message.includes("email does not match")) {
        throw err;
      }
    }

    // 2. Direct fallback
    const invites = this.getLocalProjectInvites();
    const matched = invites.find(
      (i) => i.invitation_token_hash === tokenHash && i.status === "pending"
    );

    if (matched) {
      matched.status = "accepted";
      matched.accepted_by = userId;
      matched.accepted_at = new Date().toISOString();
      this.updateLocalProjectInvite(matched.id, matched);

      this.saveLocalProjectMembers([
        {
          project_id: matched.project_id,
          user_id: userId,
          role: matched.intended_role || MEMBER_ROLE,
          assigned_by: matched.invited_by,
          joined_at: new Date().toISOString(),
        },
      ]);

      return {
        success: true,
        project_id: matched.project_id,
        organization_id: matched.organization_id,
        role: matched.intended_role,
      };
    }

    return { success: false, error: "Project invitation not found or expired." };
  },

  // ─────────────────────────────────────────────────────────
  // LocalStorage Helpers for zero-crash offline resilience
  // ─────────────────────────────────────────────────────────
  getLocalProjects(organizationId) {
    if (typeof window === "undefined") return [];
    try {
      const raw = getStorageItem(LOCAL_STORAGE_PROJECTS_KEY, LEGACY_STORAGE_PROJECTS_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((p) => p.organization_id === organizationId);
    } catch (_) {
      return [];
    }
  },

  getAllLocalProjects() {
    if (typeof window === "undefined") return [];
    try {
      const raw = getStorageItem(LOCAL_STORAGE_PROJECTS_KEY, LEGACY_STORAGE_PROJECTS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (_) {
      return [];
    }
  },

  saveLocalProject(project) {
    if (typeof window === "undefined") return;
    try {
      const list = this.getAllLocalProjects();
      const updated = [project, ...list.filter((p) => p.id !== project.id)];
      localStorage.setItem(LOCAL_STORAGE_PROJECTS_KEY, JSON.stringify(updated));
    } catch (_) {}
  },

  updateLocalProject(projectId, updates) {
    if (typeof window === "undefined") return;
    try {
      const list = this.getAllLocalProjects();
      const updated = list.map((p) => (p.id === projectId ? { ...p, ...updates } : p));
      localStorage.setItem(LOCAL_STORAGE_PROJECTS_KEY, JSON.stringify(updated));
    } catch (_) {}
  },

  deleteLocalProject(projectId) {
    if (typeof window === "undefined") return;
    try {
      const list = this.getAllLocalProjects();
      const updated = list.filter((p) => p.id !== projectId);
      localStorage.setItem(LOCAL_STORAGE_PROJECTS_KEY, JSON.stringify(updated));
    } catch (_) {}
  },

  getLocalProjectMembers(projectId) {
    if (typeof window === "undefined") return [];
    try {
      const raw = getStorageItem(LOCAL_STORAGE_MEMBERS_KEY, LEGACY_STORAGE_MEMBERS_KEY);
      const list = raw ? JSON.parse(raw) : [];
      return list.filter((m) => m.project_id === projectId);
    } catch (_) {
      return [];
    }
  },

  saveLocalProjectMembers(members) {
    if (typeof window === "undefined") return;
    try {
      const raw = getStorageItem(LOCAL_STORAGE_MEMBERS_KEY, LEGACY_STORAGE_MEMBERS_KEY);
      const list = raw ? JSON.parse(raw) : [];
      const updated = [...list];
      members.forEach((m) => {
        if (!updated.some((item) => item.project_id === m.project_id && item.user_id === m.user_id)) {
          updated.push(m);
        }
      });
      localStorage.setItem(LOCAL_STORAGE_MEMBERS_KEY, JSON.stringify(updated));
    } catch (_) {}
  },

  removeLocalProjectMember(projectId, userId) {
    if (typeof window === "undefined") return;
    try {
      const raw = getStorageItem(LOCAL_STORAGE_MEMBERS_KEY, LEGACY_STORAGE_MEMBERS_KEY);
      const list = raw ? JSON.parse(raw) : [];
      const updated = list.filter(
        (m) => !(m.project_id === projectId && m.user_id === userId)
      );
      localStorage.setItem(LOCAL_STORAGE_MEMBERS_KEY, JSON.stringify(updated));
    } catch (_) {}
  },

  getLocalProjectInvites() {
    if (typeof window === "undefined") return [];
    try {
      const raw = getStorageItem(LOCAL_STORAGE_INVITES_KEY, LEGACY_STORAGE_INVITES_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (_) {
      return [];
    }
  },

  saveLocalProjectInvite(invite) {
    if (typeof window === "undefined") return;
    try {
      const list = this.getLocalProjectInvites();
      const updated = [invite, ...list.filter((i) => i.id !== invite.id)];
      localStorage.setItem(LOCAL_STORAGE_INVITES_KEY, JSON.stringify(updated));
    } catch (_) {}
  },

  updateLocalProjectInvite(inviteId, updates) {
    if (typeof window === "undefined") return;
    try {
      const list = this.getLocalProjectInvites();
      const updated = list.map((i) => (i.id === inviteId ? { ...i, ...updates } : i));
      localStorage.setItem(LOCAL_STORAGE_INVITES_KEY, JSON.stringify(updated));
    } catch (_) {}
  },

  removeLocalProjectInvite(inviteId, email) {
    if (typeof window === "undefined") return;
    try {
      const list = this.getLocalProjectInvites();
      const cleanEmail = email ? email.trim().toLowerCase() : null;
      const updated = list.filter((i) => {
        if (inviteId && i.id === inviteId) return false;
        if (cleanEmail && i.email?.trim()?.toLowerCase() === cleanEmail) return false;
        return true;
      });
      localStorage.setItem(LOCAL_STORAGE_INVITES_KEY, JSON.stringify(updated));
      localStorage.setItem(LEGACY_STORAGE_INVITES_KEY, JSON.stringify(updated));
    } catch (_) {}
  },
};

export default projectService;
