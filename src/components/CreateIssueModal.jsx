"use client";

import React, { useState } from "react";
import { useSelector } from "react-redux";
import { FiX, FiCheck, FiBookmark, FiAlertCircle, FiCheckSquare } from "react-icons/fi";
import { Select } from "antd";
import Portal from "@/components/Portal";

export default function CreateIssueModal({
  isOpen,
  onClose,
  onAddTicket,
  organizationName = "WorkGrid Workspace",
  teamMembers = [],
  projects = [],
  selectedProjectId = "",
}) {
  const authState = useSelector((state) => state.authSlice);
  const user = authState?.userData;

  const [projectId, setProjectId] = useState(selectedProjectId || "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("story");
  const [status, setStatus] = useState("todo");
  const [priority, setPriority] = useState("medium");
  const [storyPoints, setStoryPoints] = useState(3);
  const [assignee, setAssignee] = useState("");
  const [assigneeId, setAssigneeId] = useState("");

  // Sync default projectId when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setProjectId(selectedProjectId || (projects[0]?.id || ""));
    }
  }, [isOpen, selectedProjectId, projects]);

  const chosenProj = React.useMemo(() => {
    return projects.find((p) => p.id === projectId) || null;
  }, [projects, projectId]);

  // Project team members available for assignment
  const effectiveAssignees = React.useMemo(() => {
    let list = [];
    if (chosenProj) {
      if (chosenProj.assignedManagers?.length > 0) {
        chosenProj.assignedManagers.forEach((m) => {
          list.push({
            id: m.id || m.userId,
            user_id: m.userId || m.id,
            full_name: m.fullName || m.name || "Manager",
            email: m.email || "",
            role: "manager",
          });
        });
      }
      if (chosenProj.assignedMembers?.length > 0) {
        chosenProj.assignedMembers.forEach((m) => {
          list.push({
            id: m.id || m.userId,
            user_id: m.userId || m.id,
            full_name: m.fullName || m.name || "Member",
            email: m.email || "",
            role: "member",
          });
        });
      }
    } else {
      list = [...(teamMembers || [])];
    }

    if (user?.id && list.length > 0) {
      list.sort((a, b) => {
        const aIsMe = (a.user_id === user.id || a.id === user.id || a.profiles?.id === user.id) ? 1 : 0;
        const bIsMe = (b.user_id === user.id || b.id === user.id || b.profiles?.id === user.id) ? 1 : 0;
        return bIsMe - aIsMe;
      });
    }

    return list;
  }, [chosenProj, teamMembers, user?.id]);

  // Set default assignee and assigneeId when modal opens or user loads
  React.useEffect(() => {
    if (isOpen && !assigneeId && user) {
      setAssigneeId(user.id || "");
      setAssignee(user.full_name || user.name || user.email || "");
    }
  }, [isOpen, user, assigneeId]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    let finalAssigneeId = assigneeId || null;
    let finalAssigneeName = assignee.trim() || user?.full_name || user?.name || "Unassigned";

    // Auto-resolve assigneeId from effectiveAssignees if needed
    if (!finalAssigneeId && finalAssigneeName && finalAssigneeName !== "Unassigned" && effectiveAssignees?.length > 0) {
      const match = effectiveAssignees.find(
        (m) =>
          (m.full_name && m.full_name.toLowerCase().trim() === finalAssigneeName.toLowerCase().trim()) ||
          (m.email && m.email.toLowerCase().trim() === finalAssigneeName.toLowerCase().trim()) ||
          (m.user_id && m.user_id === finalAssigneeName)
      );
      if (match) {
        finalAssigneeId = match.user_id || match.profiles?.id || match.id || null;
        if (!finalAssigneeName || finalAssigneeName === match.user_id) {
          finalAssigneeName = match.full_name || match.email || "Team Member";
        }
      }
    }

    if (
      !finalAssigneeId &&
      user &&
      (finalAssigneeName.toLowerCase() === (user.full_name || "").toLowerCase() ||
        finalAssigneeName.toLowerCase() === (user.email || "").toLowerCase() ||
        finalAssigneeName.toLowerCase() === (user.name || "").toLowerCase())
    ) {
      finalAssigneeId = user.id;
    }

    if (onAddTicket) {
      onAddTicket({
        title: title.trim(),
        description: description.trim(),
        type,
        status,
        priority,
        storyPoints: Number(storyPoints) || 1,
        assignee: finalAssigneeName,
        assigneeId: finalAssigneeId,
        assignee_id: finalAssigneeId,
        tags: [],
        projectId: projectId || null,
        project_id: projectId || null,
        projectName: chosenProj?.name || null,
        project_name: chosenProj?.name || null,
      });
    }

    setTitle("");
    setDescription("");
    setAssigneeId(user?.id || "");
    setAssignee(user?.full_name || user?.name || "");
    if (onClose) onClose();
  };

  return (
    <Portal>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs select-none animate-fadeIn">
      <div className="bg-white rounded-lg shadow-xl border border-slate-200/90 w-full max-w-xl overflow-hidden animate-scaleUp">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200/80 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-[#0F766E] flex items-center justify-center text-white text-xs font-bold">
              +
            </div>
            <h2 className="text-sm font-bold text-slate-900">Create Issue</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <FiX className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Workspace, Project & Issue Type */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                Workspace
              </label>
              <div className="px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 truncate">
                {organizationName}
              </div>
            </div>

            {projects && projects.length > 0 ? (
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Project
                </label>
                <Select
                  value={projectId || undefined}
                  onChange={(val) => setProjectId(val || "")}
                  placeholder="Select Project"
                  allowClear
                  className="w-full h-9 text-xs font-semibold"
                  options={projects.map((p) => ({ value: p.id, label: p.name }))}
                />
              </div>
            ) : (
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Project
                </label>
                <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-400 italic">
                  Default Workspace
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                Issue Type
              </label>
              <Select
                value={type}
                onChange={(val) => setType(val)}
                className="w-full h-9 text-xs font-semibold"
                options={[
                  { value: "story", label: "📗 Story" },
                  { value: "task", label: "📘 Task" },
                  { value: "bug", label: "🔴 Bug" },
                ]}
              />
            </div>
          </div>

          {/* Title / Summary */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
              Summary <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Implement webhook notification listener"
              className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 outline-none focus:ring-2 focus:ring-[#0F766E] placeholder:text-slate-400"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
              Description
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide context, acceptance criteria, or technical details..."
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 outline-none focus:ring-2 focus:ring-[#0F766E] placeholder:text-slate-400"
            />
          </div>

          {/* Priority & Status */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                Priority
              </label>
              <Select
                value={priority}
                onChange={(val) => setPriority(val)}
                className="w-full h-9 text-xs font-semibold"
                options={[
                  { value: "urgent", label: "🔴 Urgent" },
                  { value: "high", label: "🟠 High" },
                  { value: "medium", label: "🟡 Medium" },
                  { value: "low", label: "🟢 Low" },
                ]}
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                Initial Status
              </label>
              <Select
                value={status}
                onChange={(val) => setStatus(val)}
                className="w-full h-9 text-xs font-semibold"
                options={[
                  { value: "backlog", label: "📦 Backlog" },
                  { value: "todo", label: "📋 To Do" },
                  { value: "in-progress", label: "⚡ In Progress" },
                  { value: "review", label: "🔍 Code Review" },
                  { value: "done", label: "✅ Done" },
                ]}
              />
            </div>
          </div>

          {/* Story Points & Assignee */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                Story Points
              </label>
              <input
                type="number"
                min="1"
                max="21"
                value={storyPoints}
                onChange={(e) => setStoryPoints(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 outline-none focus:ring-2 focus:ring-[#0F766E]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                Assignee
              </label>
              {effectiveAssignees && effectiveAssignees.length > 0 ? (
                <Select
                  value={assigneeId || undefined}
                  placeholder="Unassigned"
                  allowClear
                  onChange={(selId) => {
                    setAssigneeId(selId);
                    if (!selId) {
                      setAssignee("Unassigned");
                    } else {
                      const found = effectiveAssignees.find(
                        (m) => (m.user_id || m.profiles?.id || m.id) === selId,
                      );
                      const name =
                        found?.full_name ||
                        found?.name ||
                        found?.email ||
                        "Team Member";
                      setAssignee(name);
                    }
                  }}
                  className="w-full h-9 text-xs font-semibold"
                  options={effectiveAssignees.map((member) => {
                      const mId =
                        member.user_id || member.profiles?.id || member.id;
                      const mName =
                        member.full_name ||
                        member.name ||
                        member.email ||
                        "Member";
                      const isMe =
                        user?.id &&
                        (mId === user.id || member.user_id === user.id);
                      return {
                        value: mId,
                        label: `${mName} ${isMe ? "(You) " : ""}(${member.role})`,
                      };
                    }),
                />
              ) : (
                <input
                  type="text"
                  value={assignee}
                  onChange={(e) => {
                    const val = e.target.value;
                    setAssignee(val);
                    if (
                      user &&
                      (val.trim().toLowerCase() === (user.full_name || "").toLowerCase() ||
                        val.trim().toLowerCase() === (user.email || "").toLowerCase() ||
                        val.trim().toLowerCase() === (user.name || "").toLowerCase())
                    ) {
                      setAssigneeId(user.id);
                    } else {
                      setAssigneeId("");
                    }
                  }}
                  placeholder="Assignee name"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 outline-none focus:ring-2 focus:ring-[#0F766E]"
                />
              )}
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3.5 border-t border-slate-200/80">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary px-4 py-2 text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary px-4 py-2 text-xs font-semibold"
            >
              <FiCheck className="w-3.5 h-3.5" />
              <span>Create Issue</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  </Portal>
);
}
