"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSelector } from "react-redux";
import Link from "next/link";
import { toast } from "react-toastify";
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
} from "react-icons/fi";
import { useOrganization } from "@/context/OrganizationContext";
import projectService from "@/services/project.service";
import organizationService from "@/services/organization.service";
import { MEMBER_ROLE, MANAGER_ROLE, OWNER_ROLE } from "@/utils/constants";

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
    if (!memberSearch.trim()) return allTeamMembers;
    const q = memberSearch.toLowerCase();
    return allTeamMembers.filter(
      (m) =>
        m.name?.toLowerCase().includes(q) ||
        m.email?.toLowerCase().includes(q) ||
        m.type?.toLowerCase().includes(q)
    );
  }, [allTeamMembers, memberSearch]);

  // Organization members who are NOT yet assigned to this project
  const availableOrgMembers = useMemo(() => {
    const currentMemberUserIds = new Set(allTeamMembers.map((m) => m.userId));
    return (orgMembers || []).filter((m) => {
      const uId = m.user_id || m.id;
      return uId && !currentMemberUserIds.has(uId);
    });
  }, [orgMembers, allTeamMembers]);

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
  const handleDeleteProjectInvitation = async (inv) => {
    if (!confirm(`Are you sure you want to cancel the invitation for ${inv.email}?`)) {
      return;
    }

    try {
      await projectService.deleteProjectInvitation(inv.id, {
        email: inv.email,
        projectId,
        organizationId: project?.organization_id || activeOrg?.id,
      });

      await loadInvitations(true);
    } catch (err) {
      console.error("Delete invitation error:", err);
      toast.error(err?.message || "Failed to cancel invitation.");
    }
  };

  // Handle Removing Member from Project
  const handleRemoveMember = async (targetMember) => {
    if (!confirm(`Are you sure you want to remove ${targetMember.name} from this project?`)) {
      return;
    }

    try {
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
    } catch (err) {
      console.error("Remove member error:", err);
      toast.error(err?.message || "Failed to remove member.");
    }
  };

  // Handle Deleting Project (Owner Only)
  const handleDeleteProject = async () => {
    if (!confirm(`Are you sure you want to delete project "${project?.name}"?`)) return;
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
      router.push("/projects");
    } catch (err) {
      toast.error(err?.message || "Failed to delete project");
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
    return (
      <div className="min-h-full bg-slate-50/70 p-6 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <div className="w-8 h-8 border-3 border-[#0F766E] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-semibold">Loading project details...</p>
        </div>
      </div>
    );
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
      <div className="bg-white border-b border-slate-200/80 sticky top-0 z-10 backdrop-blur-md bg-white/95">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Back button & Breadcrumbs */}
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => router.push("/projects")}
                className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
                title="Back to Projects"
              >
                <FiArrowLeft className="w-5 h-5" />
              </button>

              <div className="w-10 h-10 rounded-lg bg-[#0F766E] text-white flex items-center justify-center font-bold shrink-0 shadow-sm shadow-teal-900/20">
                <FiFolder className="w-5 h-5" />
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl font-black text-slate-900 truncate">
                    {project.name}
                  </h1>
                  <span
                    className={`px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider border ${
                      statusBadgeColors[status] || statusBadgeColors.active
                    }`}
                  >
                    {status}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Workspace: <span className="font-semibold text-slate-700">{activeOrg?.name || "WorkGrid"}</span>
                </p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2.5 shrink-0">
              {/* Status Selector for Owner / Manager */}
              {canManage && (
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Status:</span>
                  <select
                    value={status}
                    onChange={(e) => handleStatusChange(e.target.value)}
                    className="bg-transparent font-bold text-slate-800 outline-none cursor-pointer text-xs"
                  >
                    <option value="planning">Planning</option>
                    <option value="active">Active</option>
                    <option value="on_hold">On Hold</option>
                    <option value="completed">Completed</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
              )}

              {/* Open Kanban Board */}
              <button
                type="button"
                onClick={() => router.push(`/projects?projectId=${project.id}`)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#0F766E] hover:bg-[#0D655E] active:bg-[#115E59] active:scale-[0.98] text-white text-xs font-bold rounded-lg shadow-md shadow-teal-900/20 transition-all cursor-pointer"
              >
                <FiLayers className="w-4 h-4" />
                <span>Open Kanban Board</span>
              </button>

              {/* Delete Project Button (Owner Only) */}
              {isOwner && (
                <button
                  type="button"
                  onClick={handleDeleteProject}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-200 rounded-lg text-xs font-bold transition-all cursor-pointer"
                  title="Delete Project"
                >
                  <FiTrash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        {/* Project Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Description */}
          <div className="md:col-span-2 bg-white rounded-lg border border-slate-200/80 p-5 shadow-2xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Project Description
            </h3>
            {project.description ? (
              <p className="text-sm text-slate-700 leading-relaxed">
                {project.description}
              </p>
            ) : (
              <p className="text-xs text-slate-400 italic">No description provided for this project.</p>
            )}
          </div>

          {/* Timeline Cards */}
          <div className="bg-white rounded-lg border border-slate-200/80 p-5 shadow-2xs space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Schedule & Dates
            </h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <FiCalendar className="w-3.5 h-3.5 text-[#0F766E]" /> Start Date:
                </span>
                <span className="font-bold text-slate-800">
                  {project.start_date ? new Date(project.start_date).toLocaleDateString() : "Not set"}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <FiClock className="w-3.5 h-3.5 text-amber-600" /> Due Date:
                </span>
                <span className="font-bold text-slate-800">
                  {project.due_date ? new Date(project.due_date).toLocaleDateString() : "Not set"}
                </span>
              </div>
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                <span>Created</span>
                <span>{new Date(project.created_at || Date.now()).toLocaleDateString()}</span>
              </div>
            </div>
          </div>

          {/* Team Summary Card */}
          <div className="bg-white rounded-lg border border-slate-200/80 p-5 shadow-2xs space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Team Overview
            </h3>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-teal-50 text-[#0F766E] flex items-center justify-center font-black text-xl">
                {allTeamMembers.length}
              </div>
              <div>
                <p className="text-base font-black text-slate-900 leading-tight">
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column (2 Cols): TOTAL TEAM LIST */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white rounded-lg border border-slate-200/80 shadow-2xs overflow-hidden">
              {/* Header with Search */}
              <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
                <div>
                  <div className="flex items-center gap-2">
                    <FiUsers className="w-4 h-4 text-[#0F766E]" />
                    <h2 className="text-base font-black text-slate-900">
                      Total Team List
                    </h2>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-lg bg-teal-100 text-[#0F766E]">
                      {allTeamMembers.length}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Assigned project managers and team members
                  </p>
                </div>

                {/* Member Search input */}
                <input
                  type="text"
                  placeholder="Filter by name or email..."
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 bg-white outline-none focus:border-[#0F766E] w-full sm:w-60 text-slate-800"
                />
              </div>

              {/* Members Table */}
              {filteredTeamMembers.length === 0 ? (
                <div className="p-8 text-center space-y-2">
                  <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                    <FiUsers className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-semibold text-slate-600">No members found</p>
                  <p className="text-[11px] text-slate-400">
                    {memberSearch ? "Try adjusting your search query." : "No team members assigned to this project yet."}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 overflow-x-auto">
                  {/* Table Column Titles */}
                  <div className="grid grid-cols-12 px-5 py-2.5 bg-slate-50/70 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    <div className="col-span-5">Name</div>
                    <div className="col-span-3">Type / Role</div>
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
                        className="grid grid-cols-12 px-5 py-3.5 items-center text-xs hover:bg-slate-50/70 transition-colors gap-2"
                      >
                        {/* Name with Avatar */}
                        <div className="col-span-5 flex items-center gap-3 min-w-0">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                              member.role === MANAGER_ROLE
                                ? "bg-purple-100 text-purple-700"
                                : "bg-teal-100 text-[#0F766E]"
                            }`}
                          >
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 truncate">
                              {member.name}
                            </p>
                            <span className="text-[10px] text-slate-400">
                              ID: {member.userId?.slice(0, 8)}...
                            </span>
                          </div>
                        </div>

                        {/* Type / Role Badge */}
                        <div className="col-span-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[10px] font-bold capitalize border ${
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
                          <span className="truncate font-mono text-[11px]" title={member.email}>
                            {member.email}
                          </span>
                        </div>

                        {/* Action: Remove Member */}
                        <div className="col-span-1 text-right">
                          {canManage && !isTargetOwner ? (
                            <button
                              type="button"
                              onClick={() => handleRemoveMember(member)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                              title={`Remove ${member.name} from project`}
                            >
                              <FiTrash2 className="w-4 h-4" />
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
              <div className="bg-white rounded-lg border border-slate-200/80 shadow-2xs p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FiSend className="w-4 h-4 text-purple-600" />
                    <h3 className="text-sm font-bold text-slate-900">
                      Pending Invitations ({pendingInvitations.length})
                    </h3>
                  </div>
                  <span className="text-[11px] text-slate-400">
                    Awaiting signup / acceptance
                  </span>
                </div>

                <div className="divide-y divide-slate-100 rounded-lg border border-slate-200/70 overflow-hidden">
                  {pendingInvitations.map((inv) => (
                    <div
                      key={inv.id}
                      className="px-4 py-2.5 flex items-center justify-between text-xs bg-slate-50/40"
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
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 uppercase">
                          {inv.status || "pending"}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-purple-50 text-purple-700 capitalize">
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
              <div className="bg-white rounded-lg border border-slate-200/80 shadow-2xs p-5 space-y-4">
                {/* Header */}
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-teal-100 text-[#0F766E] flex items-center justify-center font-bold">
                    <FiUserPlus className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900">
                      Add & Invite Members
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Assign team or invite external users
                    </p>
                  </div>
                </div>

                {/* Sub-Tabs: Existing Member vs Invite External */}
                <div className="flex rounded-lg bg-slate-100 p-1 text-xs font-bold">
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
                    <form onSubmit={handleAssignExisting} className="space-y-3.5">
                      <div>
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                          Select Workspace Member
                        </label>
                        <select
                          value={selectedExistingUserId}
                          onChange={(e) => setSelectedExistingUserId(e.target.value)}
                          className="w-full text-xs font-semibold px-3 py-2 rounded-lg border border-slate-200 bg-white outline-none focus:border-[#0F766E] text-slate-800"
                          required
                        >
                          <option value="">-- Choose a team member --</option>
                          {availableOrgMembers.map((m) => {
                            const prof = m.profiles || {};
                            const mName = prof.full_name || prof.email || "Member";
                            const mEmail = prof.email ? `(${prof.email})` : "";
                            return (
                              <option key={m.id || m.user_id} value={m.user_id || m.id}>
                                {mName} {mEmail}
                              </option>
                            );
                          })}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                          Assign Project Role
                        </label>
                        <select
                          value={assignRole}
                          onChange={(e) => setAssignRole(e.target.value)}
                          className="w-full text-xs font-semibold px-3 py-2 rounded-lg border border-slate-200 bg-white outline-none focus:border-[#0F766E] text-slate-800"
                        >
                          <option value={MEMBER_ROLE}>Member (Tasks & Boards)</option>
                          <option value={MANAGER_ROLE}>Project Manager (Manage Team & Settings)</option>
                        </select>
                      </div>

                      <button
                        type="submit"
                        disabled={assigning}
                        className="w-full py-2.5 bg-[#0F766E] hover:bg-[#0D655E] active:bg-[#115E59] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold rounded-lg transition-all shadow-md shadow-teal-900/20 cursor-pointer"
                      >
                        {assigning ? "Adding Member..." : "Add Member to Project"}
                      </button>
                    </form>
                  )
                )}

                {/* MODE 2: INVITE EXTERNAL USER (NOT IN TEAM YET) */}
                {addMode === "invite" && (
                  <form onSubmit={handleInviteExternal} className="space-y-3.5">
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                        Full Name (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Alex Johnson"
                        value={inviteName}
                        onChange={(e) => setInviteName(e.target.value)}
                        className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 bg-white outline-none focus:border-[#0F766E] text-slate-800"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                        Email Address *
                      </label>
                      <input
                        type="email"
                        placeholder="colleague@example.com"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 bg-white outline-none focus:border-[#0F766E] text-slate-800"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                        Intended Project Role
                      </label>
                      <select
                        value={inviteRole}
                        onChange={(e) => setInviteRole(e.target.value)}
                        className="w-full text-xs font-semibold px-3 py-2 rounded-lg border border-slate-200 bg-white outline-none focus:border-[#0F766E] text-slate-800"
                      >
                        <option value={MEMBER_ROLE}>Member</option>
                        <option value={MANAGER_ROLE}>Project Manager</option>
                      </select>
                    </div>

                    <button
                      type="submit"
                      disabled={inviting}
                      className="w-full py-2.5 bg-[#0F766E] hover:bg-[#0D655E] active:bg-[#115E59] active:scale-[0.98] text-white text-xs font-bold rounded-lg transition-all shadow-md shadow-teal-900/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <FiSend className="w-3.5 h-3.5" />
                      <span>{inviting ? "Sending Request..." : "Send Project Invitation"}</span>
                    </button>

                    {lastInviteLink && (
                      <div className="p-3 bg-teal-50/70 border border-teal-200 rounded-lg space-y-1.5">
                        <p className="text-[11px] font-bold text-teal-900">
                          Invitation Link Generated:
                        </p>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            readOnly
                            value={lastInviteLink}
                            className="text-[10px] font-mono px-2 py-1 bg-white border border-teal-200 rounded-lg w-full text-slate-600 select-all"
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
                <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                  <FiShield className="w-5 h-5" />
                </div>
                <h4 className="text-xs font-bold text-slate-800">Team Management Restricted</h4>
                <p className="text-[11px] text-slate-400">
                  Only the Workspace Owner or Project Managers can add or remove members from this project.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
