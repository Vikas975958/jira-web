import { supabase } from "@/lib/supabaseconfig";
import { generateInvitationToken, hashToken } from "@/utils/token";
import { MEMBER_ROLE, MANAGER_ROLE, OWNER_ROLE } from "@/utils/constants";

const LOCAL_STORAGE_PROJECTS_KEY = "jira_projects_data";
const LOCAL_STORAGE_MEMBERS_KEY = "jira_project_members_data";
const LOCAL_STORAGE_INVITES_KEY = "jira_project_invitations_data";

export const projectService = {
  /**
   * Fetch all projects for an organization, scoped by caller role.
   * - Owner / Manager: See all projects belonging to the organization.
   * - Member: See only projects to which they are assigned or created.
   *
   * @param {Object} params
   * @param {string} params.organizationId
   * @param {string} params.userId
   * @param {string} [params.userRole]
   * @returns {Promise<Array>}
   */
  async getProjects({ organizationId, userId, userRole = MEMBER_ROLE }) {
    if (!organizationId) return [];

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
            joined_at,
            profiles:user_id (
              id,
              full_name,
              email,
              phone,
              profile_photo
            )
          )
        `)
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false });

      const { data, error } = await query;
      if (!error && data) {
        projectsFromDb = data;
      }
    } catch (err) {
      console.warn("Supabase projects table query notice:", err?.message || err);
    }

    let allProjects = projectsFromDb;
    if (!allProjects) {
      allProjects = this.getLocalProjects(organizationId);
    }

    // Role-based filtering:
    // Members only see projects where they are assigned as a member or created the project
    if (userRole === MEMBER_ROLE) {
      allProjects = (allProjects || []).filter((p) => {
        if (p.created_by === userId) return true;
        const membersList = p.project_members || [];
        return membersList.some((m) => m.user_id === userId);
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
  },

  /**
   * Get single project by ID with members and invitations.
   * @param {string} projectId
   * @returns {Promise<Object|null>}
   */
  async getProjectById(projectId) {
    if (!projectId) return null;

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
            joined_at,
            profiles:user_id (
              id,
              full_name,
              email,
              phone,
              profile_photo
            )
          )
        `)
        .eq("id", projectId)
        .single();

      if (!error && data) {
        return data;
      }
    } catch (_) {}

    const localList = this.getAllLocalProjects();
    return localList.find((p) => p.id === projectId) || null;
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

    // Creator is always added as manager if they are creator
    if (creatorId && !assignedManagerIds.includes(creatorId) && creatorRole === OWNER_ROLE) {
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
    const { userRole } = context;
    if (userRole === MEMBER_ROLE) {
      throw new Error("Members cannot modify project settings.");
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
    return { id: projectId, ...payload };
  },

  /**
   * Delete a project. Authorized for Owner (or Manager if allowed).
   * @param {string} projectId
   * @param {Object} context
   * @returns {Promise<boolean>}
   */
  async deleteProject(projectId, context = {}) {
    const { userRole } = context;
    if (userRole === MEMBER_ROLE) {
      throw new Error("Members cannot delete projects.");
    }

    try {
      await supabase.from("projects").delete().eq("id", projectId);
    } catch (_) {}

    this.deleteLocalProject(projectId);
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
    return record;
  },

  /**
   * Remove a member from a project.
   */
  async removeProjectMember({ projectId, userId, userRole = MEMBER_ROLE }) {
    if (userRole === MEMBER_ROLE) {
      throw new Error("Members are not authorized to remove team members.");
    }

    try {
      await supabase
        .from("project_members")
        .delete()
        .eq("project_id", projectId)
        .eq("user_id", userId);
    } catch (_) {}

    this.removeLocalProjectMember(projectId, userId);
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

    if (!savedInvite) {
      savedInvite = inviteRecord;
    }

    this.saveLocalProjectInvite(savedInvite);

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
   * @param {string} [projectId]
   * @param {string} [organizationId]
   * @returns {Promise<Array>}
   */
  async getProjectInvitations({ projectId, organizationId }) {
    try {
      let query = supabase.from("project_invitations").select("*");
      if (projectId) query = query.eq("project_id", projectId);
      if (organizationId) query = query.eq("organization_id", organizationId);

      const { data, error } = await query.order("created_at", { ascending: false });
      if (!error && data) {
        return data;
      }
    } catch (_) {}

    const list = this.getLocalProjectInvites();
    return list.filter((item) => {
      if (projectId && item.project_id !== projectId) return false;
      if (organizationId && item.organization_id !== organizationId) return false;
      return true;
    });
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

      if (!error && data?.success) {
        return data;
      }
    } catch (_) {}

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
      const raw = localStorage.getItem(LOCAL_STORAGE_PROJECTS_KEY);
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
      const raw = localStorage.getItem(LOCAL_STORAGE_PROJECTS_KEY);
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
      const raw = localStorage.getItem(LOCAL_STORAGE_MEMBERS_KEY);
      const list = raw ? JSON.parse(raw) : [];
      return list.filter((m) => m.project_id === projectId);
    } catch (_) {
      return [];
    }
  },

  saveLocalProjectMembers(members) {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_MEMBERS_KEY);
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
      const raw = localStorage.getItem(LOCAL_STORAGE_MEMBERS_KEY);
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
      const raw = localStorage.getItem(LOCAL_STORAGE_INVITES_KEY);
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
};

export default projectService;
