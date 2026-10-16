import React from "react";
import {
  FiBookmark,
  FiCheckSquare,
  FiAlertCircle,
  FiLayers,
  FiZap,
} from "react-icons/fi";

export const ISSUE_TYPES = [
  {
    id: "story",
    label: "Story",
    description: "User functionality and requirement",
    icon: FiBookmark,
    color: "bg-emerald-50 text-emerald-700 border-emerald-200",
    iconColor: "text-emerald-600",
  },
  {
    id: "task",
    label: "Task",
    description: "Work item or operational task",
    icon: FiCheckSquare,
    color: "bg-blue-50 text-blue-700 border-blue-200",
    iconColor: "text-blue-600",
  },
  {
    id: "bug",
    label: "Bug",
    description: "Problem or defect impairs product",
    icon: FiAlertCircle,
    color: "bg-rose-50 text-rose-700 border-rose-200",
    iconColor: "text-rose-600",
  },
  {
    id: "epic",
    label: "Epic",
    description: "Large collection of related stories",
    icon: FiLayers,
    color: "bg-purple-50 text-purple-700 border-purple-200",
    iconColor: "text-purple-600",
  },
  {
    id: "improvement",
    label: "Improvement",
    description: "Enhancement of existing feature",
    icon: FiZap,
    color: "bg-amber-50 text-amber-700 border-amber-200",
    iconColor: "text-amber-600",
  },
];

export const ISSUE_PRIORITIES = [
  {
    id: "urgent",
    label: "Urgent",
    badgeClass: "bg-red-50 text-red-700 border-red-200",
    dotClass: "bg-red-600",
  },
  {
    id: "high",
    label: "High",
    badgeClass: "bg-orange-50 text-orange-700 border-orange-200",
    dotClass: "bg-orange-600",
  },
  {
    id: "medium",
    label: "Medium",
    badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
    dotClass: "bg-amber-500",
  },
  {
    id: "low",
    label: "Low",
    badgeClass: "bg-blue-50 text-blue-700 border-blue-200",
    dotClass: "bg-blue-500",
  },
];

export const ISSUE_STATUSES = [
  { id: "backlog", label: "Backlog", bgClass: "bg-slate-100 text-slate-700" },
  { id: "todo", label: "To Do", bgClass: "bg-blue-50 text-blue-700" },
  { id: "in-progress", label: "In Progress", bgClass: "bg-amber-50 text-amber-700" },
  { id: "review", label: "In Review", bgClass: "bg-purple-50 text-purple-700" },
  { id: "done", label: "Done", bgClass: "bg-emerald-50 text-emerald-700" },
];

export const COMMON_COMPONENTS = [
  "Frontend",
  "Backend",
  "UI/UX Design",
  "API & Integration",
  "Authentication",
  "Database",
  "DevOps / CI-CD",
  "Mobile App",
  "Documentation",
  "General",
];

export const COMMON_SPRINTS = [
  "Sprint 1 (Active)",
  "Sprint 2 (Upcoming)",
  "Sprint 3 (Planning)",
  "Product Backlog",
];

const META_TAG_REGEX = /<!--wg_meta:([\s\S]*?)-->/;

/**
 * Generates a standard developer Git branch name from issue key and title
 */
export function generateBranchName(issueKey = "", title = "", type = "task") {
  const prefix = type === "bug" ? "fix" : type === "story" ? "feature" : "task";
  const slug = (title || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 32);
  const cleanKey = (issueKey || "").toLowerCase();
  return cleanKey ? `${prefix}/${cleanKey}-${slug}` : `${prefix}/${slug || "issue"}`;
}

/**
 * Parses raw task data to extract clean description and structured metadata.
 */
