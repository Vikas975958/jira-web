"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";
import {
  FiArrowLeft,
  FiEdit3,
  FiTrash2,
  FiCopy,
  FiShare2,
  FiCheck,
  FiClock,
  FiUser,
  FiCalendar,
  FiTag,
  FiExternalLink,
  FiCheckSquare,
  FiPlus,
  FiX,
  FiMessageSquare,
  FiLayers,
  FiAlertCircle,
  FiBookmark,
  FiZap,
  FiGitBranch,
  FiFlag,
} from "react-icons/fi";
import { useOrganization } from "@/context/OrganizationContext";
import projectService from "@/services/project.service";
import taskService from "@/services/task.service";
import MarkdownViewer from "@/components/MarkdownViewer";
import DeleteConfirmModal from "@/components/DeleteConfirmModal";
import IssuePageSkeleton from "@/components/IssuePageSkeleton";
import {
  ISSUE_TYPES,
  ISSUE_PRIORITIES,
  ISSUE_STATUSES,
  parseIssue,
  serializeIssue,
  generateBranchName,
} from "@/utils/issueHelper";
import { formatTaskKey, getNameInitials } from "@/utils/commonFunction";
import { MEMBER_ROLE, OWNER_ROLE, MANAGER_ROLE } from "@/utils/constants";

