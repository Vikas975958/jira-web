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
import DeleteProjectConfirmModal from "@/components/DeleteProjectConfirmModal";
import DeleteConfirmModal from "@/components/DeleteConfirmModal";

export default function ProjectDetailsModal({
  isOpen,
  onClose,
  project,
  currentUserRole = MEMBER_ROLE,
  currentUserId = null,
  onProjectUpdated,
  onProjectDeleted,
  onOpenBoard,
}) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(project?.status || "active");
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState(null);
  const [isRemovingMember, setIsRemovingMember] = useState(false);

  const allTeamMembers = React.useMemo(() => {
    if (!project) return [];
    const list = [];
    if (project?.assignedManagers?.length > 0) {
      project.assignedManagers.forEach((m) => {
        list.push({
          id: m.id || m.userId,
          userId: m.userId || m.id,
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
          userId: m.userId || m.id,
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
          userId: pm.user_id || pm.id,
          name: prof.full_name || prof.email || "Team Member",
          type: pm.role === "manager" ? "Manager" : "Member",
          role: pm.role || "member",
          email: prof.email || "No email",
          profilePhoto: prof.profile_photo,
        });
      });
    }
    if (currentUserId && list.length > 0) {
      list.sort((a, b) => {
        const aIsMe = (a.userId === currentUserId || a.id === currentUserId) ? 1 : 0;
        const bIsMe = (b.userId === currentUserId || b.id === currentUserId) ? 1 : 0;
        return bIsMe - aIsMe;
      });
    }
    return list;
  }, [project, currentUserId]);

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
        { userRole: currentUserRole, userId: currentUserId }
      );
      if (onProjectUpdated) onProjectUpdated();
    } catch (err) {
      toast.error(err?.message || "Failed to update status");
    }
  };

  const handleDeleteClick = () => {
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDeleteProject = async () => {
    setLoading(true);
    try {
      await projectService.deleteProject(project.id, {
        userRole: currentUserRole,
        userId: currentUserId,
      });
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("project-deleted", { detail: { id: project.id } }));
      }
      if (onProjectDeleted) {
        onProjectDeleted();
      } else if (onProjectUpdated) {
        onProjectUpdated();
      }
      setIsDeleteModalOpen(false);
      onClose();
    } catch (err) {
      toast.error(err?.message || "Failed to delete project");
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = (targetMember) => {
    setMemberToRemove(targetMember);
  };

  const handleConfirmRemoveMember = async () => {
    if (!memberToRemove) return;
    setIsRemovingMember(true);
    try {
      await projectService.removeProjectMember({
        projectId: project.id,
        userId: memberToRemove.userId || memberToRemove.id,
        userRole: currentUserRole,
        callerId: currentUserId,
      });
      setMemberToRemove(null);
      if (onProjectUpdated) onProjectUpdated();
    } catch (err) {
      toast.error(err?.message || "Failed to remove member");
    } finally {
      setIsRemovingMember(false);
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
          className="relative w-full max-w-xl bg-white rounded-lg border border-slate-200 shadow-xl overflow-hidden flex flex-col"
          style={{ maxHeight: "85vh", animation: "modalSlideIn 0.2s ease-out" }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-slate-50/70">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-teal-50 text-[#0F766E] border border-teal-200/70 flex items-center justify-center font-bold shrink-0">
                <FiFolder className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-bold text-slate-900 leading-tight">
                  {project.name}
                </h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <span
                    className={`px-2 py-0.2 rounded-md text-[10px] font-semibold uppercase tracking-wider border ${
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
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              title="Close"
            >
              <FiX className="w-4 h-4" />
            </button>
          </div>

          {/* Body Content */}
          <div className="p-5 space-y-4 overflow-y-auto">
            {/* Description */}
            {project.description ? (
              <div>
                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Description
                </h4>
                <p className="text-xs text-slate-700 leading-relaxed bg-slate-50/70 p-3 rounded-lg border border-slate-200/80">
                  {project.description}
                </p>
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">No description provided for this project.</p>
            )}

            {/* Dates & Status Control */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="p-3 bg-slate-50/60 rounded-lg border border-slate-200/80">
                <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-semibold uppercase">
                  <FiCalendar className="w-3.5 h-3.5 text-[#0F766E]" />
                  <span>Start Date</span>
                </div>
                <p className="text-xs font-semibold text-slate-800 mt-1">
                  {project.start_date ? new Date(project.start_date).toLocaleDateString() : "Not set"}
                </p>
              </div>

              <div className="p-3 bg-slate-50/60 rounded-lg border border-slate-200/80">
                <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-semibold uppercase">
                  <FiClock className="w-3.5 h-3.5 text-amber-600" />
                  <span>Due Date</span>
                </div>
                <p className="text-xs font-semibold text-slate-800 mt-1">
                  {project.due_date ? new Date(project.due_date).toLocaleDateString() : "Not set"}
                </p>
              </div>

              <div className="p-3 bg-slate-50/60 rounded-lg border border-slate-200/80 col-span-2 sm:col-span-1">
                <div className="text-slate-400 text-[10px] font-semibold uppercase mb-1">
                  Change Status
                </div>
                {canManage ? (
                  <select
                    value={status}
                    onChange={(e) => handleStatusChange(e.target.value)}
                    className="jira-input w-full text-xs font-semibold py-1 px-2.5 h-7.5"
                  >
                    <option value="planning">Planning</option>
                    <option value="active">Active</option>
                    <option value="on_hold">On Hold</option>
                    <option value="completed">Completed</option>
                  </select>
                ) : (
                  <span className="text-xs font-semibold text-slate-800 capitalize">{status}</span>
                )}
              </div>
            </div>

            {/* Total Team List */}
            <div className="space-y-2.5 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FiUsers className="w-3.5 h-3.5 text-[#0F766E]" />
                  <h4 className="text-xs font-bold text-slate-800">
                    Team Members
                  </h4>
                </div>
                <span className="text-[11px] text-slate-400 font-medium">
                  Name • Role • Email
                </span>
              </div>

              {allTeamMembers.length === 0 ? (
                <div className="p-4 bg-slate-50/70 border border-slate-200/80 rounded-lg text-center text-xs text-slate-400 italic">
                  No team members assigned to this project yet.
                </div>
              ) : (
                <div className="rounded-lg border border-slate-200 overflow-hidden bg-white shadow-2xs">
                  <div className="grid grid-cols-12 px-3.5 py-2 bg-slate-50 text-[10px] font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-200/70">
                    <div className="col-span-5">Name</div>
                    <div className="col-span-3">Role</div>
                    <div className="col-span-3">Email</div>
                    <div className="col-span-1 text-right">Action</div>
                  </div>
                  <div className="divide-y divide-slate-100 max-h-52 overflow-y-auto">
                    {allTeamMembers.map((member) => (
                      <div
                        key={member.id}
                        className="grid grid-cols-12 px-3.5 py-2.5 items-center text-xs hover:bg-slate-50/70 transition-colors gap-2"
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
                          <span className="font-semibold text-slate-800 truncate">
                            {member.name}
                          </span>
                          {currentUserId && (member.userId === currentUserId || member.id === currentUserId) && (
                            <span className="ml-1 text-[10px] font-semibold text-[#0F766E]">(You)</span>
                          )}
                        </div>

                        {/* Type Badge */}
                        <div className="col-span-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.2 rounded-md text-[10px] font-semibold capitalize ${
                              member.role === "manager"
                                ? "bg-purple-50 text-purple-700 border border-purple-200"
                                : "bg-teal-50 text-[#0F766E] border border-teal-200"
                            }`}
                          >
                            {member.type}
                          </span>
                        </div>

                        {/* Email */}
                        <div className="col-span-3 flex items-center gap-1.5 min-w-0 text-slate-600">
                          <FiMail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate text-[11px] font-mono text-slate-600" title={member.email}>
                            {member.email}
                          </span>
                        </div>

                        {/* Action: Remove Member from project */}
                        <div className="col-span-1 text-right">
                          {canManage && member.role !== OWNER_ROLE ? (
                            <button
                              type="button"
                              onClick={() => handleRemoveMember(member)}
                              className="p-1 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                              title={`Remove ${member.name} from project`}
                            >
                              <FiTrash2 className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-300">—</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-200 bg-slate-50/70 shrink-0">
            <div>
              {isOwner && (
                <button
                  type="button"
                  onClick={handleDeleteClick}
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 hover:text-red-800 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <FiTrash2 className="w-3.5 h-3.5" />
                  <span>Delete Project</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="btn-secondary px-3.5 py-1.5 text-xs font-semibold"
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
                  className="btn-primary px-4 py-1.5 text-xs font-semibold"
                >
                  Open Board
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Delete Project Confirmation Modal */}
      {isDeleteModalOpen && (
        <DeleteProjectConfirmModal
          isOpen={isDeleteModalOpen}
          onClose={() => setIsDeleteModalOpen(false)}
          onConfirm={handleConfirmDeleteProject}
          isLoading={loading}
          projectName={project.name}
        />
      )}

      {/* Remove Member Confirmation Modal */}
      {memberToRemove && (
        <DeleteConfirmModal
          isOpen={Boolean(memberToRemove)}
          onClose={() => setMemberToRemove(null)}
          onConfirm={handleConfirmRemoveMember}
          isLoading={isRemovingMember}
          title="Remove Project Member"
          subtitle={`Project: ${project?.name || "Project"}`}
          message={`Are you sure you want to remove ${memberToRemove.name} from "${project?.name}"? They will lose access to all tasks and boards in this project.`}
          confirmButtonText="Remove Member"
          item={memberToRemove}
        />
      )}
    </Portal>
  );
}
