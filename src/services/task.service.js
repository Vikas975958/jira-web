import { supabase } from "@/lib/supabaseconfig";
import { MEMBER_ROLE, MANAGER_ROLE, OWNER_ROLE } from "@/utils/constants";

const LOCAL_STORAGE_KEY = "jira_tickets";

export const taskService = {
  /**
   * Fetch tasks for an organization respecting role and permissions.
   * - Members: Only see their own assigned tasks.
   * - Managers & Owners: See all tasks for the organization.
   *
   * @param {Object} params
   * @param {string} params.organizationId
   * @param {string} params.userId
   * @param {string} [params.userRole]
   * @param {string} [params.userName]
   * @param {string} [params.userEmail]
   * @returns {Promise<Array>} List of tasks
   */
  async getTasks({
    organizationId,
    userId,
    userRole = MEMBER_ROLE,
    userName = "",
    userEmail = "",
  }) {
    if (!organizationId) return [];

    let tasksFromDb = null;

    // 1. Try fetching from Supabase tasks table
    try {
      let query = supabase
        .from("tasks")
        .select("*")
        .eq("organization_id", organizationId);

      // If user is member, filter by assignee
      if (userRole === MEMBER_ROLE) {
        if (userId) {
          query = query.or(`assignee_id.eq.${userId},assignee.ilike.%${userEmail}%,assignee.ilike.%${userName}%`);
        }
      }

      const { data, error } = await query.order("created_at", { ascending: false });
      if (!error && data) {
        tasksFromDb = data;
      }
    } catch (_) {
      // Supabase table query fallback
    }

    // 2. If Supabase returned data, use it; otherwise fallback to localStorage
    let allTasks = tasksFromDb;
    if (!allTasks) {
      allTasks = this.getLocalTasks(organizationId);
    }

    // 3. Strict application-level enforcement of role restrictions
    if (userRole === MEMBER_ROLE) {
      const cleanName = (userName || "").trim().toLowerCase();
      const cleanEmail = (userEmail || "").trim().toLowerCase();

      return (allTasks || []).filter((task) => {
        // Must belong to current organization
        if (task.organization_id && task.organization_id !== organizationId) {
          return false;
        }

        // Assigned to this user by ID, email, or full name
        const matchId = userId && task.assignee_id === userId;
        const taskAssignee = (task.assignee || "").toLowerCase();
        const matchName = cleanName && (taskAssignee.includes(cleanName) || cleanName.includes(taskAssignee));
        const matchEmail = cleanEmail && taskAssignee.includes(cleanEmail);

        return matchId || matchName || matchEmail;
      });
    }

    // Owners and Managers see all tasks within their organization
    return (allTasks || []).filter((task) => {
      return !task.organization_id || task.organization_id === organizationId;
    });
  },

  /**
   * Create a new task.
   * @param {Object} taskData
   * @returns {Promise<Object>}
   */
  async createTask(taskData) {
    const {
      organizationId,
      title,
      description = "",
      status = "todo",
      priority = "medium",
      type = "task",
      assignee = "Unassigned",
      assigneeId = null,
      projectName = "Main Project",
      dueDate = null,
      createdBy = null,
    } = taskData;

    const nextId = `JIRA-${Math.floor(100 + Math.random() * 900)}`;

    const newTask = {
      id: nextId,
      organization_id: organizationId,
      title: title?.trim(),
      description: description?.trim() || "",
      status,
      priority,
      type,
      assignee: assignee?.trim() || "Unassigned",
      assignee_id: assigneeId || null,
      project_name: projectName,
      due_date: dueDate || null,
      created_by: createdBy,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // 1. Try Supabase insert
    try {
      const { data, error } = await supabase
        .from("tasks")
        .insert(newTask)
        .select()
        .single();

      if (!error && data) {
        this.saveLocalTask(data);
        return data;
      }
    } catch (_) {}

    // 2. Fallback to localStorage
    this.saveLocalTask(newTask);
    return newTask;
  },

  /**
   * Update an existing task.
   * @param {string} taskId
   * @param {Object} updates
   * @param {Object} [context] - { userId, userRole }
   * @returns {Promise<Object>}
   */
  async updateTask(taskId, updates, context = {}) {
    const payload = {
      ...updates,
      updated_at: new Date().toISOString(),
    };

    // 1. Try Supabase update
    try {
      const { data, error } = await supabase
        .from("tasks")
        .update(payload)
        .eq("id", taskId)
        .select()
        .single();

      if (!error && data) {
        this.updateLocalTask(taskId, data);
        return data;
      }
    } catch (_) {}

    // 2. Fallback to localStorage
    this.updateLocalTask(taskId, payload);
    return { id: taskId, ...payload };
  },

  /**
   * Delete a task (Authorized for Owner & Manager).
   * @param {string} taskId
   * @param {string} userRole
   * @returns {Promise<boolean>}
   */
  async deleteTask(taskId, userRole) {
    if (userRole === MEMBER_ROLE) {
      throw new Error("Members cannot delete tasks. Action restricted to owners and managers.");
    }

    try {
      await supabase.from("tasks").delete().eq("id", taskId);
    } catch (_) {}

    this.deleteLocalTask(taskId);
    return true;
  },

  // ─────────────────────────────────────────────────────────
  // LocalStorage Helpers
  // ─────────────────────────────────────────────────────────
  getLocalTasks(organizationId) {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(
        (t) => !t.organization_id || t.organization_id === organizationId
      );
    } catch (_) {
      return [];
    }
  },

  saveLocalTask(task) {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
      const list = raw ? JSON.parse(raw) : [];
      const updated = [task, ...list.filter((t) => t.id !== task.id)];
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
    } catch (_) {}
  },

  updateLocalTask(taskId, updates) {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
      const list = raw ? JSON.parse(raw) : [];
      const updated = list.map((t) => (t.id === taskId ? { ...t, ...updates } : t));
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
    } catch (_) {}
  },

  deleteLocalTask(taskId) {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
      const list = raw ? JSON.parse(raw) : [];
      const updated = list.filter((t) => t.id !== taskId);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
    } catch (_) {}
  },
};

export default taskService;
