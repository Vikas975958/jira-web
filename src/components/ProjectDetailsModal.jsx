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
import Portal from "@/components/Portal";

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

  const allTeamMembers = React.useMemo(() => {
    if (!project) return [];
    const list = [];
    if (project?.assignedManagers?.length > 0) {
      project.assignedManagers.forEach((m) => {
        list.push({
          id: m.id || m.userId,
          name: m.fullName || m.name || "Manager",
          type: "Manager",
          role: "manager",
          email: m.email || "No email",
          profilePhoto: m.profilePhoto,
        });
      });
    }
    if (project?.assignedMembers?.length > 0) {
      project.assignedMembers.forEach((m) => {
        list.push({
          id: m.id || m.userId,
          name: m.fullName || m.name || "Member",
          type: "Member",
          role: "member",
          email: m.email || "No email",
          profilePhoto: m.profilePhoto,
        });
      });
    }
    if (list.length === 0 && project?.project_members?.length > 0) {
      project.project_members.forEach((pm) => {
        const prof = pm.profiles || {};
        list.push({
          id: pm.id || pm.user_id,
          name: prof.full_name || prof.email || "Team Member",
          type: pm.role === "manager" ? "Manager" : "Member",
          role: pm.role || "member",
          email: prof.email || "No email",
          profilePhoto: prof.profile_photo,
        });
      });
    }
    return list;
  }, [project]);

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
    completed: "bg-teal-100 text-teal-800 border-teal-200",
  };

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center p-4 select-none"
        style={{ backgroundColor: "rgba(15, 23, 42, 0.65)", backdropFilter: "blur(4px)" }}
        onClick={onClose}
      >
        <div
          className="relative w-full max-w-xl bg-white rounded-lg shadow-2xl overflow-hidden flex flex-col"
          style={{ maxHeight: "85vh", animation: "modalSlideIn 0.2s ease-out" }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Accent Bar */}
          <div className="h-1.5 w-full bg-gradient-to-r from-[#0F766E] to-teal-700" />

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-teal-100 text-[#0F766E] flex items-center justify-center font-bold">
              <FiFolder className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 leading-tight">
                {project.name}
              </h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span
                  className={`px-2 py-0.2 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${
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
              <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100">
                {project.description}
              </p>
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic">No description provided for this project.</p>
          )}

          {/* Dates & Status Control */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div className="flex items-center gap-1.5 text-slate-500 text-[10px] font-bold uppercase">
                <FiCalendar className="w-3.5 h-3.5" />
                <span>Start Date</span>
              </div>
              <p className="text-xs font-bold text-slate-900 mt-1">
                {project.start_date ? new Date(project.start_date).toLocaleDateString() : "Not set"}
              </p>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div className="flex items-center gap-1.5 text-slate-500 text-[10px] font-bold uppercase">
                <FiClock className="w-3.5 h-3.5" />
                <span>Due Date</span>
              </div>
              <p className="text-xs font-bold text-slate-900 mt-1">
                {project.due_date ? new Date(project.due_date).toLocaleDateString() : "Not set"}
              </p>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 col-span-2 sm:col-span-1">
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

          {/* Total Team List with Name, Type and Email */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FiUsers className="w-4 h-4 text-[#0F766E]" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Total Team List ({allTeamMembers.length})
                </h4>
              </div>
              <span className="text-[11px] text-slate-400 font-medium">
                Name • Type • Email
              </span>
            </div>

            {allTeamMembers.length === 0 ? (
              <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-lg text-center text-xs text-slate-400 italic">
                No team members assigned to this project yet.
              </div>
            ) : (
              <div className="rounded-lg border border-slate-200/80 overflow-hidden bg-white shadow-2xs">
                <div className="grid grid-cols-12 px-3 py-2 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100">
                  <div className="col-span-5">Name</div>
                  <div className="col-span-3">Type</div>
                  <div className="col-span-4">Email</div>
                </div>
                <div className="divide-y divide-slate-100 max-h-56 overflow-y-auto">
                  {allTeamMembers.map((member) => (
                    <div
                      key={member.id}
                      className="grid grid-cols-12 px-3 py-2.5 items-center text-xs hover:bg-slate-50/70 transition-colors gap-2"
                    >
                      {/* Name with Avatar */}
                      <div className="col-span-5 flex items-center gap-2 min-w-0">
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                            member.role === "manager"
                              ? "bg-purple-100 text-purple-700"
                              : "bg-teal-100 text-[#0F766E]"
                          }`}
                        >
                          {member.name?.charAt(0)?.toUpperCase() || "U"}
                        </div>
                        <span className="font-semibold text-slate-900 truncate">
                          {member.name}
                        </span>
                      </div>

                      {/* Type Badge */}
                      <div className="col-span-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-bold capitalize ${
                            member.role === "manager"
                              ? "bg-purple-50 text-purple-700 border border-purple-200"
                              : "bg-teal-50 text-[#0F766E] border border-teal-200"
                          }`}
                        >
                          {member.type}
                        </span>
                      </div>

                      {/* Email */}
                      <div className="col-span-4 flex items-center gap-1.5 min-w-0 text-slate-600">
                        <FiMail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate text-[11px] font-mono" title={member.email}>
                          {member.email}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
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
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
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
                className="px-5 py-2 bg-[#0F766E] hover:bg-[#0D655E] active:bg-[#115E59] active:scale-[0.98] text-white text-xs font-bold rounded-lg shadow-md shadow-teal-900/20 transition-all cursor-pointer"
              >
                Open Project Board
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  </Portal>
);
}
