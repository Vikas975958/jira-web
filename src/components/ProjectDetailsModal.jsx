"use client";

import React, { useState } from "react";
import { toast } from "react-toastify";
import {
  FiFolder,
  FiX,
  FiUsers,
  FiShield,
  FiCalendar,
  FiClock,
  FiCheckCircle,
  FiTrash2,
  FiPlus,
  FiMail,
} from "react-icons/fi";
import projectService from "@/services/project.service";
import { MEMBER_ROLE, MANAGER_ROLE, OWNER_ROLE } from "@/utils/constants";

export default function ProjectDetailsModal({
  isOpen,
  onClose,
  project,
  currentUserRole = MEMBER_ROLE,
  onProjectUpdated,
  onOpenBoard,
}) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(project?.status || "active");

  if (!isOpen || !project) return null;

  const isOwner = currentUserRole === OWNER_ROLE;
  const isManager = currentUserRole === MANAGER_ROLE;
  const canManage = isOwner || isManager;

  const handleStatusChange = async (newStatus) => {
    setStatus(newStatus);
    try {
      await projectService.updateProject(
        project.id,
        { status: newStatus },
        { userRole: currentUserRole }
      );
      toast.success(`Project status updated to ${newStatus}`);
      if (onProjectUpdated) onProjectUpdated();
    } catch (err) {
      toast.error(err?.message || "Failed to update status");
    }
  };

  const handleDeleteProject = async () => {
    if (!confirm(`Are you sure you want to delete project "${project.name}"?`)) return;
    setLoading(true);
    try {
      await projectService.deleteProject(project.id, { userRole: currentUserRole });
      toast.info(`Project "${project.name}" deleted.`);
      if (onProjectUpdated) onProjectUpdated();
      onClose();
    } catch (err) {
      toast.error(err?.message || "Failed to delete project");
    } finally {
      setLoading(false);
    }
  };

  const statusBadgeColors = {
    planning: "bg-slate-100 text-slate-700 border-slate-200",
    active: "bg-emerald-100 text-emerald-800 border-emerald-200",
    on_hold: "bg-amber-100 text-amber-800 border-amber-200",
    completed: "bg-blue-100 text-blue-800 border-blue-200",
  };

  return (
    <div
      className="fixed inset-0 z-[999] flex items-center justify-center p-4 select-none"
      style={{ backgroundColor: "rgba(15, 23, 42, 0.65)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        style={{ maxHeight: "85vh", animation: "modalSlideIn 0.2s ease-out" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Accent Bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-blue-600 to-indigo-600" />

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
              <FiFolder className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 leading-tight">
                {project.name}
              </h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span
                  className={`px-2 py-0.2 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                    statusBadgeColors[status] || statusBadgeColors.active
                  }`}
                >
                  {status}
                </span>
                <span className="text-[11px] text-slate-400">
                  Created: {new Date(project.created_at || Date.now()).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-5 overflow-y-auto">
          {/* Description */}
          {project.description ? (
            <div>
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Description
              </h4>
              <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
                {project.description}
              </p>
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic">No description provided for this project.</p>
          )}

          {/* Dates & Status Control */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div className="flex items-center gap-1.5 text-slate-500 text-[10px] font-bold uppercase">
                <FiCalendar className="w-3.5 h-3.5" />
                <span>Start Date</span>
              </div>
              <p className="text-xs font-bold text-slate-900 mt-1">
                {project.start_date ? new Date(project.start_date).toLocaleDateString() : "Not set"}
              </p>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div className="flex items-center gap-1.5 text-slate-500 text-[10px] font-bold uppercase">
                <FiClock className="w-3.5 h-3.5" />
                <span>Due Date</span>
              </div>
              <p className="text-xs font-bold text-slate-900 mt-1">
                {project.due_date ? new Date(project.due_date).toLocaleDateString() : "Not set"}
              </p>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 col-span-2 sm:col-span-1">
              <div className="text-slate-500 text-[10px] font-bold uppercase mb-1">
                Change Status
              </div>
              {canManage ? (
                <select
                  value={status}
                  onChange={(e) => handleStatusChange(e.target.value)}
                  className="w-full text-xs font-bold bg-white border border-slate-300 rounded-lg px-2 py-1 outline-none text-slate-800"
                >
                  <option value="planning">Planning</option>
                  <option value="active">Active</option>
                  <option value="on_hold">On Hold</option>
                  <option value="completed">Completed</option>
                </select>
              ) : (
                <span className="text-xs font-bold text-slate-800 capitalize">{status}</span>
              )}
            </div>
          </div>

          {/* Assigned Managers */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <FiShield className="w-4 h-4 text-purple-600" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Assigned Managers ({(project.assignedManagers || []).length})
              </h4>
            </div>
            {(project.assignedManagers || []).length === 0 ? (
              <p className="text-xs text-slate-400 italic">No managers assigned to this project.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {project.assignedManagers.map((mgr) => (
                  <div
                    key={mgr.id || mgr.userId}
                    className="p-2.5 bg-purple-50/50 border border-purple-200 rounded-xl flex items-center gap-2.5 text-xs"
                  >
                    <div className="w-7 h-7 rounded-lg bg-purple-600 text-white font-bold flex items-center justify-center shrink-0">
                      {mgr.fullName?.charAt(0)?.toUpperCase() || "M"}
                    </div>
                    <div className="truncate">
                      <p className="font-bold text-slate-900 truncate">{mgr.fullName}</p>
                      <p className="text-[10px] text-slate-500 font-mono truncate">{mgr.email}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Assigned Members */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <div className="flex items-center gap-2">
              <FiUsers className="w-4 h-4 text-blue-600" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Assigned Team Members ({(project.assignedMembers || []).length})
              </h4>
            </div>
            {(project.assignedMembers || []).length === 0 ? (
              <p className="text-xs text-slate-400 italic">No members assigned to this project.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {project.assignedMembers.map((mem) => (
                  <div
                    key={mem.id || mem.userId}
                    className="p-2.5 bg-blue-50/50 border border-blue-200 rounded-xl flex items-center gap-2.5 text-xs"
                  >
                    <div className="w-7 h-7 rounded-lg bg-blue-600 text-white font-bold flex items-center justify-center shrink-0">
                      {mem.fullName?.charAt(0)?.toUpperCase() || "U"}
                    </div>
                    <div className="truncate">
                      <p className="font-bold text-slate-900 truncate">{mem.fullName}</p>
                      <p className="text-[10px] text-slate-500 font-mono truncate">{mem.email}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/50 shrink-0">
          <div>
            {isOwner && (
              <button
                type="button"
                onClick={handleDeleteProject}
                disabled={loading}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 hover:text-red-800 transition-colors cursor-pointer"
              >
                <FiTrash2 className="w-3.5 h-3.5" />
                <span>Delete Project</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Close
            </button>
            {onOpenBoard && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenBoard(project);
                }}
                className="px-5 py-2 bg-[#0052CC] hover:bg-[#0747A6] text-white text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer"
              >
                Open Project Board
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