export default function IssueDetailPage() {
  const params = useParams();
  const router = useRouter();
  const issueId = params?.id;

  const authState = useSelector((state) => state.authSlice);
  const user = authState?.userData;

  const { currentOrg, organizations, members = [] } = useOrganization();
  const activeOrg =
    currentOrg?.organizations ||
    currentOrg ||
    organizations?.[0]?.organizations ||
    organizations?.[0];
  const userRole = currentOrg?.role || organizations?.[0]?.role || user?.role || MEMBER_ROLE;
  const isMember = userRole === MEMBER_ROLE;

  const [issue, setIssue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState([]);

  // Subtask adding inline
  const [newSubtaskText, setNewSubtaskText] = useState("");

  // Comment adding
  const [commentText, setCommentText] = useState("");
  const [isPostingComment, setIsPostingComment] = useState(false);

  // External link adding
  const [showAddLink, setShowAddLink] = useState(false);
  const [newLinkTitle, setNewLinkTitle] = useState("");
  const [newLinkUrl, setNewLinkUrl] = useState("");

  // Delete modal
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Load projects and issue data
  const loadData = useCallback(async () => {
    if (!issueId || !activeOrg?.id) return;
    try {
      setLoading(true);

      const [projs, rawTask] = await Promise.all([
        projectService.getProjects({
          organizationId: activeOrg.id,
          userId: user?.id,
          userRole,
        }),
        taskService.getTaskById(issueId, { organizationId: activeOrg.id }),
      ]);

      setProjects(projs || []);

      if (rawTask) {
        setIssue(parseIssue(rawTask));
      } else {
        // Fallback: search in getTasks
        const allTasks = await taskService.getTasks({
          organizationId: activeOrg.id,
          userId: user?.id,
          userRole,
        });
        const found = allTasks.find((t) => t.id === issueId);
        if (found) {
          setIssue(parseIssue(found));
        } else {
          setIssue(null);
        }
      }
    } catch (err) {
      console.error("Failed to load issue:", err);
      toast.error("Failed to load issue details.");
    } finally {
      setLoading(false);
    }
  }, [issueId, activeOrg?.id, user?.id, userRole]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Project object
  const project = useMemo(() => {
    if (!issue) return null;
    return (
      projects.find(
        (p) => p.id === (issue.project_id || issue.projectId) || p.name === issue.project_name
      ) || null
    );
  }, [projects, issue]);

  // Available Assignees
  const availableAssignees = useMemo(() => {
    let list = [];
    if (project) {
      if (project.assignedManagers?.length > 0) {
        project.assignedManagers.forEach((m) => {
          list.push({
            id: m.id || m.userId,
            user_id: m.userId || m.id,
            full_name: m.fullName || m.name || "Manager",
            email: m.email || "",
            role: "manager",
          });
        });
      }
      if (project.assignedMembers?.length > 0) {
        project.assignedMembers.forEach((m) => {
          list.push({
            id: m.id || m.userId,
            user_id: m.userId || m.id,
            full_name: m.fullName || m.name || "Member",
            email: m.email || "",
            role: "member",
          });
        });
      }
    }
    if (list.length === 0) {
      list = [...members];
    }
    return list;
  }, [project, members]);

  // Quick Status Update
  const handleUpdateStatus = async (newStatus) => {
    if (!issue) return;
    try {
      const updatedIssue = { ...issue, status: newStatus };
      setIssue(updatedIssue);
      const serialized = serializeIssue(updatedIssue);
      await taskService.updateTask(issue.id, serialized, {
        userId: user?.id,
        userRole,
      });
      toast.success(`Status updated to "${newStatus}"`);
    } catch (err) {
      toast.error("Failed to update status.");
      loadData();
    }
  };

  // Quick Priority Update
  const handleUpdatePriority = async (newPriority) => {
    if (!issue) return;
    try {
      const updatedIssue = { ...issue, priority: newPriority };
      setIssue(updatedIssue);
      const serialized = serializeIssue(updatedIssue);
      await taskService.updateTask(issue.id, serialized, {
        userId: user?.id,
        userRole,
      });
      toast.success(`Priority updated to "${newPriority}"`);
    } catch (err) {
      toast.error("Failed to update priority.");
      loadData();
    }
  };

  // Quick Assignee Update
  const handleUpdateAssignee = async (targetUserId) => {
    if (!issue) return;
    try {
      let targetName = "Unassigned";
      if (targetUserId) {
        const matched = availableAssignees.find(
          (m) =>
            m.user_id === targetUserId ||
            m.id === targetUserId ||
            m.profiles?.id === targetUserId
        );
        targetName = matched?.full_name || matched?.name || matched?.email || "Team Member";
      }

      const updatedIssue = {
        ...issue,
        assignee_id: targetUserId || null,
        assigneeId: targetUserId || null,
        assignee: targetName,
      };
      setIssue(updatedIssue);
      const serialized = serializeIssue(updatedIssue);
      await taskService.updateTask(issue.id, serialized, {
        userId: user?.id,
        userRole,
      });
      toast.success(`Assignee changed to ${targetName}`);
    } catch (err) {
      toast.error("Failed to update assignee.");
      loadData();
    }
  };

  // Toggle Subtask Completion
  const handleToggleSubtask = async (subtaskId) => {
    if (!issue) return;
    const updatedSubtasks = (issue.subtasks || []).map((s) =>
      s.id === subtaskId ? { ...s, done: !s.done } : s
    );
    const updatedIssue = { ...issue, subtasks: updatedSubtasks };
    setIssue(updatedIssue);

    try {
      const serialized = serializeIssue(updatedIssue);
      await taskService.updateTask(issue.id, serialized, {
        userId: user?.id,
        userRole,
      });
    } catch (err) {
      toast.error("Failed to sync subtask status.");
      loadData();
    }
  };

  // Add Inline Subtask
  const handleAddSubtask = async (e) => {
    if (e) e.preventDefault();
    if (!newSubtaskText.trim() || !issue) return;
    const newSubtask = {
      id: Date.now().toString(),
      text: newSubtaskText.trim(),
      done: false,
    };
    const updatedSubtasks = [...(issue.subtasks || []), newSubtask];
    const updatedIssue = { ...issue, subtasks: updatedSubtasks };
    setIssue(updatedIssue);
    setNewSubtaskText("");

    try {
      const serialized = serializeIssue(updatedIssue);
      await taskService.updateTask(issue.id, serialized, {
        userId: user?.id,
        userRole,
      });
      toast.success("Subtask added");
    } catch (err) {
      toast.error("Failed to save subtask.");
      loadData();
    }
  };

  // Remove Subtask
  const handleRemoveSubtask = async (subtaskId) => {
    if (!issue) return;
    const updatedSubtasks = (issue.subtasks || []).filter((s) => s.id !== subtaskId);
    const updatedIssue = { ...issue, subtasks: updatedSubtasks };
    setIssue(updatedIssue);

    try {
      const serialized = serializeIssue(updatedIssue);
      await taskService.updateTask(issue.id, serialized, {
        userId: user?.id,
        userRole,
      });
    } catch (err) {
      toast.error("Failed to remove subtask.");
      loadData();
    }
  };

  // Post Comment
  const handlePostComment = async (e) => {
    if (e) e.preventDefault();
    if (!commentText.trim() || !issue) return;
    try {
      setIsPostingComment(true);
      const newComment = {
        id: Date.now().toString(),
        userId: user?.id,
        authorName: user?.full_name || user?.name || user?.email || "Team Member",
        authorEmail: user?.email || "",
        text: commentText.trim(),
        createdAt: new Date().toISOString(),
      };

      const updatedComments = [...(issue.comments || []), newComment];
      const updatedIssue = { ...issue, comments: updatedComments };
      setIssue(updatedIssue);
      setCommentText("");

      const serialized = serializeIssue(updatedIssue);
      await taskService.updateTask(issue.id, serialized, {
        userId: user?.id,
        userRole,
      });
      toast.success("Comment added");
    } catch (err) {
      toast.error("Failed to post comment.");
      loadData();
    } finally {
      setIsPostingComment(false);
    }
  };

  // Add External Link
  const handleAddLink = async (e) => {
    if (e) e.preventDefault();
    if (!newLinkUrl.trim() || !issue) return;
    let formattedUrl = newLinkUrl.trim();
    if (!/^https?:\/\//i.test(formattedUrl)) {
      formattedUrl = "https://" + formattedUrl;
    }
    const newLink = {
      id: Date.now().toString(),
      title: newLinkTitle.trim() || formattedUrl,
      url: formattedUrl,
    };

    const updatedLinks = [...(issue.links || []), newLink];
    const updatedIssue = { ...issue, links: updatedLinks };
    setIssue(updatedIssue);
    setNewLinkTitle("");
    setNewLinkUrl("");
    setShowAddLink(false);

    try {
      const serialized = serializeIssue(updatedIssue);
      await taskService.updateTask(issue.id, serialized, {
        userId: user?.id,
        userRole,
      });
      toast.success("Resource link added");
    } catch (err) {
      toast.error("Failed to add link.");
      loadData();
    }
  };

  // Remove External Link
  const handleRemoveLink = async (linkId) => {
    if (!issue) return;
    const updatedLinks = (issue.links || []).filter((l) => l.id !== linkId);
    const updatedIssue = { ...issue, links: updatedLinks };
    setIssue(updatedIssue);

    try {
      const serialized = serializeIssue(updatedIssue);
      await taskService.updateTask(issue.id, serialized, {
        userId: user?.id,
        userRole,
      });
    } catch (err) {
      toast.error("Failed to remove link.");
      loadData();
    }
  };

  // Delete Issue
  const handleConfirmDelete = async () => {
    if (!issue) return;
    try {
      setIsDeleting(true);
      await taskService.deleteTask(issue.id, userRole);
      toast.success("Issue deleted successfully.");
      setIsDeleteModalOpen(false);
      router.push(project ? `/projects?projectId=${project.id}` : "/projects");
    } catch (err) {
      toast.error(err.message || "Failed to delete issue.");
    } finally {
      setIsDeleting(false);
    }
  };

  // Copy Link to Clipboard
  const handleCopyLink = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      toast.info("Issue URL copied to clipboard");
    }
  };

  if (loading) {
    return <IssuePageSkeleton />;
  }

  if (!issue) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center space-y-4">
        <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
          <FiAlertCircle className="w-7 h-7" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-slate-800">Issue Not Found</h2>
          <p className="text-xs text-slate-500 max-w-sm">
            The issue you are looking for does not exist or may have been deleted.
          </p>
        </div>
        <Link
          href="/projects"
          className="px-4 py-2 bg-[#0F766E] text-white text-xs font-bold rounded-lg hover:bg-[#0D655E] transition-colors"
        >
          Back to Projects Board
        </Link>
      </div>
    );
  }

  const issueKey = formatTaskKey(issue, projects, project?.name);
  const typeConfig = ISSUE_TYPES.find((t) => t.id === issue.type) || ISSUE_TYPES[0];
  const priorityConfig =
    ISSUE_PRIORITIES.find((p) => p.id === issue.priority) || ISSUE_PRIORITIES[2];
  const TypeIcon = typeConfig.icon;

  const completedSubtasks = (issue.subtasks || []).filter((s) => s.done).length;
  const totalSubtasks = (issue.subtasks || []).length;
  const subtasksPercent =
    totalSubtasks > 0 ? Math.round((completedSubtasks / totalSubtasks) * 100) : 0;

  return (
    <div className="min-h-screen bg-slate-50/70 pb-20 select-none">
      {/* Top Header & Breadcrumbs Bar */}
      <div className="bg-white/95 backdrop-blur-xs border-b border-slate-200/90 sticky top-0 z-30 px-4 sm:px-6 py-3.5 shadow-2xs">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          {/* Breadcrumbs */}
          <div className="space-y-0.5">
            <div className="flex items-center gap-2 text-xs flex-wrap">
              <Link
                href={project ? `/projects?projectId=${project.id}` : "/projects"}
                className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-900 font-semibold transition-colors"
              >
                <FiArrowLeft className="w-3.5 h-3.5" />
                <span>{project?.name || "Projects Board"}</span>
              </Link>
              <span className="text-slate-300">/</span>
              <span className="font-mono font-bold text-[#0F766E]">{issueKey}</span>
            </div>
            <h1 className="text-base font-bold text-slate-900">Issue Details</h1>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
            <button
              type="button"
              onClick={handleCopyLink}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
              title="Copy issue link"
            >
              <FiCopy className="w-4 h-4" />
            </button>

            <Link
              href={`/issues/${issue.id}/edit`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 rounded-lg shadow-2xs transition-all cursor-pointer"
            >
              <FiEdit3 className="w-3.5 h-3.5 text-slate-500" />
              <span>Edit Issue</span>
            </Link>

            {!isMember && (
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-600 bg-rose-50/70 hover:bg-rose-100/80 border border-rose-200/80 rounded-lg transition-colors cursor-pointer"
              >
                <FiTrash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Issue View Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-3.5">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
          {/* Main Left Details (8 Cols) */}
          <div className="lg:col-span-8 space-y-3.5">
            {/* Header Title & Badges Card */}
            <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs space-y-2.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-teal-50 text-[#0F766E] font-mono font-bold text-xs border border-teal-200/80">
                  {issueKey}
                </span>

                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold border ${typeConfig.color}`}
                >
                  <TypeIcon className="w-3.5 h-3.5" />
                  <span>{typeConfig.label}</span>
                </span>

                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold border ${priorityConfig.badgeClass}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${priorityConfig.dotClass}`} />
                  <span>{priorityConfig.label} Priority</span>
                </span>

                {issue.sprint && (
                  <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                    {issue.sprint}
                  </span>
                )}

                {issue.isBlocker && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                    <FiFlag className="w-3 h-3 text-rose-600" />
                    Blocker
                  </span>
                )}
              </div>

              <h1 className="text-lg sm:text-xl font-bold text-slate-900 leading-snug">
                {issue.title}
              </h1>

              {/* Git Branch Suggestion Toolbar */}
              <div className="flex items-center justify-between gap-2 p-2 bg-slate-50 border border-slate-200/80 rounded-lg text-xs">
                <div className="flex items-center gap-1.5 min-w-0 text-slate-600">
                  <FiGitBranch className="w-3.5 h-3.5 text-[#0F766E] shrink-0" />
                  <span className="text-[11px] font-semibold text-slate-500">Branch:</span>
                  <span className="font-mono text-[11px] text-[#0F766E] truncate">
                    {issue.branchName || generateBranchName(issueKey, issue.title, issue.type)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const branch = issue.branchName || generateBranchName(issueKey, issue.title, issue.type);
                    navigator.clipboard.writeText(`git checkout -b ${branch}`);
                    toast.info(`Copied: git checkout -b ${branch}`);
                  }}
                  className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-800 bg-white border border-slate-200 px-2 py-0.5 rounded shadow-2xs shrink-0 cursor-pointer"
                >
                  <FiCopy className="w-3 h-3" />
                  <span>Copy Git cmd</span>
                </button>
              </div>
            </div>

            {/* Description Section */}
            <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs space-y-2.5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Description
                </h2>
                <Link
                  href={`/issues/${issue.id}/edit`}
                  className="text-xs font-semibold text-[#0F766E] hover:underline flex items-center gap-1"
                >
                  <FiEdit3 className="w-3 h-3" />
                  <span>Edit</span>
                </Link>
              </div>

              <div className="pt-0.5">
                <MarkdownViewer
                  content={issue.cleanDescription || issue.description}
                  className="text-slate-800"
                />
              </div>
            </div>

            {/* Acceptance Criteria & Subtasks Checklist */}
            <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Acceptance Criteria & Subtasks
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    Check off deliverables as they are completed.
                  </p>
                </div>
                {totalSubtasks > 0 && (
                  <div className="text-right">
                    <span className="text-xs font-bold text-[#0F766E]">
                      {subtasksPercent}%
                    </span>
                    <span className="text-[11px] text-slate-400 ml-1">
                      ({completedSubtasks}/{totalSubtasks})
                    </span>
                  </div>
                )}
              </div>

              {/* Progress bar */}
              {totalSubtasks > 0 && (
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#0F766E] transition-all duration-300"
                    style={{ width: `${subtasksPercent}%` }}
                  />
                </div>
              )}

              {/* Subtasks List */}
              <div className="space-y-1.5">
                {(issue.subtasks || []).map((subtask) => (
                  <div
                    key={subtask.id}
                    className="flex items-center justify-between gap-3 p-2.5 bg-slate-50/80 rounded-lg border border-slate-200/80 group hover:bg-slate-100/70 transition-colors"
                  >
                    <label className="flex items-center gap-2.5 min-w-0 cursor-pointer flex-1">
                      <input
                        type="checkbox"
                        checked={subtask.done}
                        onChange={() => handleToggleSubtask(subtask.id)}
                        className="w-4 h-4 rounded text-[#0F766E] focus:ring-[#0F766E] cursor-pointer"
                      />
                      <span
                        className={`text-xs ${
                          subtask.done
                            ? "line-through text-slate-400"
                            : "text-slate-800 font-medium"
                        } break-all`}
                      >
                        {subtask.text}
                      </span>
                    </label>

                    <button
                      type="button"
                      onClick={() => handleRemoveSubtask(subtask.id)}
                      className="text-slate-400 hover:text-rose-600 p-1 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                      title="Remove subtask"
                    >
                      <FiTrash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}

                {totalSubtasks === 0 && (
                  <p className="text-xs text-slate-400 italic py-1">
                    No acceptance criteria added yet.
                  </p>
                )}
              </div>

              {/* Add Subtask Input */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="text"
                  value={newSubtaskText}
                  onChange={(e) => setNewSubtaskText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddSubtask();
                    }
                  }}
                  placeholder="Add a new subtask or test scenario (Press Enter)"
                  className="flex-1 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-[#0F766E] focus:ring-1 focus:ring-[#0F766E] outline-none"
                />
                <button
                  type="button"
                  onClick={handleAddSubtask}
                  disabled={!newSubtaskText.trim()}
                  className="px-3 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-40 rounded-lg transition-colors cursor-pointer shrink-0"
                >
                  + Add
                </button>
              </div>
            </div>

            {/* External Links & Reference Material */}
            <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Attachments & Resources
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    Associated design files, GitHub branches, or specifications.
                  </p>
                </div>
                {!showAddLink && (
                  <button
                    type="button"
                    onClick={() => setShowAddLink(true)}
                    className="text-xs font-semibold text-[#0F766E] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <FiPlus className="w-3 h-3" />
                    <span>Add Link</span>
                  </button>
                )}
              </div>

              {/* Add Link Form */}
              {showAddLink && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2.5 animate-fadeIn">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={newLinkTitle}
                      onChange={(e) => setNewLinkTitle(e.target.value)}
                      placeholder="Title (e.g. Design Specs)"
                      className="px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-md outline-none focus:border-[#0F766E]"
                    />
                    <input
                      type="url"
                      value={newLinkUrl}
                      onChange={(e) => setNewLinkUrl(e.target.value)}
                      placeholder="URL (e.g. https://...)"
                      className="px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-md outline-none focus:border-[#0F766E]"
                    />
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowAddLink(false)}
                      className="px-2.5 py-1 text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleAddLink}
                      disabled={!newLinkUrl.trim()}
                      className="px-3 py-1 text-xs font-semibold bg-[#0F766E] text-white rounded hover:bg-[#0D655E] disabled:opacity-50 cursor-pointer"
                    >
                      Save Link
                    </button>
                  </div>
                </div>
              )}

              {/* Links Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                {(issue.links || []).map((link) => (
                  <div
                    key={link.id}
                    className="p-2.5 bg-slate-50/80 rounded-lg border border-slate-200/90 flex items-center justify-between gap-2 group hover:border-slate-300 transition-all"
                  >
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 min-w-0 flex-1 hover:text-[#0F766E]"
                    >
                      <FiExternalLink className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="text-xs font-semibold text-slate-800 truncate">
                        {link.title}
                      </span>
                    </a>
                    <button
                      type="button"
                      onClick={() => handleRemoveLink(link.id)}
                      className="text-slate-400 hover:text-rose-600 p-0.5 rounded cursor-pointer"
                    >
                      <FiX className="w-3 h-3" />
                    </button>
                  </div>
                ))}

                {(issue.links || []).length === 0 && !showAddLink && (
                  <p className="text-xs text-slate-400 italic py-1 col-span-2">
                    No resources linked yet.
                  </p>
                )}
              </div>
            </div>

            {/* Activity & Comments Section */}
            <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                <FiMessageSquare className="w-4 h-4 text-slate-500" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Activity & Discussion
                </h2>
                <span className="text-xs text-slate-400">
                  ({(issue.comments || []).length})
                </span>
              </div>

              {/* Add Comment Input */}
              <div className="space-y-2">
                <textarea
                  rows={3}
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Share an update, attach findings, or mention blockers..."
                  className="w-full px-3 py-2 text-xs text-slate-800 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-[#0F766E] outline-none"
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handlePostComment}
                    disabled={isPostingComment || !commentText.trim()}
                    className="px-3.5 py-1.5 text-xs font-bold text-white bg-[#0F766E] hover:bg-[#0D655E] disabled:opacity-50 rounded-lg transition-colors cursor-pointer"
                  >
                    {isPostingComment ? "Posting..." : "Comment"}
                  </button>
                </div>
              </div>

              {/* Comments List */}
              <div className="space-y-3 pt-2">
                {(issue.comments || []).map((comment) => (
                  <div
                    key={comment.id}
                    className="p-3 bg-slate-50/70 rounded-lg border border-slate-100 space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-[#0F766E] text-white flex items-center justify-center text-[10px] font-bold">
                          {(comment.authorName || "U").charAt(0).toUpperCase()}
                        </div>
                        <span className="font-semibold text-slate-900">
                          {comment.authorName}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400">
                        {comment.createdAt ? new Date(comment.createdAt).toLocaleString() : ""}
                      </span>
                    </div>
                    <p className="text-xs text-slate-700 whitespace-pre-wrap pl-7">
                      {comment.text}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Sidebar Metadata (4 Cols) - Tight spacing */}
          <div className="lg:col-span-4 space-y-3.5">
            {/* Status & Priority Card */}
            <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600 block border-b border-slate-100 pb-1.5">
                Status & Priority
              </span>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Status
                  </label>
                  <select
                    value={issue.status || "todo"}
                    onChange={(e) => handleUpdateStatus(e.target.value)}
                    className="w-full px-2 py-1.5 text-xs font-bold text-slate-800 bg-white border border-slate-300 rounded-lg focus:border-[#0F766E] outline-none cursor-pointer"
                  >
                    {ISSUE_STATUSES.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Priority
                  </label>
                  <select
                    value={issue.priority || "medium"}
                    onChange={(e) => handleUpdatePriority(e.target.value)}
                    className="w-full px-2 py-1.5 text-xs font-bold text-slate-800 bg-white border border-slate-300 rounded-lg focus:border-[#0F766E] outline-none cursor-pointer"
                  >
                    {ISSUE_PRIORITIES.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* People & Assignments */}
            <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  People
                </span>
                {user && (
                  <button
                    type="button"
                    onClick={() => handleUpdateAssignee(user.id)}
                    className="text-[10px] font-semibold text-[#0F766E] hover:underline cursor-pointer"
                  >
                    Assign to me
                  </button>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Assignee
                </label>
                <select
                  value={issue.assignee_id || issue.assigneeId || ""}
                  onChange={(e) => handleUpdateAssignee(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg focus:border-[#0F766E] outline-none cursor-pointer"
                >
                  <option value="">Unassigned</option>
                  {availableAssignees.map((m) => {
                    const uId = m.user_id || m.id || m.profiles?.id;
                    const name =
                      m.full_name || m.name || m.profiles?.full_name || m.email || "Member";
                    const isMe = user?.id && uId === user.id;
                    return (
                      <option key={uId || m.email} value={uId}>
                        {name} {isMe ? "(You)" : ""} - {m.role || "Member"}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Reporter
                </label>
                <div className="flex items-center gap-2 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                  <div className="w-4.5 h-4.5 rounded-full bg-slate-300 text-slate-700 flex items-center justify-center text-[10px] font-bold">
                    {(user?.full_name || user?.name || user?.email || "U").charAt(0).toUpperCase()}
                  </div>
                  <span className="font-semibold text-slate-800 truncate">
                    {user?.full_name || user?.name || user?.email || "Creator"}
                  </span>
                </div>
              </div>
            </div>

            {/* Estimation & Context Details */}
            <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs space-y-2.5">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600 block border-b border-slate-100 pb-1.5">
                Estimates & Attributes
              </span>

              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 font-semibold">Story Points:</span>
                <span className="font-bold px-2 py-0.5 rounded bg-teal-50 text-[#0F766E] border border-teal-200/60 font-mono">
                  {issue.storyPoints || 1} pts
                </span>
              </div>

              {issue.estimatedHours && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-semibold">Est. Time:</span>
                  <span className="font-semibold text-slate-800 font-mono">
                    {issue.estimatedHours}
                  </span>
                </div>
              )}

              {issue.sprint && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-semibold">Sprint:</span>
                  <span className="font-semibold text-slate-800">{issue.sprint}</span>
                </div>
              )}

              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 font-semibold">Component:</span>
                <span className="font-semibold text-slate-800">
                  {issue.component || "Frontend"}
                </span>
              </div>

              {issue.due_date || issue.dueDate ? (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-semibold">Due Date:</span>
                  <span className="font-semibold text-slate-800">
                    {new Date(issue.due_date || issue.dueDate).toLocaleDateString()}
                  </span>
                </div>
              ) : null}

              {issue.environment && (
                <div className="text-xs space-y-1 pt-1 border-t border-slate-100">
                  <span className="text-slate-500 font-semibold">Environment:</span>
                  <p className="text-[11px] font-mono text-slate-700 bg-slate-50 p-1.5 rounded border border-slate-200 break-all">
                    {issue.environment}
                  </p>
                </div>
              )}
            </div>

            {/* Tags & Labels */}
            {(issue.tags || []).length > 0 && (
              <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs space-y-2.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                  Labels & Tags
                </label>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {issue.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2.5 py-0.5 rounded-md bg-teal-50 text-[#0F766E] border border-teal-200/70 text-xs font-semibold"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Timestamps */}
            <div className="p-4 bg-slate-100/60 rounded-xl border border-slate-200/80 text-[11px] text-slate-500 space-y-1.5">
              <div className="flex justify-between">
                <span>Created:</span>
                <span className="font-medium text-slate-700">
                  {issue.created_at ? new Date(issue.created_at).toLocaleDateString() : "Recently"}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Last Updated:</span>
                <span className="font-medium text-slate-700">
                  {issue.updated_at ? new Date(issue.updated_at).toLocaleDateString() : "Recently"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
        isLoading={isDeleting}
        title="Delete Issue"
        subtitle={`Are you sure you want to delete ${issueKey}?`}
        message="This action will permanently delete this issue and all its checklist subtasks and comments from the workspace."
        confirmButtonText="Delete Issue"
      />
    </div>
  );
}
