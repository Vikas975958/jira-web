export const getNameInitials = (name) => {
  if (!name || typeof name !== "string") return "";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

/**
 * Formats a task/ticket display key using the project name instead of a hardcoded "JIRA" prefix.
 * e.g., if task.id is "JIRA-bb78aae4" and project name is "Adlavage", returns "ADLAVAGE-bb78aae4".
 *
 * @param {Object|string} task - The task object or task ID string
 * @param {Array<Object>} [projects] - Optional list of projects to resolve project name
 * @param {string} [fallbackProjectName] - Optional project name if already known
 * @returns {string} The formatted ticket key
 */
export const formatTaskKey = (task, projects = [], fallbackProjectName = "") => {
  if (!task) return "";

  const rawId = typeof task === "object" ? String(task.id || "") : String(task);

  // Extract clean suffix (strip any existing JIRA- or jira- prefix, or take last part of uuid)
  let suffix = rawId;
  if (rawId.toLowerCase().startsWith("jira-")) {
    suffix = rawId.substring(5);
  } else if (rawId.includes("-")) {
    const parts = rawId.split("-");
    suffix = parts[parts.length - 1];
  } else if (rawId.length > 8) {
    suffix = rawId.slice(0, 8);
  }

  // Resolve project name
  let projName = "";
  if (typeof task === "object") {
    projName = task.project_name || task.projectName || "";
    if (!projName && (task.project_id || task.projectId) && Array.isArray(projects)) {
      const pId = task.project_id || task.projectId;
      const matched = projects.find((p) => p.id === pId);
      if (matched?.name) {
        projName = matched.name;
      }
    }
  }

  if (!projName && fallbackProjectName) {
    projName = fallbackProjectName;
  }

  // Generate prefix from project name
  let prefix = "";
  if (projName) {
    const words = projName.trim().split(/\s+/).filter(Boolean);
    prefix = words[0]?.toUpperCase().replace(/[^A-Z0-9]/g, "") || "";
  }

  if (!prefix) {
    prefix = "TASK";
  }

  return `${prefix}-${suffix}`;
};
