"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";
import { Select, DatePicker } from "antd";
import dayjs from "dayjs";
import {
  FiArrowLeft,
  FiSave,
  FiX,
  FiCheck,
  FiLink,
  FiExternalLink,
  FiTag,
  FiTrash2,
  FiEye,
  FiEdit3,
  FiCode,
  FiList,
  FiType,
  FiPlus,
  FiGitBranch,
  FiCopy,
  FiClock,
  FiFlag,
} from "react-icons/fi";
import { useOrganization } from "@/context/OrganizationContext";
import projectService from "@/services/project.service";
import taskService from "@/services/task.service";
import MarkdownViewer from "@/components/MarkdownViewer";
import IssuePageSkeleton from "@/components/IssuePageSkeleton";
import {
  ISSUE_TYPES,
  ISSUE_PRIORITIES,
  ISSUE_STATUSES,
  COMMON_COMPONENTS,
  COMMON_SPRINTS,
  parseIssue,
  serializeIssue,
  generateBranchName,
} from "@/utils/issueHelper";
import { formatTaskKey } from "@/utils/commonFunction";
import { MEMBER_ROLE } from "@/utils/constants";

export default function IssueEditPage() {
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
  const userRole =
    currentOrg?.role || organizations?.[0]?.role || user?.role || MEMBER_ROLE;

  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [projects, setProjects] = useState([]);
  const [originalIssue, setOriginalIssue] = useState(null);

  // Form State
  const [projectId, setProjectId] = useState("");
  const [type, setType] = useState("story");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [descTab, setDescTab] = useState("write");
  const [status, setStatus] = useState("todo");
  const [priority, setPriority] = useState("medium");
  const [storyPoints, setStoryPoints] = useState(3);
  const [estimatedHours, setEstimatedHours] = useState("");
  const [sprint, setSprint] = useState("Sprint 1 (Active)");
  const [isBlocker, setIsBlocker] = useState(false);
  const [assigneeId, setAssigneeId] = useState("");
  const [assigneeName, setAssigneeName] = useState("");
  const [component, setComponent] = useState("Frontend");
  const [environment, setEnvironment] = useState("");
  const [dueDate, setDueDate] = useState("");

  // Subtasks
  const [subtasks, setSubtasks] = useState([]);
  const [newSubtaskText, setNewSubtaskText] = useState("");

  // Tags
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState("");

  // Links
  const [links, setLinks] = useState([]);
  const [linkTitle, setLinkTitle] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [showAddLink, setShowAddLink] = useState(false);

  // Load Existing Data
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

      let taskData = rawTask;
      if (!taskData) {
        const allTasks = await taskService.getTasks({
          organizationId: activeOrg.id,
          userId: user?.id,
          userRole,
        });
        taskData = allTasks.find((t) => t.id === issueId);
      }

      if (taskData) {
        const parsed = parseIssue(taskData);
        setOriginalIssue(parsed);
        setTitle(parsed.title || "");
        setDescription(parsed.cleanDescription || parsed.description || "");
        setType(parsed.type || "story");
        setStatus(parsed.status || "todo");
        setPriority(parsed.priority || "medium");
        setStoryPoints(parsed.storyPoints || 1);
        setEstimatedHours(parsed.estimatedHours || "");
        setSprint(parsed.sprint || "Sprint 1 (Active)");
        setIsBlocker(Boolean(parsed.isBlocker));
        setAssigneeId(parsed.assignee_id || parsed.assigneeId || "");
        setAssigneeName(parsed.assignee || "Unassigned");
        setComponent(parsed.component || "Frontend");
        setEnvironment(parsed.environment || "");
        setProjectId(
          parsed.project_id || parsed.projectId || projs?.[0]?.id || "",
        );
        setSubtasks(parsed.subtasks || []);
        setTags(parsed.tags || []);
        setLinks(parsed.links || []);

        if (parsed.due_date || parsed.dueDate) {
          const d = new Date(parsed.due_date || parsed.dueDate);
          if (!isNaN(d.getTime())) {
            setDueDate(d.toISOString().split("T")[0]);
          }
        }
      }
    } catch (err) {
      console.error("Failed to load issue for editing:", err);
      toast.error("Failed to load issue details.");
    } finally {
      setLoading(false);
    }
  }, [issueId, activeOrg?.id, user?.id, userRole]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const chosenProject = useMemo(() => {
    return projects.find((p) => p.id === projectId) || null;
  }, [projects, projectId]);

  const issueKey = formatTaskKey(originalIssue, projects, chosenProject?.name);

  const suggestedBranch = useMemo(() => {
    return generateBranchName(issueKey, title, type);
  }, [issueKey, title, type]);

  const copyBranchCommand = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(`git checkout -b ${suggestedBranch}`);
      toast.info(`Copied: git checkout -b ${suggestedBranch}`);
    }
  };

  // Available Assignees
  const availableAssignees = useMemo(() => {
    let list = [];
    if (chosenProject) {
      if (chosenProject.assignedManagers?.length > 0) {
        chosenProject.assignedManagers.forEach((m) => {
          list.push({
            id: m.id || m.userId,
            user_id: m.userId || m.id,
            full_name: m.fullName || m.name || "Manager",
            email: m.email || "",
            role: "manager",
          });
        });
      }
      if (chosenProject.assignedMembers?.length > 0) {
        chosenProject.assignedMembers.forEach((m) => {
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
  }, [chosenProject, members]);

  // Subtask Handlers
  const handleAddSubtask = (e) => {
    if (e) e.preventDefault();
    if (!newSubtaskText.trim()) return;
    setSubtasks((prev) => [
      ...prev,
      { id: Date.now().toString(), text: newSubtaskText.trim(), done: false },
    ]);
    setNewSubtaskText("");
  };

  const handleToggleSubtask = (id) => {
    setSubtasks((prev) =>
      prev.map((s) => (s.id === id ? { ...s, done: !s.done } : s)),
    );
  };

  const handleRemoveSubtask = (id) => {
    setSubtasks((prev) => prev.filter((s) => s.id !== id));
  };

  // Tag Handlers
  const handleAddTag = (e) => {
    if (e && e.key === "Enter") {
      e.preventDefault();
      const clean = tagInput.trim().replace(/^#/, "");
      if (clean && !tags.includes(clean)) {
        setTags((prev) => [...prev, clean]);
      }
      setTagInput("");
    }
  };

  const handleRemoveTag = (tagToRemove) => {
    setTags((prev) => prev.filter((t) => t !== tagToRemove));
  };

  // Link Handlers
  const handleAddLink = (e) => {
    if (e) e.preventDefault();
    if (!linkUrl.trim()) return;
    let url = linkUrl.trim();
    if (!/^https?:\/\//i.test(url)) url = "https://" + url;
    setLinks((prev) => [
      ...prev,
      { id: Date.now().toString(), title: linkTitle.trim() || url, url },
    ]);
    setLinkTitle("");
    setLinkUrl("");
    setShowAddLink(false);
  };

  const handleRemoveLink = (id) => {
    setLinks((prev) => prev.filter((l) => l.id !== id));
  };

  const insertMarkdown = (prefix, suffix = "") => {
    setDescription((prev) => `${prev}${prefix}${suffix}`);
  };

  // Save changes
  const handleSave = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Issue title is required.");
      return;
    }

    try {
      setIsSaving(true);

      const serialized = serializeIssue({
        ...originalIssue,
        title: title.trim(),
        cleanDescription: description.trim(),
        type,
        status,
        priority,
        storyPoints: Number(storyPoints) || 1,
        estimatedHours,
        sprint,
        isBlocker,
        branchName: suggestedBranch,
        assignee: assigneeName || "Unassigned",
        assigneeId: assigneeId || null,
        assignee_id: assigneeId || null,
        projectId: projectId || null,
        project_id: projectId || null,
        projectName:
          chosenProject?.name || originalIssue?.project_name || "Main Project",
        project_name:
          chosenProject?.name || originalIssue?.project_name || "Main Project",
        dueDate: dueDate || null,
        due_date: dueDate || null,
        component,
        environment,
        tags,
        subtasks,
        links,
      });

      await taskService.updateTask(issueId, serialized, {
        userId: user?.id,
        userRole,
      });

      toast.success("Issue updated successfully!");
      router.push(`/issues/${issueId}`);
    } catch (err) {
      console.error("Failed to update issue:", err);
      toast.error("Failed to save changes.");
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return <IssuePageSkeleton />;
  }

  return (
    <div className="min-h-screen bg-slate-50/70 pb-16 select-none">
      {/* Top Breadcrumb & Save Bar */}
      <div className="bg-white/95 backdrop-blur-xs border-b border-slate-200/90 sticky top-0 z-30 px-4 sm:px-6 py-2.5 shadow-2xs">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5 text-xs">
              <Link
                href={`/issues/${issueId}`}
                className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-900 font-semibold transition-colors"
              >
                <FiArrowLeft className="w-3.5 h-3.5" />
                <span className="font-mono font-bold text-[#0F766E]">
                  {issueKey}
                </span>
              </Link>
              <span className="text-slate-300">/</span>
              <span className="text-slate-600 font-medium truncate max-w-[160px]">
                {chosenProject?.name || "Project"}
              </span>
              <span className="text-slate-300">/</span>
              <span className="text-slate-900 font-bold">Edit Details</span>
            </div>
            <h1 className="text-sm sm:text-base font-bold text-slate-900">
              Edit Issue Details
            </h1>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              onClick={() => router.push(`/issues/${issueId}`)}
              className="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || !title.trim()}
              className="px-3.5 py-1.5 text-xs font-bold text-white bg-[#0F766E] hover:bg-[#0D655E] disabled:opacity-50 rounded-lg shadow-sm shadow-teal-900/10 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              {isSaving ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <FiSave className="w-3.5 h-3.5" />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Main Edit Form - Compact Spacing */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-3.5">
        <form
          onSubmit={handleSave}
          className="grid grid-cols-1 lg:grid-cols-12 gap-3.5"
        >
          {/* Main Area (8 Cols) */}
          <div className="lg:col-span-8 space-y-3.5">
            {/* Title & Type */}
            <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs space-y-3">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Summary / Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-semibold text-slate-900 bg-white border border-slate-200 rounded-lg focus:border-[#0F766E] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Issue Type
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                  {ISSUE_TYPES.map((t) => {
                    const Icon = t.icon;
                    const isSelected = type === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setType(t.id)}
                        className={`py-1.5 px-2 rounded-lg border text-left flex items-center gap-1.5 transition-all cursor-pointer ${
                          isSelected
                            ? "bg-[#0F766E] text-white border-[#0F766E] shadow-sm shadow-teal-900/15"
                            : "bg-slate-50 text-slate-700 border-slate-200 hover:border-teal-300 hover:bg-teal-50/30"
                        }`}
                      >
                        <div
                          className={`w-5 h-5 rounded flex items-center justify-center shrink-0 ${
                            isSelected ? "bg-white/20 text-white" : t.color
                          }`}
                        >
                          <Icon className="w-3 h-3" />
                        </div>
                        <span className="text-xs font-semibold truncate">
                          {t.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Developer Git branch suggestion */}
              <div className="flex items-center justify-between gap-2 p-2 bg-slate-50 border border-slate-200/80 rounded-lg text-xs">
                <div className="flex items-center gap-1.5 min-w-0 text-slate-600">
                  <FiGitBranch className="w-3.5 h-3.5 text-[#0F766E] shrink-0" />
                  <span className="text-[11px] font-semibold text-slate-500">
                    Branch:
                  </span>
                  <span className="font-mono text-[11px] text-[#0F766E] truncate">
                    {suggestedBranch}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={copyBranchCommand}
                  className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-800 bg-white border border-slate-200 px-2 py-0.5 rounded shadow-2xs shrink-0 cursor-pointer"
                >
                  <FiCopy className="w-3 h-3" />
                  <span>Copy Git cmd</span>
                </button>
              </div>
            </div>

            {/* Description Editor */}
            <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs space-y-2">
              <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Description (Markdown)
                </label>
                <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-xs">
                  <button
                    type="button"
                    onClick={() => setDescTab("write")}
                    className={`px-2 py-0.5 rounded font-semibold transition-colors cursor-pointer flex items-center gap-1 ${
                      descTab === "write"
                        ? "bg-white text-[#0F766E] shadow-2xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <FiEdit3 className="w-3 h-3" />
                    <span>Write</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDescTab("preview")}
                    className={`px-2 py-0.5 rounded font-semibold transition-colors cursor-pointer flex items-center gap-1 ${
                      descTab === "preview"
                        ? "bg-white text-[#0F766E] shadow-2xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <FiEye className="w-3 h-3" />
                    <span>Preview</span>
                  </button>
                </div>
              </div>

              {descTab === "write" ? (
                <>
                  <div className="flex items-center gap-1 text-slate-500 border border-slate-200 bg-slate-50/70 p-1 rounded-t-lg text-xs">
                    <button
                      type="button"
                      onClick={() => insertMarkdown("**", "**")}
                      className="p-1 rounded hover:bg-slate-200 font-bold px-1.5"
                      title="Bold"
                    >
                      B
                    </button>
                    <button
                      type="button"
                      onClick={() => insertMarkdown("*", "*")}
                      className="p-1 rounded hover:bg-slate-200 italic font-serif px-1.5"
                      title="Italic"
                    >
                      I
                    </button>
                    <button
                      type="button"
                      onClick={() => insertMarkdown("### ")}
                      className="p-1 rounded hover:bg-slate-200"
                      title="Heading"
                    >
                      <FiType className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => insertMarkdown("```\n", "\n```")}
                      className="p-1 rounded hover:bg-slate-200"
                      title="Code Block"
                    >
                      <FiCode className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => insertMarkdown("- ")}
                      className="p-1 rounded hover:bg-slate-200"
                      title="Bullet List"
                    >
                      <FiList className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <textarea
                    rows={6}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-3 py-2 text-xs leading-relaxed text-slate-800 bg-white border border-t-0 border-slate-200 rounded-b-lg focus:border-[#0F766E] outline-none font-mono"
                  />
                </>
              ) : (
                <div className="p-3 bg-slate-50/50 rounded-lg border border-slate-200 min-h-[120px]">
                  <MarkdownViewer content={description} />
                </div>
              )}
            </div>

            {/* Subtasks / Checklist */}
            <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs space-y-2.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Acceptance Criteria & Subtasks
              </h3>

              <div className="space-y-1">
                {subtasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center justify-between gap-2 p-1.5 px-2 bg-slate-50 rounded-lg border border-slate-200 group"
                  >
                    <label className="flex items-center gap-2 min-w-0 cursor-pointer flex-1">
                      <input
                        type="checkbox"
                        checked={task.done}
                        onChange={() => handleToggleSubtask(task.id)}
                        className="w-3.5 h-3.5 rounded text-[#0F766E] focus:ring-[#0F766E]"
                      />
                      <span
                        className={`text-xs ${
                          task.done
                            ? "line-through text-slate-400"
                            : "text-slate-800 font-medium"
                        } break-all`}
                      >
                        {task.text}
                      </span>
                    </label>
                    <button
                      type="button"
                      onClick={() => handleRemoveSubtask(task.id)}
                      className="text-slate-400 hover:text-rose-600 p-0.5"
                    >
                      <FiTrash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2">
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
                  placeholder="Add checklist deliverable (Press Enter)"
                  className="flex-1 px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-[#0F766E] outline-none"
                />
                <button
                  type="button"
                  onClick={handleAddSubtask}
                  disabled={!newSubtaskText.trim()}
                  className="px-2.5 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-40 rounded-lg transition-colors cursor-pointer"
                >
                  + Add
                </button>
              </div>
            </div>

            {/* External Links */}
            <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Attachments & Resources
                </h3>
                {!showAddLink && (
                  <button
                    type="button"
                    onClick={() => setShowAddLink(true)}
                    className="text-xs font-semibold text-[#0F766E] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <FiLink className="w-3 h-3" />
                    <span>+ Add Link</span>
                  </button>
                )}
              </div>

              {showAddLink && (
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={linkTitle}
                      onChange={(e) => setLinkTitle(e.target.value)}
                      placeholder="Title (e.g. Design Spec)"
                      className="px-2.5 py-1 text-xs bg-white border border-slate-200 rounded-md outline-none focus:border-[#0F766E]"
                    />
                    <input
                      type="url"
                      value={linkUrl}
                      onChange={(e) => setLinkUrl(e.target.value)}
                      placeholder="URL (https://...)"
                      className="px-2.5 py-1 text-xs bg-white border border-slate-200 rounded-md outline-none focus:border-[#0F766E]"
                    />
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowAddLink(false)}
                      className="px-2 py-0.5 text-xs text-slate-500 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleAddLink}
                      disabled={!linkUrl.trim()}
                      className="px-2.5 py-0.5 text-xs font-semibold bg-[#0F766E] text-white rounded cursor-pointer disabled:opacity-50"
                    >
                      Save Link
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {links.map((link) => (
                  <div
                    key={link.id}
                    className="p-2 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between gap-2"
                  >
                    <span className="text-xs font-semibold text-slate-800 truncate">
                      {link.title}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveLink(link.id)}
                      className="text-slate-400 hover:text-rose-600 p-0.5"
                    >
                      <FiX className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar Metadata (4 Cols) - Tight spacing */}
          <div className="lg:col-span-4 space-y-3.5">
            {/* Sprint & Planning Widget */}
            <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600 block border-b border-slate-100 pb-1.5">
                Project & Sprint
              </span>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Project
                </label>
                <Select
                  value={projectId}
                  onChange={(val) => setProjectId(val)}
                  className="w-full h-8.5 text-xs font-semibold"
                  options={projects.map((p) => ({
                    value: p.id,
                    label: p.name,
                  }))}
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Sprint / Milestone
                </label>
                <Select
                  value={sprint || undefined}
                  onChange={(val) => setSprint(val || "")}
                  placeholder="Select Sprint"
                  allowClear
                  className="w-full h-8.5 text-xs font-semibold"
                  options={COMMON_SPRINTS.map((sp) => ({
                    value: sp,
                    label: sp,
                  }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Status
                  </label>
                  <Select
                    value={status}
                    onChange={(val) => setStatus(val)}
                    className="w-full h-8.5 text-xs font-semibold"
                    options={ISSUE_STATUSES.map((s) => ({
                      value: s.id,
                      label: s.label,
                    }))}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Priority
                  </label>
                  <Select
                    value={priority}
                    onChange={(val) => setPriority(val)}
                    className="w-full h-8.5 text-xs font-semibold"
                    options={ISSUE_PRIORITIES.map((p) => ({
                      value: p.id,
                      label: p.label,
                    }))}
                  />
                </div>
              </div>

              {/* Blocker Flag */}
              <label className="flex items-center gap-2 p-1.5 bg-rose-50/70 border border-rose-200/60 rounded-lg cursor-pointer">
                <input
                  type="checkbox"
                  checked={isBlocker}
                  onChange={(e) => setIsBlocker(e.target.checked)}
                  className="w-3.5 h-3.5 rounded text-rose-600 focus:ring-rose-500 cursor-pointer"
                />
                <span className="text-[11px] font-semibold text-rose-800 flex items-center gap-1">
                  <FiFlag className="w-3 h-3 text-rose-600" />
                  Flag as Impediment / Blocker
                </span>
              </label>
            </div>

            {/* Assignee Widget */}
            <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600 block border-b border-slate-100 pb-1.5">
                Ownership
              </span>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Assignee
                </label>
                <Select
                  value={assigneeId || undefined}
                  placeholder="Unassigned"
                  allowClear
                  onChange={(sel) => {
                    setAssigneeId(sel || "");
                    if (!sel) {
                      setAssigneeName("Unassigned");
                    } else {
                      const match = availableAssignees.find(
                        (m) =>
                          m.user_id === sel ||
                          m.id === sel ||
                          m.profiles?.id === sel,
                      );
                      setAssigneeName(
                        match?.full_name ||
                          match?.name ||
                          match?.email ||
                          "Team Member",
                      );
                    }
                  }}
                  className="w-full h-8.5 text-xs font-semibold"
                  options={availableAssignees.map((m) => {
                    const uId = m.user_id || m.id || m.profiles?.id;
                    const name =
                      m.full_name ||
                      m.name ||
                      m.profiles?.full_name ||
                      m.email ||
                      "Member";
                    const isMe = user?.id && uId === user.id;
                    return {
                      value: uId,
                      label: `${name} ${isMe ? "(You)" : ""} - ${m.role || "Member"}`,
                    };
                  })}
                />
              </div>
            </div>

            {/* Estimates, Component & Timeline */}
            <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600 block border-b border-slate-100 pb-1.5">
                Estimates & Timeline
              </span>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Story Points
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={storyPoints}
                    onChange={(e) =>
                      setStoryPoints(Number(e.target.value) || 0)
                    }
                    className="w-full px-2 py-1 text-xs font-bold text-slate-800 bg-white border border-slate-300 rounded-md focus:border-[#0F766E] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Est. Time (e.g. 4h)
                  </label>
                  <input
                    type="text"
                    value={estimatedHours}
                    onChange={(e) => setEstimatedHours(e.target.value)}
                    placeholder="e.g. 4h, 2d"
                    className="w-full px-2 py-1 text-xs bg-slate-50 border border-slate-200 rounded-md focus:bg-white focus:border-[#0F766E] outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Due Date
                </label>
                <DatePicker
                  value={dueDate ? dayjs(dueDate) : null}
                  onChange={(d, dateStr) => setDueDate(dateStr || "")}
                  className="w-full h-8.5 text-xs font-semibold"
                  allowClear
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Component / Module
                </label>
                <Select
                  value={component || undefined}
                  onChange={(val) => setComponent(val || "")}
                  placeholder="Select Component"
                  allowClear
                  className="w-full h-8.5 text-xs font-semibold"
                  options={COMMON_COMPONENTS.map((c) => ({
                    value: c,
                    label: c,
                  }))}
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Environment
                </label>
                <input
                  type="text"
                  value={environment}
                  onChange={(e) => setEnvironment(e.target.value)}
                  placeholder="e.g. Production / Safari"
                  className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-[#0F766E] outline-none"
                />
              </div>
            </div>

            {/* Labels & Tags */}
            <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                Labels & Tags
              </label>

              {tags.length > 0 && (
                <div className="flex items-center gap-1 flex-wrap">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-teal-50 text-[#0F766E] border border-teal-200/70 text-[11px] font-semibold"
                    >
                      <span>#{tag}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="hover:text-rose-600 cursor-pointer"
                      >
                        <FiX className="w-2.5 h-2.5" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleAddTag}
                placeholder="Type tag & press Enter"
                className="w-full px-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-md focus:bg-white focus:border-[#0F766E] outline-none"
              />
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
