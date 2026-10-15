import { supabase } from "@/lib/supabaseconfig";
import { MEMBER_ROLE, MANAGER_ROLE, OWNER_ROLE } from "@/utils/constants";
import { parseIssue } from "@/utils/issueHelper";

const LOCAL_STORAGE_KEY = "workgrid_tickets";
const LEGACY_LOCAL_STORAGE_KEY = "jira_tickets";

const inFlightTasks = new Map();
const tasksCache = new Map();
const TASKS_CACHE_TTL = 60000; // 60 seconds
const healedTaskIds = new Set();

export const clearTasksCache = () => {
  inFlightTasks.clear();
  tasksCache.clear();
};

export const taskService = {
  clearTasksCache,
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
   * @param {boolean} [params.force]
   * @returns {Promise<Array>} List of tasks
   */
  async getTasks({
    organizationId,
    userId,
    userRole = MEMBER_ROLE,
    userName = "",
    userEmail = "",
    force = false,
  }) {
    if (!organizationId) return [];

    const cacheKey = `${organizationId}:${userId || ""}:${userRole}:${userName || ""}:${userEmail || ""}`;

    if (!force) {
      const cached = tasksCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < TASKS_CACHE_TTL) {
        return cached.data;
      }
      if (inFlightTasks.has(cacheKey)) {
        return inFlightTasks.get(cacheKey);
      }
    }

    const fetchPromise = (async () => {

    let tasksFromDb = null;

    // 1. Try fetching from Supabase tasks table
    try {
      let query = supabase
        .from("tasks")
        .select("*")
        .eq("organization_id", organizationId);

      // If user is member, filter by assignee_id or created_by
      if (userRole === MEMBER_ROLE && userId) {
        query = query.or(`assignee_id.eq.${userId},created_by.eq.${userId}`);
      }

      let { data, error } = await query.order("created_at", { ascending: false });

      // Fallback: If query with filter returned an error, query org directly and rely on RLS/application filtering
      if (error && userRole === MEMBER_ROLE) {
        const retry = await supabase
          .from("tasks")
          .select("*")
          .eq("organization_id", organizationId)
          .order("created_at", { ascending: false });
        if (!retry.error && retry.data) {
          data = retry.data;
          error = null;
        }
      }

      if (!error && data) {
        tasksFromDb = data;
      }
    } catch (_) {
      // Supabase table query fallback
    }

    // 2. Seamlessly merge Supabase tasks and localStorage tasks
    const localTasks = this.getLocalTasks(organizationId);
    const taskMap = new Map();

    // Add local tasks first (parsed with metadata)
    (localTasks || []).forEach((t) => {
      if (t && t.id) {
        taskMap.set(t.id, parseIssue(t));
      }
    });

    // Overlay DB tasks (parsed with metadata, taking precedence for DB fields)
    (tasksFromDb || []).forEach((dbTask) => {
      if (dbTask && dbTask.id) {
        const localMatch = taskMap.get(dbTask.id);
        const parsedDb = parseIssue(dbTask);
        const merged = {
          ...(localMatch || {}),
          ...parsedDb,
          status: localMatch?.status === "backlog" && parsedDb.status === "todo"
            ? "backlog"
            : parsedDb.status || localMatch?.status || "todo",
          projectId: parsedDb?.projectId || localMatch?.projectId || null,
          project_id: parsedDb?.project_id || localMatch?.project_id || null,
          projectName: parsedDb?.projectName || localMatch?.projectName || dbTask.project_name || "Main Project",
          project_name: parsedDb?.project_name || localMatch?.project_name || dbTask.project_name || "Main Project",
        };
        taskMap.set(dbTask.id, merged);
      }
    });

    let allTasks = Array.from(taskMap.values());
    allTasks.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

    // 3. Auto-heal missing assignee_id on existing tasks for owners/managers (only once per task)
    if ((userRole === OWNER_ROLE || userRole === MANAGER_ROLE) && tasksFromDb && tasksFromDb.length > 0) {
      const tasksMissingAssigneeId = tasksFromDb.filter(
        (t) => !t.assignee_id && t.assignee && t.assignee.trim().toLowerCase() !== "unassigned" && !healedTaskIds.has(t.id)
      );
      if (tasksMissingAssigneeId.length > 0) {
        tasksMissingAssigneeId.forEach((t) => healedTaskIds.add(t.id));
        (async () => {
          try {
            const { data: profiles } = await supabase
              .from("profiles")
              .select("id, full_name, email");
            if (profiles && profiles.length > 0) {
              for (const t of tasksMissingAssigneeId) {
                const cleanT = t.assignee.toLowerCase().trim();
                const matched = profiles.find(
                  (p) =>
                    (p.full_name && p.full_name.toLowerCase().trim() === cleanT) ||
                    (p.email && p.email.toLowerCase().trim() === cleanT) ||
                    (p.full_name && cleanT.includes(p.full_name.toLowerCase().trim()))
                );
                if (matched?.id) {
                  t.assignee_id = matched.id;
                  await supabase
                    .from("tasks")
                    .update({ assignee_id: matched.id })
                    .eq("id", t.id);
                }
              }
            }
          } catch (_) {}
        })();
      }
    }

    // 4. Strict application-level enforcement of role restrictions
    if (userRole === MEMBER_ROLE) {
      const cleanName = (userName || "").trim().toLowerCase();
      const cleanEmail = (userEmail || "").trim().toLowerCase();

      return (allTasks || []).filter((task) => {
        // Must belong to current organization
        if (task.organization_id && task.organization_id !== organizationId) {
          return false;
        }

        // Assigned to this user by ID, email, or full name, OR created by this user
        const matchId = userId && (task.assignee_id === userId || task.assigneeId === userId);
        const matchCreator = userId && (task.created_by === userId || task.createdBy === userId);
        const taskAssignee = (task.assignee || "").toLowerCase().trim();
        const matchName = cleanName && (
          taskAssignee === cleanName ||
          taskAssignee.includes(cleanName) ||
          cleanName.includes(taskAssignee)
        );
        const matchEmail = cleanEmail && taskAssignee.includes(cleanEmail);

        return matchId || matchCreator || matchName || matchEmail;
      });
    }

    // Managers only work on projects assigned by the owner or created by themselves
    if (userRole === MANAGER_ROLE && userId) {
      let allowedProjectIds = new Set();
      try {
        const { data: projs } = await supabase
          .from("projects")
          .select("id, created_by, project_members(user_id)")
          .eq("organization_id", organizationId);
        (projs || []).forEach((p) => {
          if (
            p.created_by === userId ||
            (p.project_members || []).some((m) => m.user_id === userId)
          ) {
            allowedProjectIds.add(p.id);
          }
        });
      } catch (_) {}

      if (typeof window !== "undefined") {
        try {
          const raw =
            localStorage.getItem("workgrid_projects_data") ||
            localStorage.getItem("jira_projects_data");
          if (raw) {
            const parsed = JSON.parse(raw);
            (parsed || []).forEach((p) => {
              if (
                p.organization_id === organizationId &&
                (p.created_by === userId ||
                  (p.project_members || []).some(
                    (m) => (m.user_id || m.userId) === userId
                  ))
              ) {
                allowedProjectIds.add(p.id);
              }
            });
          }
        } catch (_) {}
      }

      const cleanName = (userName || "").trim().toLowerCase();
      const cleanEmail = (userEmail || "").trim().toLowerCase();

      return (allTasks || []).filter((task) => {
        if (task.organization_id && task.organization_id !== organizationId) {
          return false;
        }

        const taskProjId = task.project_id || task.projectId;
        if (taskProjId && allowedProjectIds.has(taskProjId)) {
          return true;
        }

        const matchId = userId && (task.assignee_id === userId || task.assigneeId === userId);
        const matchCreator = userId && (task.created_by === userId || task.createdBy === userId);
        const taskAssignee = (task.assignee || "").toLowerCase().trim();
        const matchName = cleanName && (
          taskAssignee === cleanName ||
          taskAssignee.includes(cleanName) ||
          cleanName.includes(taskAssignee)
        );
        const matchEmail = cleanEmail && taskAssignee.includes(cleanEmail);

        return matchId || matchCreator || matchName || matchEmail;
      });
    }

    // Owners have full access and see all tasks within their organization
    return (allTasks || []).filter((task) => {
      return !task.organization_id || task.organization_id === organizationId;
    });
    })();

    inFlightTasks.set(cacheKey, fetchPromise);
    try {
      const result = await fetchPromise;
      tasksCache.set(cacheKey, { data: result, timestamp: Date.now() });
      return result;
    } finally {
      inFlightTasks.delete(cacheKey);
    }
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
      projectId = null,
      dueDate = null,
      createdBy = null,
    } = taskData;

    let finalAssigneeId = assigneeId || taskData.assignee_id || null;
    const finalCreatedBy = createdBy || taskData.created_by || null;
    const finalProjectId = taskData.project_id || taskData.projectId || projectId || null;
    const finalProjectName = taskData.project_name || taskData.projectName || projectName || "Main Project";
    const finalDueDate = taskData.due_date || taskData.dueDate || dueDate || null;

    // Fallback: If assigneeId is missing but assignee name/email is provided, resolve it
    if (!finalAssigneeId && assignee && assignee.trim().toLowerCase() !== "unassigned") {
      try {
        const cleanAssignee = assignee.toLowerCase().trim();
        const { data: matchedProf } = await supabase
          .from("profiles")
          .select("id, full_name, email");
        if (matchedProf && matchedProf.length > 0) {
          const match = matchedProf.find(
            (p) =>
              (p.full_name && p.full_name.toLowerCase().trim() === cleanAssignee) ||
              (p.email && p.email.toLowerCase().trim() === cleanAssignee) ||
              (p.full_name && cleanAssignee.includes(p.full_name.toLowerCase().trim()))
          );
          if (match?.id) {
            finalAssigneeId = match.id;
          }
        }
      } catch (_) {}
    }

    const projectPrefix = (finalProjectName || "TASK")
      .trim()
      .split(/\s+/)[0]
      ?.toUpperCase()
      .replace(/[^A-Z0-9]/g, "") || "TASK";

    const nextId = taskData.id || `${projectPrefix}-${Math.floor(100 + Math.random() * 900)}`;

    // Database check constraint allows only ('todo', 'in-progress', 'review', 'done')
    // Map 'backlog' to 'todo' for the DB column so insert never fails
    const dbStatus = status === "backlog" ? "todo" : (status || "todo");

    const insertPayload = {
      organization_id: organizationId,
      title: title?.trim(),
      description: description?.trim() || "",
      status: dbStatus,
      priority,
      type,
      assignee: assignee?.trim() || "Unassigned",
      assignee_id: finalAssigneeId,
      project_name: finalProjectName,
      due_date: finalDueDate,
      created_by: finalCreatedBy,
    };

    if (taskData.id) {
      insertPayload.id = taskData.id;
    }

    // 1. Try Supabase insert
    try {
      const { data, error } = await supabase
        .from("tasks")
        .insert(insertPayload)
        .select()
        .single();

      if (!error && data) {
        clearTasksCache();
        const mergedTask = parseIssue({
          ...taskData,
          ...data,
          status: taskData.status || status,
          projectId: finalProjectId,
          project_id: finalProjectId,
          projectName: finalProjectName,
          project_name: finalProjectName,
        });
        this.saveLocalTask(mergedTask);
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("workgrid-task-created", { detail: mergedTask })
          );
        }
        return mergedTask;
      }
    } catch (_) {}

    // 2. Fallback to localStorage
    const fallbackTask = parseIssue({
      id: nextId,
      ...taskData,
      ...insertPayload,
      status: taskData.status || status,
      projectId: finalProjectId,
      project_id: finalProjectId,
      projectName: finalProjectName,
      project_name: finalProjectName,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    clearTasksCache();
    this.saveLocalTask(fallbackTask);
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("workgrid-task-created", { detail: fallbackTask })
      );
    }
    return fallbackTask;
  },

  /**
   * Fetch a single task by ID.
   * @param {string} taskId
   * @param {Object} [options]
   * @returns {Promise<Object|null>}
   */
  async getTaskById(taskId, { organizationId } = {}) {
    if (!taskId) return null;

    // 1. Check local storage first
    const localTasks = this.getLocalTasks(organizationId);
    let matched = localTasks.find((t) => t.id === taskId);

    // 2. Try fetching from Supabase tasks table
    try {
      let query = supabase.from("tasks").select("*").eq("id", taskId);
      if (organizationId) {
        query = query.eq("organization_id", organizationId);
      }
      const { data, error } = await query.single();
      if (!error && data) {
        const merged = parseIssue({ ...matched, ...data });
        this.saveLocalTask(merged);
        return merged;
      }
    } catch (_) {}

    return matched ? parseIssue(matched) : null;
  },

  /**
   * Update an existing task.
   * @param {string} taskId
   * @param {Object} updates
   * @param {Object} [context] - { userId, userRole }
   * @returns {Promise<Object>}
   */
  async updateTask(taskId, updates, context = {}) {
    const knownColumns = [
      "organization_id",
      "title",
      "description",
      "status",
      "priority",
      "type",
      "project_name",
      "due_date",
      "assignee",
      "assignee_id",
      "created_by",
    ];

    const dbPayload = {
      updated_at: new Date().toISOString(),
    };

    Object.keys(updates).forEach((k) => {
      if (knownColumns.includes(k)) {
        if (k === "status" && updates[k] === "backlog") {
          dbPayload[k] = "todo";
        } else {
          dbPayload[k] = updates[k];
        }
      }
    });

    // If status is updated, ensure metadata in description records the new status
    // so if status is 'backlog', it is preserved even though DB column is 'todo'
    if (updates.status) {
      let currentDesc = updates.description;
      if (typeof currentDesc === "undefined") {
        const local = this.getLocalTasks().find((t) => t.id === taskId);
        currentDesc = local?.description || "";
      }
      let meta = {};
      const match = (currentDesc || "").match(/<!--wg_meta:([\s\S]*?)-->/);
      if (match) {
        try {
          meta = JSON.parse(match[1]);
        } catch (_) {}
      }
      meta.status = updates.status;
      const cleanDesc = (currentDesc || "").replace(/<!--wg_meta:[\s\S]*?-->/, "").trim();
      const newDesc = cleanDesc
        ? `${cleanDesc}\n\n<!--wg_meta:${JSON.stringify(meta)}-->`
        : `<!--wg_meta:${JSON.stringify(meta)}-->`;

      dbPayload.description = newDesc;
      updates.description = newDesc;
    }

    let updatedDbData = null;

    // 1. Try Supabase update
    try {
      const { data, error } = await supabase
        .from("tasks")
        .update(dbPayload)
        .eq("id", taskId)
        .select()
        .single();

      if (!error && data) {
        updatedDbData = data;
      }
    } catch (_) {}

    const fullUpdatedTask = parseIssue({
      ...(updatedDbData || {}),
      ...updates,
      status: updates.status || (updatedDbData?.status || "todo"),
      id: taskId,
      updated_at: new Date().toISOString(),
    });

    // 2. Update cache and localStorage
    clearTasksCache();
    this.updateLocalTask(taskId, fullUpdatedTask);
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("workgrid-task-updated", { detail: fullUpdatedTask })
      );
    }
    return fullUpdatedTask;
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

    clearTasksCache();
    this.deleteLocalTask(taskId);
    return true;
  },

  // ─────────────────────────────────────────────────────────
  // LocalStorage Helpers
  // ─────────────────────────────────────────────────────────
  getLocalTasks(organizationId) {
    if (typeof window === "undefined") return [];
    try {
      const raw =
        localStorage.getItem(LOCAL_STORAGE_KEY) ||
        localStorage.getItem(LEGACY_LOCAL_STORAGE_KEY);
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
