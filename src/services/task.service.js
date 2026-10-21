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
    projectId,
    priority,
    status,
    date,
    search,
    userId,
    userRole = MEMBER_ROLE,
    userName = "",
    userEmail = "",
    force = false,
  }) {
    if (!organizationId) return [];

    const cleanPriority = priority && priority !== "all" ? priority.toLowerCase() : "all";
    const cleanStatus = status && status !== "all" ? status.toLowerCase() : "all";
    const cleanDate = date && date !== "all" ? date : "all";
    const cleanProjectId = projectId && projectId !== "all" ? projectId : "all";
    const cleanSearch = search ? search.trim().toLowerCase() : "";

    const cacheKey = `${organizationId}:${cleanProjectId}:${userId || ""}:${userRole}:${cleanPriority}:${cleanStatus}:${cleanDate}:${cleanSearch}:${userName || ""}:${userEmail || ""}`;

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

    // 1. Try fetching from Supabase tasks table with backend query filters
    try {
      let query = supabase
        .from("tasks")
        .select("*")
        .eq("organization_id", organizationId);

      // Backend project filter
      if (cleanProjectId !== "all") {
        query = query.eq("project_id", cleanProjectId);
      }

      // Backend priority filter (urgent, high, medium, low)
      if (cleanPriority !== "all") {
        query = query.eq("priority", cleanPriority);
      }

      // Backend status filter
      if (cleanStatus !== "all") {
        if (cleanStatus === "backlog") {
          query = query.eq("status", "todo");
        } else {
          query = query.eq("status", cleanStatus);
        }
      }

      // Backend date filter (due_date or created_at)
      if (cleanDate !== "all") {
        if (cleanDate.includes("_") || cleanDate.includes(":") || cleanDate.includes(" to ")) {
          const sep = cleanDate.includes("_") ? "_" : cleanDate.includes(":") ? ":" : " to ";
          const [startStr, endStr] = cleanDate.split(sep);
          const start = `${startStr.trim()}T00:00:00.000Z`;
          const end = `${endStr.trim()}T23:59:59.999Z`;
          query = query.or(`and(due_date.gte.${start},due_date.lte.${end}),and(created_at.gte.${start},created_at.lte.${end})`);
        } else if (cleanDate === "today") {
          const nowStr = new Date().toISOString().split("T")[0];
          const start = `${nowStr}T00:00:00.000Z`;
          const end = `${nowStr}T23:59:59.999Z`;
          query = query.or(`and(due_date.gte.${start},due_date.lte.${end}),and(created_at.gte.${start},created_at.lte.${end})`);
        } else if (cleanDate === "overdue") {
          const nowIso = new Date().toISOString();
          query = query.lt("due_date", nowIso).neq("status", "done");
        } else if (cleanDate === "this_week") {
          const now = new Date();
          const day = now.getDay();
          const diff = now.getDate() - day + (day === 0 ? -6 : 1);
          const mon = new Date(now.setDate(diff)).toISOString().split("T")[0];
          const sun = new Date(now.setDate(diff + 6)).toISOString().split("T")[0];
          const start = `${mon}T00:00:00.000Z`;
          const end = `${sun}T23:59:59.999Z`;
          query = query.or(`and(due_date.gte.${start},due_date.lte.${end}),and(created_at.gte.${start},created_at.lte.${end})`);
        } else {
          // Specific date YYYY-MM-DD
          const start = `${cleanDate}T00:00:00.000Z`;
          const end = `${cleanDate}T23:59:59.999Z`;
          query = query.or(`and(due_date.gte.${start},due_date.lte.${end}),and(created_at.gte.${start},created_at.lte.${end})`);
        }
      }

      // If user is member, filter by assignee_id or created_by
      if (userRole === MEMBER_ROLE && userId) {
        query = query.or(`assignee_id.eq.${userId},created_by.eq.${userId}`);
      }

      let { data, error } = await query.order("created_at", { ascending: false });

      // Fallback: If query with filter returned an error, retry with same filters
      if (error && userRole === MEMBER_ROLE) {
        let retryQuery = supabase
          .from("tasks")
          .select("*")
          .eq("organization_id", organizationId);
        if (cleanProjectId !== "all") retryQuery = retryQuery.eq("project_id", cleanProjectId);
        if (cleanPriority !== "all") retryQuery = retryQuery.eq("priority", cleanPriority);
        if (cleanStatus !== "all") {
          retryQuery = retryQuery.eq("status", cleanStatus === "backlog" ? "todo" : cleanStatus);
        }
        const retry = await retryQuery.order("created_at", { ascending: false });
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

    // Ensure filter criteria are applied consistently to merged tasks
    if (cleanPriority !== "all") {
      allTasks = allTasks.filter(
        (t) => (t.priority || "").toLowerCase() === cleanPriority
      );
    }
    if (cleanStatus !== "all") {
      allTasks = allTasks.filter((t) => t.status === cleanStatus);
    }
    if (cleanProjectId !== "all") {
      allTasks = allTasks.filter(
        (t) => t.project_id === cleanProjectId || t.projectId === cleanProjectId
      );
    }
    if (cleanDate !== "all") {
      allTasks = allTasks.filter((t) => {
        const taskDue = t.due_date || t.dueDate || "";
        const taskCreated = t.created_at || t.createdAt || "";
        const checkMatch = (d, target) => d && String(d).startsWith(target);

        if (cleanDate.includes("_") || cleanDate.includes(":") || cleanDate.includes(" to ")) {
          const sep = cleanDate.includes("_") ? "_" : cleanDate.includes(":") ? ":" : " to ";
          const [startStr, endStr] = cleanDate.split(sep);
          const startD = new Date(`${startStr.trim()}T00:00:00.000Z`);
          const endD = new Date(`${endStr.trim()}T23:59:59.999Z`);
          const dueD = taskDue ? new Date(taskDue) : null;
          const createdD = taskCreated ? new Date(taskCreated) : null;
          const dueInRange = dueD && !isNaN(dueD) && dueD >= startD && dueD <= endD;
          const createdInRange = createdD && !isNaN(createdD) && createdD >= startD && createdD <= endD;
          return dueInRange || createdInRange;
        }
        if (cleanDate === "today") {
          const today = new Date().toISOString().split("T")[0];
          return checkMatch(taskDue, today) || checkMatch(taskCreated, today);
        }
        if (cleanDate === "overdue") {
          if (!taskDue || t.status === "done") return false;
          return new Date(taskDue) < new Date();
        }
        if (cleanDate === "this_week") {
          const d = new Date(taskDue || taskCreated);
          if (isNaN(d.getTime())) return false;
          const now = new Date();
          const day = now.getDay();
          const diff = now.getDate() - day + (day === 0 ? -6 : 1);
          const mon = new Date(now.setDate(diff));
          mon.setHours(0, 0, 0, 0);
          const sun = new Date(mon);
          sun.setDate(mon.getDate() + 6);
          sun.setHours(23, 59, 59, 999);
          return d >= mon && d <= sun;
        }
        return checkMatch(taskDue, cleanDate) || checkMatch(taskCreated, cleanDate);
      });
    }
    if (cleanSearch) {
      allTasks = allTasks.filter((t) => {
        const titleMatch = (t.title || "").toLowerCase().includes(cleanSearch);
        const idMatch = (t.id || "").toLowerCase().includes(cleanSearch);
        const assigneeMatch = (t.assignee || "").toLowerCase().includes(cleanSearch);
        const descMatch = (t.description || "").toLowerCase().includes(cleanSearch);
        return titleMatch || idMatch || assigneeMatch || descMatch;
      });
    }

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
      project_id: finalProjectId || null,
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
   * @param {Object} [context] - { userId, userRole, organizationId }
   * @returns {Promise<Object>}
   */
  async updateTask(taskId, updates, context = {}) {
    if (!taskId) throw new Error("Task ID is required for update");

    const knownColumns = [
      "organization_id",
      "project_id",
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

    // 1. Locate existing task so partial updates (e.g. drag & drop status change) never wipe out existing fields
    const allLocal = this.getLocalTasks();
    let existingTask = allLocal.find((t) => t.id === taskId) || null;

    if (!existingTask) {
      try {
        const { data: dbItem } = await supabase
          .from("tasks")
          .select("*")
          .eq("id", taskId)
          .maybeSingle();
        if (dbItem) {
          existingTask = parseIssue(dbItem);
        }
      } catch (_) {}
    }

    // Resolve project association
    const finalProjectId =
      updates.project_id ||
      updates.projectId ||
      existingTask?.project_id ||
      existingTask?.projectId ||
      null;

    const finalProjectName =
      updates.project_name ||
      updates.projectName ||
      existingTask?.project_name ||
      existingTask?.projectName ||
      "Main Project";

    const finalOrgId =
      updates.organization_id ||
      existingTask?.organization_id ||
      context?.organizationId ||
      null;

    const finalTitle =
      updates.title !== undefined
        ? updates.title
        : (existingTask?.title || "Untitled Issue");

    // 2. Parse and preserve existing description metadata
    let currentDesc =
      typeof updates.description !== "undefined"
        ? updates.description
        : (existingTask?.description || "");

    let meta = {};
    const match = (currentDesc || "").match(/<!--wg_meta:([\s\S]*?)-->/);
    if (match) {
      try {
        meta = JSON.parse(match[1]);
      } catch (_) {}
    }

    // Preserve all metadata fields from existingTask if not already present in meta
    if (existingTask) {
      if (meta.projectId === undefined && existingTask.projectId) meta.projectId = existingTask.projectId;
      if (meta.projectName === undefined && existingTask.projectName) meta.projectName = existingTask.projectName;
      if (meta.storyPoints === undefined && existingTask.storyPoints !== undefined) meta.storyPoints = existingTask.storyPoints;
      if (meta.component === undefined && existingTask.component) meta.component = existingTask.component;
      if (meta.sprint === undefined && existingTask.sprint) meta.sprint = existingTask.sprint;
      if (meta.estimatedHours === undefined && existingTask.estimatedHours) meta.estimatedHours = existingTask.estimatedHours;
      if (meta.isBlocker === undefined && existingTask.isBlocker !== undefined) meta.isBlocker = existingTask.isBlocker;
      if (meta.branchName === undefined && existingTask.branchName) meta.branchName = existingTask.branchName;
      if (meta.environment === undefined && existingTask.environment) meta.environment = existingTask.environment;
      if (meta.acceptanceCriteria === undefined && existingTask.acceptanceCriteria) meta.acceptanceCriteria = existingTask.acceptanceCriteria;
      if (meta.tags === undefined && existingTask.tags) meta.tags = existingTask.tags;
      if (meta.subtasks === undefined && existingTask.subtasks) meta.subtasks = existingTask.subtasks;
      if (meta.links === undefined && existingTask.links) meta.links = existingTask.links;
      if (meta.comments === undefined && existingTask.comments) meta.comments = existingTask.comments;
    }

    // Apply updates to metadata
    if (updates.status) meta.status = updates.status;
    if (finalProjectId) meta.projectId = finalProjectId;
    if (finalProjectName) meta.projectName = finalProjectName;
    if (updates.storyPoints !== undefined) meta.storyPoints = updates.storyPoints;
    if (updates.component !== undefined) meta.component = updates.component;
    if (updates.sprint !== undefined) meta.sprint = updates.sprint;
    if (updates.estimatedHours !== undefined) meta.estimatedHours = updates.estimatedHours;
    if (updates.isBlocker !== undefined) meta.isBlocker = updates.isBlocker;
    if (updates.branchName !== undefined) meta.branchName = updates.branchName;
    if (updates.environment !== undefined) meta.environment = updates.environment;
    if (updates.acceptanceCriteria !== undefined) meta.acceptanceCriteria = updates.acceptanceCriteria;
    if (updates.tags !== undefined) meta.tags = updates.tags;
    if (updates.subtasks !== undefined) meta.subtasks = updates.subtasks;
    if (updates.links !== undefined) meta.links = updates.links;
    if (updates.comments !== undefined) meta.comments = updates.comments;

    const cleanDesc = (currentDesc || "")
      .replace(/<!--wg_meta:[\s\S]*?-->/, "")
      .trim();
    const newDesc = cleanDesc
      ? `${cleanDesc}\n\n<!--wg_meta:${JSON.stringify(meta)}-->`
      : `<!--wg_meta:${JSON.stringify(meta)}-->`;

    // 3. Prepare payload for DB
    const dbPayload = {
      updated_at: new Date().toISOString(),
      description: newDesc,
    };

    if (finalProjectId) {
      dbPayload.project_id = finalProjectId;
    }
    if (finalProjectName) {
      dbPayload.project_name = finalProjectName;
    }

    Object.keys(updates).forEach((k) => {
      if (knownColumns.includes(k) && k !== "description") {
        if (k === "status" && updates[k] === "backlog") {
          dbPayload[k] = "todo";
        } else {
          dbPayload[k] = updates[k];
        }
      }
    });

    if (updates.status && !dbPayload.status) {
      dbPayload.status = updates.status === "backlog" ? "todo" : updates.status;
    }

    let updatedDbData = null;

    // 4. Try Supabase update
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

    // 5. Build full updated task safely merging existingTask, updatedDbData, and updates
    const fullUpdatedTask = parseIssue({
      ...(existingTask || {}),
      ...(updatedDbData || {}),
      ...updates,
      id: taskId,
      title: finalTitle,
      organization_id: finalOrgId,
      project_id: finalProjectId,
      projectId: finalProjectId,
      project_name: finalProjectName,
      projectName: finalProjectName,
      description: newDesc,
      status: updates.status || updatedDbData?.status || existingTask?.status || "todo",
      updated_at: new Date().toISOString(),
    });

    // 6. Update cache and localStorage
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
      if (!organizationId) return parsed;
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
      const exists = list.some((t) => t.id === taskId);
      const updated = exists
        ? list.map((t) => (t.id === taskId ? { ...t, ...updates } : t))
        : [{ ...updates, id: taskId }, ...list];
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
