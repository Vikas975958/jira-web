"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSelector } from "react-redux";
import Link from "next/link";
import { toast } from "react-toastify";
import { Select } from "antd";
import {
  FiArrowLeft,
  FiFolder,
  FiCalendar,
  FiClock,
  FiUsers,
  FiUserPlus,
  FiUserMinus,
  FiMail,
  FiShield,
  FiTrash2,
  FiCheckCircle,
  FiAlertCircle,
  FiSend,
  FiCopy,
  FiExternalLink,
  FiLayers,
  FiInfo,
  FiCheck,
  FiSearch,
  FiX,
  FiEdit2,
  FiChevronDown,
} from "react-icons/fi";
import { LuPin } from "react-icons/lu";
import { useOrganization } from "@/context/OrganizationContext";
import projectService from "@/services/project.service";
import organizationService from "@/services/organization.service";
import DeleteProjectConfirmModal from "@/components/DeleteProjectConfirmModal";
import DeleteConfirmModal from "@/components/DeleteConfirmModal";
import EditProjectModal from "@/components/EditProjectModal";
import ProjectDetailsSkeleton from "@/components/ProjectDetailsSkeleton";
import { MEMBER_ROLE, MANAGER_ROLE, OWNER_ROLE } from "@/utils/constants";
import { isProjectPinned, togglePinProject } from "@/utils/pinnedProjects";

