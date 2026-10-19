/**
 * Utility functions for managing user's pinned projects per organization.
 * Pinned projects determine which projects are prominently displayed in the sidebar navigation.
 */

export const getPinnedStorageKey = (organizationId, userId) => {
  const org = organizationId || "default";
  const user = userId || "global";
  return `workgrid_pinned_projects_${org}_${user}`;
};

/**
 * Get all pinned project IDs for a given organization and user.
 * @param {string} organizationId
 * @param {string} userId
 * @returns {string[]} Array of project IDs
 */
export const getPinnedProjectIds = (organizationId, userId) => {
  if (typeof window === "undefined") return [];
  try {
    const key = getPinnedStorageKey(organizationId, userId);
    const raw = localStorage.getItem(key);
    if (!raw) {
      // Check legacy/fallback key without userId
      if (organizationId) {
        const fallbackKey = `workgrid_pinned_projects_${organizationId}`;
        const fallbackRaw = localStorage.getItem(fallbackKey);
        if (fallbackRaw) {
          const parsed = JSON.parse(fallbackRaw);
          if (Array.isArray(parsed)) return parsed;
        }
      }
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error("Error reading pinned projects from localStorage:", err);
    return [];
  }
};

/**
 * Set pinned project IDs and broadcast an update event.
 * @param {string} organizationId
 * @param {string} userId
 * @param {string[]} projectIds
 */
export const setPinnedProjectIds = (organizationId, userId, projectIds) => {
  if (typeof window === "undefined") return;
  try {
    const key = getPinnedStorageKey(organizationId, userId);
    const uniqueIds = Array.from(new Set((projectIds || []).filter(Boolean)));
    localStorage.setItem(key, JSON.stringify(uniqueIds));

    // Dispatch custom event for real-time synchronization across components
    window.dispatchEvent(
      new CustomEvent("project-pinned-updated", {
        detail: {
          organizationId,
          userId,
          pinnedIds: uniqueIds,
        },
      })
    );
  } catch (err) {
    console.error("Error saving pinned projects to localStorage:", err);
  }
};

/**
 * Check if a project is currently pinned.
 * @param {string} organizationId
 * @param {string} userId
 * @param {string} projectId
 * @returns {boolean}
 */
export const isProjectPinned = (organizationId, userId, projectId) => {
  if (!projectId) return false;
  const ids = getPinnedProjectIds(organizationId, userId);
  return ids.includes(projectId);
};

/**
 * Pin a project.
 * @param {string} organizationId
 * @param {string} userId
 * @param {string} projectId
 */
export const pinProject = (organizationId, userId, projectId) => {
  if (!projectId) return;
  const current = getPinnedProjectIds(organizationId, userId);
  if (!current.includes(projectId)) {
    const next = [projectId, ...current];
    setPinnedProjectIds(organizationId, userId, next);
  }
};

/**
 * Unpin a project.
 * @param {string} organizationId
 * @param {string} userId
 * @param {string} projectId
 */
export const unpinProject = (organizationId, userId, projectId) => {
  if (!projectId) return;
  const current = getPinnedProjectIds(organizationId, userId);
  const next = current.filter((id) => id !== projectId);
  setPinnedProjectIds(organizationId, userId, next);
};

/**
 * Toggle pin status of a project.
 * @param {string} organizationId
 * @param {string} userId
 * @param {string} projectId
 * @returns {boolean} New pinned state (true if now pinned, false if unpinned)
 */
export const togglePinProject = (organizationId, userId, projectId) => {
  if (!projectId) return false;
  const current = getPinnedProjectIds(organizationId, userId);
  const isPinned = current.includes(projectId);
  if (isPinned) {
    unpinProject(organizationId, userId, projectId);
    return false;
  } else {
    pinProject(organizationId, userId, projectId);
    return true;
  }
};