export function parseIssue(task) {
  if (!task) return null;

  const rawDescription = task.description || "";
  let cleanDescription = rawDescription;
  let metadata = {};

  const match = rawDescription.match(META_TAG_REGEX);
  if (match) {
    try {
      metadata = JSON.parse(match[1]);
      cleanDescription = rawDescription.replace(META_TAG_REGEX, "").trim();
    } catch (_) {
      // Ignored if JSON parsing fails
    }
  }

  const projectId = metadata.projectId || task.project_id || task.projectId || null;
  const projectName = metadata.projectName || task.project_name || task.projectName || "Main Project";

  // Status resolution:
  // If task status is 'backlog' or metadata status is 'backlog', preserve backlog
  // (since Supabase check constraint only allows 'todo', 'in-progress', 'review', 'done',
  // backlog tasks are persisted as 'todo' in the DB column with 'backlog' in metadata)
  let status = task.status || metadata.status || "todo";
  if (task.status === "backlog") {
    status = "backlog";
  } else if (task.status === "todo" && metadata.status === "backlog") {
    status = "backlog";
  } else if (task.status) {
    status = task.status;
  }

  return {
    ...task,
    projectId,
    project_id: projectId,
    projectName,
    project_name: projectName,
    status,
    cleanDescription:
      cleanDescription || (typeof task.cleanDescription === "string" ? task.cleanDescription : ""),
    storyPoints: Number(metadata.storyPoints ?? task.storyPoints ?? task.story_points ?? 1),
    component: metadata.component || task.component || "Frontend",
    sprint: metadata.sprint || task.sprint || "Sprint 1 (Active)",
    estimatedHours: metadata.estimatedHours || task.estimatedHours || "",
    isBlocker: Boolean(metadata.isBlocker ?? task.isBlocker ?? false),
    branchName: metadata.branchName || task.branchName || "",
    environment: metadata.environment || task.environment || "",
    acceptanceCriteria: metadata.acceptanceCriteria || task.acceptanceCriteria || "",
    tags: Array.isArray(metadata.tags)
      ? metadata.tags
      : Array.isArray(task.tags)
      ? task.tags
      : [],
    subtasks: Array.isArray(metadata.subtasks)
      ? metadata.subtasks
      : Array.isArray(task.subtasks)
      ? task.subtasks
      : [],
    links: Array.isArray(metadata.links)
      ? metadata.links
      : Array.isArray(task.links)
      ? task.links
      : [],
    comments: Array.isArray(metadata.comments)
      ? metadata.comments
      : Array.isArray(task.comments)
      ? task.comments
      : [],
  };
}

/**
 * Serializes issue form data, bundling extra metadata safely into description string.
 */
export function serializeIssue(formData) {
  const metadata = {
    projectId: formData.projectId || formData.project_id || null,
    projectName: formData.projectName || formData.project_name || "Main Project",
    status: formData.status || "todo",
    storyPoints: Number(formData.storyPoints) || 1,
    component: formData.component || "Frontend",
    sprint: formData.sprint || "Sprint 1 (Active)",
    estimatedHours: formData.estimatedHours || "",
    isBlocker: Boolean(formData.isBlocker),
    branchName: formData.branchName || "",
    environment: formData.environment || "",
    acceptanceCriteria: formData.acceptanceCriteria || "",
    tags: formData.tags || [],
    subtasks: formData.subtasks || [],
    links: formData.links || [],
    comments: formData.comments || [],
  };

  const cleanDesc = (formData.cleanDescription ?? formData.description ?? "").trim();
  const serializedMeta = `<!--wg_meta:${JSON.stringify(metadata)}-->`;
  const fullDescription = cleanDesc ? `${cleanDesc}\n\n${serializedMeta}` : serializedMeta;

  return {
    ...formData,
    description: fullDescription,
    cleanDescription: cleanDesc,
    projectId: metadata.projectId,
    project_id: metadata.projectId,
    projectName: metadata.projectName,
    project_name: metadata.projectName,
    status: formData.status || "todo",
    storyPoints: metadata.storyPoints,
    component: metadata.component,
    sprint: metadata.sprint,
    estimatedHours: metadata.estimatedHours,
    isBlocker: metadata.isBlocker,
    branchName: metadata.branchName,
    environment: metadata.environment,
    acceptanceCriteria: metadata.acceptanceCriteria,
    tags: metadata.tags,
    subtasks: metadata.subtasks,
    links: metadata.links,
    comments: metadata.comments,
  };
}