export default function ProjectDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params?.id;

  const authState = useSelector((state) => state.authSlice);
  const user = authState?.userData;

  const { currentOrg, organizations, members: orgMembers = [], refreshMembers } = useOrganization();
  const activeOrg = currentOrg?.organizations || currentOrg || organizations?.[0]?.organizations || organizations?.[0];
  const userRole = currentOrg?.role || organizations?.[0]?.role || user?.role || MEMBER_ROLE;

  // Project state
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [status, setStatus] = useState("active");
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeletingProject, setIsDeletingProject] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isPinned, setIsPinned] = useState(false);

  // Tab for team actions: 'existing' | 'invite'
  const [addMode, setAddMode] = useState("existing");

  // Assign existing member state
  const [selectedExistingUserId, setSelectedExistingUserId] = useState("");
  const [assignRole, setAssignRole] = useState(MEMBER_ROLE);
  const [assigning, setAssigning] = useState(false);

  // Invite external member state
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState(MEMBER_ROLE);
  const [inviting, setInviting] = useState(false);
  const [lastInviteLink, setLastInviteLink] = useState(null);

  // Pending invitations
  const [pendingInvitations, setPendingInvitations] = useState([]);
  const [loadingInvites, setLoadingInvites] = useState(false);

  // Member search filter
  const [memberSearch, setMemberSearch] = useState("");

  // Delete Confirm Modal State (for members & invitations)
  const [deleteConfirmState, setDeleteConfirmState] = useState({
    isOpen: false,
    item: null,
    title: "",
    subtitle: "",
    message: "",
    confirmButtonText: "Delete",
    actionType: null,
  });
  const [isDeletingConfirm, setIsDeletingConfirm] = useState(false);

  const isOwner = userRole === OWNER_ROLE;
  const isManager = userRole === MANAGER_ROLE;

  // Check if current user is assigned as a Project Manager in this project
  const isProjectManager = useMemo(() => {
    if (!project || !user?.id) return false;
    if (isOwner) return true;
    const managers = project.assignedManagers || [];
    return managers.some((m) => (m.userId || m.id) === user.id);
  }, [project, user?.id, isOwner]);

  // Can manage team if workspace owner or project manager
  const canManage = isOwner || isManager || isProjectManager;

  const isFetchingProjectRef = React.useRef(false);
  const lastFetchedProjectKeyRef = React.useRef("");
  const isFetchingInvitesRef = React.useRef(false);
  const lastFetchedInvitesKeyRef = React.useRef("");
  const projectOrgIdRef = React.useRef("");

  useEffect(() => {
    if (project?.organization_id) {
      projectOrgIdRef.current = project.organization_id;
    }
  }, [project?.organization_id]);

  // Fetch Project Details
  const loadProject = useCallback(async (force = false) => {
    if (!projectId) return;
    const fetchKey = `${projectId}:${user?.id || ""}:${userRole || ""}`;
    if (!force && (isFetchingProjectRef.current || lastFetchedProjectKeyRef.current === fetchKey)) {
      return;
    }
    isFetchingProjectRef.current = true;
    try {
      setLoading((prev) => (prev ? true : !lastFetchedProjectKeyRef.current));
      setErrorMsg("");
      const data = await projectService.getProjectById(
        projectId,
        {
          userId: user?.id,
          userRole,
        },
        force
      );
      if (!data) {
        setErrorMsg("Project not found or you do not have permission to view it.");
        setProject(null);
      } else {
        lastFetchedProjectKeyRef.current = fetchKey;
        setProject(data);
        setStatus(data.status || "active");
      }
    } catch (err) {
      console.error("loadProject error:", err);
      setErrorMsg(err?.message || "Failed to load project details.");
    } finally {
      isFetchingProjectRef.current = false;
      setLoading(false);
    }
  }, [projectId, user?.id, userRole]);

  // Fetch Pending Project Invitations
  const loadInvitations = useCallback(async (force = false) => {
    if (!projectId) return;
    const orgId = activeOrg?.id || projectOrgIdRef.current;
    const fetchKey = `${projectId}:${orgId || ""}`;
    if (!force && (isFetchingInvitesRef.current || lastFetchedInvitesKeyRef.current === fetchKey)) {
      return;
    }
    isFetchingInvitesRef.current = true;
    try {
      setLoadingInvites(true);
      const invites = await projectService.getProjectInvitations(
        { projectId, organizationId: orgId },
        force
      );
      lastFetchedInvitesKeyRef.current = fetchKey;
      setPendingInvitations(invites || []);
    } catch (err) {
      console.error("loadInvitations error:", err);
    } finally {
      isFetchingInvitesRef.current = false;
      setLoadingInvites(false);
    }
  }, [projectId, activeOrg?.id]);

  useEffect(() => {
    loadProject();
    loadInvitations();
  }, [loadProject, loadInvitations]);

  // Synchronize across components when invitations or members are deleted
  useEffect(() => {
    let syncTimer = null;
    const handleSync = (e) => {
      // Ignore events dispatched by this page itself to avoid redundant re-fetches
      if (e?.detail?.source === "project-details-page") return;
      if (e?.detail?.projectId && e.detail.projectId !== projectId) return;

      if (syncTimer) clearTimeout(syncTimer);
      syncTimer = setTimeout(() => {
        loadInvitations(true);
        loadProject(true);
      }, 300);
    };

    window.addEventListener("invitation-deleted", handleSync);
    window.addEventListener("project-updated", handleSync);
    window.addEventListener("member-removed", handleSync);
    return () => {
      if (syncTimer) clearTimeout(syncTimer);
      window.removeEventListener("invitation-deleted", handleSync);
      window.removeEventListener("project-updated", handleSync);
      window.removeEventListener("member-removed", handleSync);
    };
  }, [loadInvitations, loadProject, projectId]);

  // Flattened team members list (Name, Type/Role, Email)
  const allTeamMembers = useMemo(() => {
    if (!project) return [];
    const list = [];

    if (project?.assignedManagers?.length > 0) {
      project.assignedManagers.forEach((m) => {
        list.push({
          id: m.id || m.userId,
          userId: m.userId || m.id,
          name: m.fullName || m.name || "Manager",
          type: "Manager",
          role: MANAGER_ROLE,
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
          role: MEMBER_ROLE,
          email: m.email || "No email",
          profilePhoto: m.profilePhoto,
        });
      });
    }

    // Fallback if not pre-categorized
    if (list.length === 0 && project?.project_members?.length > 0) {
      project.project_members.forEach((pm) => {
        const prof = pm.profiles || {};
        list.push({
          id: pm.id || pm.user_id,
          userId: pm.user_id || pm.id,
          name: prof.full_name || prof.email || "Team Member",
          type: pm.role === MANAGER_ROLE ? "Manager" : "Member",
          role: pm.role || MEMBER_ROLE,
          email: prof.email || "No email",
          profilePhoto: prof.profile_photo,
        });
      });
    }

    return list;
  }, [project]);

  // Filtered members by search
  const filteredTeamMembers = useMemo(() => {
    const q = memberSearch.toLowerCase().trim();
    const list = !q
      ? [...allTeamMembers]
      : allTeamMembers.filter(
          (m) =>
            m.name?.toLowerCase().includes(q) ||
            m.email?.toLowerCase().includes(q) ||
            m.type?.toLowerCase().includes(q)
        );

    if (user?.id) {
      list.sort((a, b) => {
        const aIsMe = (a.userId === user.id || a.id === user.id) ? 1 : 0;
        const bIsMe = (b.userId === user.id || b.id === user.id) ? 1 : 0;
        return bIsMe - aIsMe;
      });
    }

    return list;
  }, [allTeamMembers, memberSearch, user?.id]);

  // Organization members who are NOT yet assigned to this project
  const availableOrgMembers = useMemo(() => {
    const currentMemberUserIds = new Set(allTeamMembers.map((m) => m.userId));
    const list = (orgMembers || []).filter((m) => {
      const uId = m.user_id || m.id;
      return uId && !currentMemberUserIds.has(uId);
    });

    if (user?.id) {
      list.sort((a, b) => {
        const aIsMe = (a.user_id === user.id || a.id === user.id || a.profiles?.id === user.id) ? 1 : 0;
        const bIsMe = (b.user_id === user.id || b.id === user.id || b.profiles?.id === user.id) ? 1 : 0;
        return bIsMe - aIsMe;
      });
    }

    return list;
  }, [orgMembers, allTeamMembers, user?.id]);

  // Handle Project Status Update
  const handleStatusChange = async (newStatus) => {
    setStatus(newStatus);
    try {
      await projectService.updateProject(
        projectId,
        { status: newStatus },
        { userRole: isOwner ? OWNER_ROLE : MANAGER_ROLE }
      );
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("project-updated", {
            detail: { id: projectId, status: newStatus, source: "project-details-page" },
          })
        );
      }
    } catch (err) {
      toast.error(err?.message || "Failed to update project status.");
      setStatus(project?.status || "active");
    }
  };

  // Sync isPinned state
  useEffect(() => {
    if (activeOrg?.id && projectId) {
      setIsPinned(isProjectPinned(activeOrg.id, user?.id, projectId));
    }
  }, [activeOrg?.id, user?.id, projectId]);

  useEffect(() => {
    const handlePinnedChange = () => {
      if (activeOrg?.id && projectId) {
        setIsPinned(isProjectPinned(activeOrg.id, user?.id, projectId));
      }
    };
    if (typeof window !== "undefined") {
      window.addEventListener("project-pinned-updated", handlePinnedChange);
      window.addEventListener("storage", handlePinnedChange);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("project-pinned-updated", handlePinnedChange);
        window.removeEventListener("storage", handlePinnedChange);
      }
    };
  }, [activeOrg?.id, user?.id, projectId]);

  const handleTogglePin = () => {
    if (!activeOrg?.id || !projectId) return;
    const nowPinned = togglePinProject(activeOrg.id, user?.id, projectId);
    setIsPinned(nowPinned);
    toast.success(
      nowPinned
        ? "Project pinned to sidebar"
        : "Project unpinned from sidebar"
    );
  };

  // Handle Adding Existing Org Member
  const handleAssignExisting = async (e) => {
    e.preventDefault();
    if (!selectedExistingUserId) {
      toast.error("Please select a workspace member to add.");
      return;
    }

    try {
      setAssigning(true);
      await projectService.assignProjectMember({
        projectId,
        userId: selectedExistingUserId,
        role: assignRole,
        assignedBy: user?.id,
      });

      setSelectedExistingUserId("");
      await loadProject(true);
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("project-updated", {
            detail: { id: projectId, source: "project-details-page" },
          })
        );
      }
    } catch (err) {
      console.error("Assign member error:", err);
      toast.error(err?.message || "Failed to add member to project.");
    } finally {
      setAssigning(false);
    }
  };

  // Handle Inviting External Member (Not in workspace yet)
  const handleInviteExternal = async (e) => {
    e.preventDefault();
    const cleanEmail = inviteEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      toast.error("Please enter a valid email address.");
      return;
    }

    try {
      setInviting(true);
      const orgId = project?.organization_id || activeOrg?.id;

      const result = await projectService.inviteToProject({
        organizationId: orgId,
        projectId,
        email: cleanEmail,
        fullName: inviteName.trim(),
        role: inviteRole,
        invitedBy: user?.id,
      });

      setLastInviteLink(result?.signupUrl || null);
      setInviteName("");
      setInviteEmail("");
      await loadInvitations(true);
    } catch (err) {
      console.error("Invite error:", err);
      toast.error(err?.message || "Failed to send invitation.");
    } finally {
      setInviting(false);
    }
  };

  // Handle Deleting / Cancelling Project Invitation
  const handleDeleteProjectInvitation = (inv) => {
    setDeleteConfirmState({
      isOpen: true,
      item: {
        name: inv.email,
        email: inv.email,
        role: inv.role,
        raw: inv,
      },
      title: "Cancel Invitation",
      subtitle: "This project invitation will be revoked immediately.",
      message: `Are you sure you want to cancel the invitation for ${inv.email}? They will no longer be able to join this project using this invite link.`,
      confirmButtonText: "Cancel Invitation",
      actionType: "invitation",
    });
  };

  // Handle Removing Member from Project
  const handleRemoveMember = (targetMember) => {
    setDeleteConfirmState({
      isOpen: true,
      item: {
        name: targetMember.name,
        email: targetMember.email,
        role: targetMember.role,
        raw: targetMember,
      },
      title: "Remove Project Member",
      subtitle: "Access to this project and its tasks will be removed.",
      message: `Are you sure you want to remove ${targetMember.name} from this project? They will lose access to all tasks and boards in this project.`,
      confirmButtonText: "Remove Member",
      actionType: "member",
    });
  };

  const handleConfirmDeleteAction = async () => {
    if (!deleteConfirmState.item?.raw) return;
    setIsDeletingConfirm(true);
    try {
      if (deleteConfirmState.actionType === "invitation") {
        const inv = deleteConfirmState.item.raw;
        await projectService.deleteProjectInvitation(inv.id, {
          email: inv.email,
          projectId,
          organizationId: project?.organization_id || activeOrg?.id,
        });
        await loadInvitations(true);
      } else if (deleteConfirmState.actionType === "member") {
        const targetMember = deleteConfirmState.item.raw;
        await projectService.removeProjectMember({
          projectId,
          userId: targetMember.userId,
          userRole: isOwner ? OWNER_ROLE : MANAGER_ROLE,
        });
        await loadProject(true);
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("project-updated", {
              detail: { id: projectId, source: "project-details-page" },
            })
          );
        }
      }
      setDeleteConfirmState((prev) => ({ ...prev, isOpen: false }));
    } catch (err) {
      console.error("Delete action error:", err);
      toast.error(err?.message || "Failed to complete action.");
    } finally {
      setIsDeletingConfirm(false);
    }
  };

  // Handle Deleting Project (Owner Only)
  const handleDeleteClick = () => {
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDeleteProject = async () => {
    setIsDeletingProject(true);
    try {
      await projectService.deleteProject(projectId, {
        userRole,
        userId: user?.id,
      });
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("project-deleted", {
            detail: { id: projectId, source: "project-details-page" },
          })
        );
      }
      setIsDeleteModalOpen(false);
      router.push("/projects");
    } catch (err) {
      toast.error(err?.message || "Failed to delete project");
    } finally {
      setIsDeletingProject(false);
    }
  };

  // Handle Copy Invitation Link
  const handleCopyLink = (url) => {
    if (!url) return;
    navigator.clipboard.writeText(url);
  };

  const statusBadgeColors = {
    planning: "bg-slate-100 text-slate-700 border-slate-300",
    active: "bg-emerald-50 text-emerald-700 border-emerald-300",
    on_hold: "bg-amber-50 text-amber-700 border-amber-300",
    completed: "bg-teal-50 text-[#0F766E] border-teal-300",
    archived: "bg-slate-100 text-slate-500 border-slate-300",
  };

  if (loading) {
    return <ProjectDetailsSkeleton />;
  }

  if (errorMsg || !project) {
    return (
      <div className="min-h-full bg-slate-50/70 p-6 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-lg border border-slate-200 p-8 text-center space-y-4 shadow-sm">
          <div className="w-12 h-12 rounded-lg bg-red-50 text-red-600 flex items-center justify-center mx-auto">
            <FiAlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Project Not Found</h2>
          <p className="text-sm text-slate-500">{errorMsg || "Unable to display this project."}</p>
          <button
            type="button"
            onClick={() => router.push("/projects")}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#0F766E] hover:bg-[#0D655E] active:bg-[#115E59] active:scale-[0.98] text-white text-xs font-bold rounded-lg shadow-md shadow-teal-900/20 transition-all cursor-pointer"
          >
            <FiArrowLeft className="w-4 h-4" />
            <span>Back to Projects</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-slate-50/60 pb-12">
      {/* Top Banner & Header */}
      <div className="bg-white/95 border-b border-slate-200/80 sticky top-0 z-10 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3.5">
            {/* Back button & Breadcrumbs */}
            <div className="flex items-center gap-2.5 min-w-0">
              <button
                type="button"
                onClick={() => router.push("/projects")}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
                title="Back to Projects"
              >
                <FiArrowLeft className="w-4 h-4" />
              </button>

              <div className="w-8 h-8 rounded-lg bg-teal-50 text-[#0F766E] border border-teal-200/60 flex items-center justify-center font-bold shrink-0">
                <FiFolder className="w-4 h-4" />
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-lg sm:text-xl font-bold text-slate-900 truncate">
                    {project.name}
                  </h1>
                  <span
                    className={`px-2 py-0.2 rounded-md text-[10px] font-semibold uppercase tracking-wider border ${
                      statusBadgeColors[status] || statusBadgeColors.active
                    }`}
                  >
                    {status}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Workspace: <span className="font-semibold text-slate-700">{activeOrg?.name || "WorkGrid"}</span>
                </p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Pin / Unpin Project from Sidebar */}
              <button
                type="button"
                onClick={handleTogglePin}
                className={`h-8 px-3 rounded-lg border text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-all cursor-pointer box-border shrink-0 ${
                  isPinned
                    ? "bg-teal-50 border-teal-300 text-[#0F766E] shadow-2xs"
                    : "bg-white border-slate-200 text-slate-700 hover:text-[#0F766E] hover:border-teal-200 hover:bg-teal-50/50"
                }`}
                title={
                  isPinned
                    ? "Pinned to sidebar • Click to unpin"
                    : "Pin project to sidebar"
                }
              >
                <LuPin
                  className={`w-3.5 h-3.5 shrink-0 ${isPinned ? "fill-current" : ""}`}
                />
                <span className="leading-none">{isPinned ? "Pinned" : "Pin to Sidebar"}</span>
              </button>

              {/* Status Selector for Owner / Manager */}
              {canManage && (
                <Select
                  value={status}
                  onChange={(val) => handleStatusChange(val)}
                  className="w-32 h-8 text-xs font-semibold"
                  options={[
                    { value: "planning", label: "Planning" },
                    { value: "active", label: "Active" },
                    { value: "on_hold", label: "On Hold" },
                    { value: "completed", label: "Completed" },
                    { value: "archived", label: "Archived" },
                  ]}
                />
              )}

              {/* Edit Project Button */}
              {canManage && (
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(true)}
                  className="btn-secondary h-8 px-3 text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer text-slate-700 hover:text-slate-900 border-slate-200 shrink-0"
                  title="Edit Project"
                >
                  <FiEdit2 className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                  <span className="leading-none">Edit Project</span>
                </button>
              )}

              {/* Open Kanban Board */}
              <button
                type="button"
                onClick={() => router.push(`/tasks?projectId=${project.id}`)}
                className="btn-primary h-8 px-3.5 text-xs font-semibold whitespace-nowrap inline-flex items-center justify-center gap-1.5 shrink-0"
              >
                <FiLayers className="w-3.5 h-3.5 shrink-0" />
                <span className="leading-none">Open Kanban Board</span>
              </button>

              {/* Delete Project Button (Owner Only) */}
              {isOwner && (
                <button
                  type="button"
                  onClick={handleDeleteClick}
                  className="btn-secondary h-8 px-3 text-xs font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 inline-flex items-center justify-center gap-1.5 shrink-0"
                  title="Delete Project"
                >
                  <FiTrash2 className="w-3.5 h-3.5 shrink-0" />
                  <span className="leading-none">Delete</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-5 space-y-5">
        {/* Project Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3.5">
          {/* Description */}
          <div className="md:col-span-2 bg-white rounded-lg border border-slate-200/80 p-4 shadow-2xs">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Project Description
            </h3>
            {project.description ? (
              <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                {project.description}
              </p>
            ) : (
              <p className="text-xs text-slate-400 italic">No description provided for this project.</p>
            )}
          </div>

          {/* Timeline Cards */}
          <div className="bg-white rounded-lg border border-slate-200/80 p-4 shadow-2xs space-y-2.5">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Schedule & Dates
            </h3>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <FiCalendar className="w-3.5 h-3.5 text-[#0F766E]" /> Start Date:
                </span>
                <span className="font-semibold text-slate-800">
                  {project.start_date
                    ? new Date(
                        String(project.start_date).includes("T")
                          ? project.start_date
                          : `${project.start_date}T00:00:00`
                      ).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                      })
                    : "Not set"}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <FiClock className="w-3.5 h-3.5 text-amber-600" /> Due Date:
                </span>
                <span className="font-semibold text-slate-800">
                  {project.due_date
                    ? new Date(
                        String(project.due_date).includes("T")
                          ? project.due_date
                          : `${project.due_date}T00:00:00`
                      ).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                      })
                    : "Not set"}
                </span>
              </div>
              <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                <span>Created</span>
                <span>
                  {new Date(project.created_at || Date.now()).toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                  })}
                </span>
              </div>
            </div>
          </div>

          {/* Team Summary Card */}
          <div className="bg-white rounded-lg border border-slate-200/80 p-4 shadow-2xs space-y-2">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Team Overview
            </h3>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-teal-50 text-[#0F766E] border border-teal-200/60 flex items-center justify-center font-bold text-lg">
                {allTeamMembers.length}
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900 leading-tight">
                  {allTeamMembers.length} {allTeamMembers.length === 1 ? "Member" : "Members"}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {(project.assignedManagers || []).length} Managers • {(project.assignedMembers || []).length} Members
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* TEAM MANAGEMENT SECTION */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Left Column (2 Cols): TOTAL TEAM LIST */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white rounded-lg border border-slate-200/80 shadow-2xs overflow-hidden">
              {/* Header with Search */}
              <div className="px-4 py-3 sm:px-5 sm:py-3.5 border-b border-slate-200/70 flex items-center justify-between gap-4 bg-slate-50/60">
                <div className="flex items-center gap-2 shrink-0">
                  <FiUsers className="w-4 h-4 text-[#0F766E] shrink-0" />
                  <h2 className="text-sm sm:text-base font-bold text-slate-900 whitespace-nowrap">
                    Team Members
                  </h2>
                </div>

                <div className="relative w-48 sm:w-64 max-w-xs shrink-0">
                  <FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Filter by name or email..."
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    className="jira-input text-xs h-8.5 !pl-8.5 pr-8 w-full"
                  />
                  {memberSearch && (
                    <button
                      type="button"
                      onClick={() => setMemberSearch("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
                      title="Clear search"
                    >
                      <FiX className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Members Table */}
              {filteredTeamMembers.length === 0 ? (
                <div className="p-8 text-center space-y-2">
                  <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                    <FiUsers className="w-4 h-4" />
                  </div>
                  <p className="text-xs font-semibold text-slate-600">No members found</p>
                  <p className="text-[11px] text-slate-400">
                    {memberSearch ? "Try adjusting your search query." : "No team members assigned to this project yet."}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 overflow-x-auto">
                  {/* Table Column Titles */}
                  <div className="grid grid-cols-12 px-4 sm:px-5 py-2.5 bg-slate-50/80 text-[10px] font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-200/60">
                    <div className="col-span-5">Name</div>
                    <div className="col-span-3">Role</div>
                    <div className="col-span-3">Email</div>
                    <div className="col-span-1 text-right">Action</div>
                  </div>

                  {filteredTeamMembers.map((member) => {
                    const initials =
                      member.name
                        ?.split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase()
                        .slice(0, 2) || "U";

                    const isTargetOwner = member.role === OWNER_ROLE;

                    return (
                      <div
                        key={member.id}
                        className="grid grid-cols-12 px-4 sm:px-5 py-3 items-center text-xs hover:bg-slate-50/70 transition-colors gap-2"
                      >
                        {/* Name with Avatar */}
                        <div className="col-span-5 flex items-center gap-2.5 min-w-0">
                          <div
                            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                              member.role === MANAGER_ROLE
                                ? "bg-purple-100 text-purple-700"
                                : "bg-teal-100 text-[#0F766E]"
                            }`}
                          >
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="font-semibold text-slate-900 truncate">
                                {member.name}
                              </p>
                              {(member.userId === user?.id || member.id === user?.id) && (
                                <span className="text-[10px] text-[#0F766E] font-semibold">
                                  (You)
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-400 font-mono">
                              ID: {member.userId?.slice(0, 8)}...
                            </span>
                          </div>
                        </div>

                        {/* Type / Role Badge */}
                        <div className="col-span-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.2 rounded-md text-[10px] font-semibold capitalize border ${
                              member.role === MANAGER_ROLE
                                ? "bg-purple-50 text-purple-700 border-purple-200"
                                : "bg-teal-50 text-[#0F766E] border-teal-200"
                            }`}
                          >
                            {member.role === MANAGER_ROLE && <FiShield className="w-3 h-3" />}
                            {member.type}
                          </span>
                        </div>

                        {/* Email */}
                        <div className="col-span-3 flex items-center gap-1.5 min-w-0 text-slate-600">
                          <FiMail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate font-mono text-[11px] text-slate-600" title={member.email}>
                            {member.email}
                          </span>
                        </div>

                        {/* Action: Remove Member */}
                        <div className="col-span-1 text-right">
                          {canManage && !isTargetOwner ? (
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
                    );
                  })}
                </div>
              )}
            </div>

            {/* PENDING PROJECT INVITATIONS */}
            {pendingInvitations.length > 0 && (
              <div className="bg-white rounded-lg border border-slate-200/80 shadow-2xs p-4 sm:p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FiSend className="w-3.5 h-3.5 text-purple-600" />
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900">
                      Pending Invitations ({pendingInvitations.length})
                    </h3>
                  </div>
                  <span className="text-[11px] text-slate-400">
                    Awaiting signup / acceptance
                  </span>
                </div>

                <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 overflow-hidden">
                  {pendingInvitations.map((inv) => (
                    <div
                      key={inv.id}
                      className="px-3.5 py-2.5 flex items-center justify-between text-xs bg-slate-50/40"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-800 truncate">
                          {inv.full_name || inv.email}
                        </p>
                        <p className="text-[10px] text-slate-400 font-mono truncate">
                          {inv.email}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] font-semibold px-2 py-0.2 rounded-md bg-amber-50 text-amber-700 border border-amber-200 uppercase">
                          {inv.status || "pending"}
                        </span>
                        <span className="text-[10px] font-semibold px-2 py-0.2 rounded-md bg-purple-50 text-purple-700 capitalize border border-purple-200">
                          {inv.intended_role || inv.role || "member"}
                        </span>
                        {canManage && (
                          <button
                            type="button"
                            onClick={() => handleDeleteProjectInvitation(inv)}
                            className="p-1 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer ml-1"
                            title="Cancel / Delete Invitation"
                          >
                            <FiTrash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column (1 Col): ADD MEMBER / INVITE PANEL */}
          <div className="space-y-4">
            {canManage ? (
              <div className="bg-white rounded-lg border border-slate-200/80 shadow-2xs p-4 sm:p-5 space-y-4">
                {/* Header */}
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-teal-50 text-[#0F766E] border border-teal-200/70 flex items-center justify-center font-bold">
                    <FiUserPlus className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900">
                      Add & Invite Members
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Assign team or invite external users
                    </p>
                  </div>
                </div>

                {/* Sub-Tabs: Existing Member vs Invite External */}
                <div className="flex rounded-lg bg-slate-100/80 p-1 text-xs font-semibold border border-slate-200/60">
                  <button
                    type="button"
                    onClick={() => setAddMode("existing")}
                    className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer ${
                      addMode === "existing"
                        ? "bg-white text-[#0F766E] shadow-2xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    From Workspace
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddMode("invite")}
                    className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer ${
                      addMode === "invite"
                        ? "bg-white text-[#0F766E] shadow-2xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Send Invite
                  </button>
                </div>

                {/* MODE 1: ASSIGN EXISTING WORKSPACE MEMBER */}
                {addMode === "existing" && (
                  availableOrgMembers.length === 0 ? (
                    <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 text-center space-y-2">
                      <p className="text-xs text-slate-600 font-medium">
                        All workspace members are already assigned to this project.
                      </p>
                      <button
                        type="button"
                        onClick={() => setAddMode("invite")}
                        className="text-xs font-bold text-[#0F766E] hover:text-teal-800 transition-colors cursor-pointer inline-flex items-center gap-1"
                      >
                        <span>Invite a new teammate →</span>
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleAssignExisting} className="space-y-3">
                      <div>
                        <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                          Select Workspace Member
                        </label>
                        <Select
                          value={selectedExistingUserId || undefined}
                          onChange={(val) => setSelectedExistingUserId(val || "")}
                          className="w-full text-xs font-medium"
                          placeholder="Choose a team member"
                          allowClear
                          options={availableOrgMembers.map((m) => {
                            const prof = m.profiles || {};
                            const mName = prof.full_name || prof.email || "Member";
                            const mEmail = prof.email ? `(${prof.email})` : "";
                            const isMe = user?.id && (m.user_id === user.id || m.id === user.id);
                            return {
                              value: m.user_id || m.id,
                              label: `${mName} ${isMe ? "(You) " : ""}${mEmail}`.trim(),
                            };
                          })}
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                          Assign Project Role
                        </label>
                        <Select
                          value={assignRole}
                          onChange={(val) => setAssignRole(val)}
                          className="w-full text-xs font-medium"
                          options={[
                            { value: MEMBER_ROLE, label: "Member (Tasks & Boards)" },
                            { value: MANAGER_ROLE, label: "Project Manager (Manage Team & Settings)" },
                          ]}
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={assigning}
                        className="btn-primary w-full py-2 text-xs font-semibold"
                      >
                        {assigning ? "Adding Member..." : "Add Member to Project"}
                      </button>
                    </form>
                  )
                )}

                {/* MODE 2: INVITE EXTERNAL USER (NOT IN TEAM YET) */}
                {addMode === "invite" && (
                  <form onSubmit={handleInviteExternal} className="space-y-3">
                    <div>
                      <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                        Full Name (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Alex Johnson"
                        value={inviteName}
                        onChange={(e) => setInviteName(e.target.value)}
                        className="jira-input w-full text-xs h-8.5 px-3"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                        Email Address *
                      </label>
                      <input
                        type="email"
                        placeholder="colleague@example.com"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        className="jira-input w-full text-xs h-8.5 px-3"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                        Intended Project Role
                      </label>
                      <Select
                        value={inviteRole}
                        onChange={(val) => setInviteRole(val)}
                        className="w-full text-xs font-medium"
                        options={[
                          { value: MEMBER_ROLE, label: "Member" },
                          { value: MANAGER_ROLE, label: "Project Manager" },
                        ]}
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={inviting}
                      className="btn-primary w-full py-2 text-xs font-semibold"
                    >
                      <FiSend className="w-3.5 h-3.5" />
                      <span>{inviting ? "Sending..." : "Send Invitation"}</span>
                    </button>

                    {lastInviteLink && (
                      <div className="p-3 bg-teal-50/70 border border-teal-200 rounded-lg space-y-1.5">
                        <p className="text-[11px] font-semibold text-teal-900">
                          Invitation Link Generated:
                        </p>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            readOnly
                            value={lastInviteLink}
                            className="jira-input text-[11px] font-mono h-7.5 px-2 bg-white text-slate-600 select-all flex-1"
                          />
                          <button
                            type="button"
                            onClick={() => handleCopyLink(lastInviteLink)}
                            className="p-1.5 bg-white border border-teal-200 text-[#0F766E] hover:bg-teal-100 rounded-lg shrink-0 cursor-pointer"
                            title="Copy invitation link"
                          >
                            <FiCopy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </form>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-lg border border-slate-200/80 p-5 shadow-2xs space-y-2 text-center">
                <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                  <FiShield className="w-4 h-4" />
                </div>
                <h4 className="text-xs font-bold text-slate-800">Team Management Restricted</h4>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Only the Workspace Owner or Project Managers can add or remove members from this project.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete Project Confirmation Modal */}
      <DeleteProjectConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleConfirmDeleteProject}
        isLoading={isDeletingProject}
        projectName={project?.name}
      />

      {/* Edit Project Modal */}
      {isEditModalOpen && project && (
        <EditProjectModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          project={project}
          organizationId={project.organization_id || activeOrg?.id}
          organizationName={activeOrg?.name}
          currentUserRole={userRole}
          currentUserId={user?.id}
          existingMembers={orgMembers}
          onProjectUpdated={(updatedProject) => {
            setIsEditModalOpen(false);
            if (updatedProject) {
              setProject(updatedProject);
              setStatus(updatedProject.status || "active");
            }
            loadProject(true);
          }}
        />
      )}

      {/* Delete / Remove Confirmation Modal (Members & Invitations) */}
      <DeleteConfirmModal
        isOpen={deleteConfirmState.isOpen}
        onClose={() => setDeleteConfirmState((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={handleConfirmDeleteAction}
        isLoading={isDeletingConfirm}
        title={deleteConfirmState.title}
        subtitle={deleteConfirmState.subtitle}
        message={deleteConfirmState.message}
        confirmButtonText={deleteConfirmState.confirmButtonText}
        item={deleteConfirmState.item}
      />
    </div>
  );
}
