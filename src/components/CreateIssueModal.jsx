"use client";

import React, { useState } from "react";
import { useSelector } from "react-redux";
import { FiX, FiCheck, FiBookmark, FiAlertCircle, FiCheckSquare } from "react-icons/fi";
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
    if (chosenProj) {
      const list = [];
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
      if (list.length > 0) return list;
    }
    return teamMembers || [];
  }, [chosenProj, teamMembers]);

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
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs select-none animate-fadeIn">
      <div className="bg-white rounded-lg shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden animate-scaleUp">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-[#0F766E] flex items-center justify-center text-white text-xs font-bold">
              +
            </div>
            <h2 className="text-base font-bold text-slate-800">Create Issue</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
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
                <select
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-[#0F766E]"
                >
                  <option value="">General (No Project)</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
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
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-[#0F766E]"
              >
                <option value="story">📗 Story</option>
                <option value="task">📘 Task</option>
                <option value="bug">🔴 Bug</option>
              </select>
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
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-[#0F766E]"
              >
                <option value="urgent">🔴 Urgent</option>
                <option value="high">🟠 High</option>
                <option value="medium">🟡 Medium</option>
                <option value="low">🟢 Low</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                Initial Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-[#0F766E]"
              >
                <option value="todo">📋 To Do</option>
                <option value="in-progress">⚡ In Progress</option>
                <option value="review">🔍 Code Review</option>
                <option value="done">✅ Done</option>
              </select>
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
                <select
                  value={assigneeId}
                  onChange={(e) => {
                    const selId = e.target.value;
                    setAssigneeId(selId);
                    if (!selId) {
                      setAssignee("Unassigned");
                    } else {
                      const found = effectiveAssignees.find(
                        (m) => (m.user_id || m.profiles?.id || m.id) === selId
                      );
                      const name = found?.full_name || found?.name || found?.email || "Team Member";
                      setAssignee(name);
                    }
                  }}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-[#0F766E]"
                >
                  <option value="">Unassigned</option>
                  {effectiveAssignees.map((member) => {
                    const mId = member.user_id || member.profiles?.id || member.id;
                    const mName = member.full_name || member.name || member.email || "Member";
                    return (
                      <option key={mId || member.email} value={mId}>
                        {mName} ({member.role})
                      </option>
                    );
                  })}
                </select>
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
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-[#0F766E] hover:bg-[#0D655E] active:bg-[#115E59] active:scale-[0.98] text-white text-xs font-bold rounded-lg shadow-md shadow-teal-900/20 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <FiCheck className="w-4 h-4" />
              <span>Create Issue</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  </Portal>
);
}
