"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { toast } from "react-toastify";
import {
  FiEdit2,
  FiX,
  FiCheck,
  FiUsers,
  FiShield,
  FiCalendar,
  FiClock,
  FiInfo,
  FiAlertCircle,
  FiPlus,
  FiTrash2,
  FiMail,
  FiSearch,
} from "react-icons/fi";
import { supabase } from "@/lib/supabaseconfig";
import { LuPin } from "react-icons/lu";
import { Select, DatePicker } from "antd";
import dayjs from "dayjs";
import projectService from "@/services/project.service";
import { MEMBER_ROLE, MANAGER_ROLE, OWNER_ROLE } from "@/utils/constants";
import { isProjectPinned, pinProject, unpinProject } from "@/utils/pinnedProjects";
import Portal from "@/components/Portal";

/**
 * Format a date string or timestamp into YYYY-MM-DD for standard HTML date input.
 */
function formatDateForInput(dateVal) {
  if (!dateVal) return "";
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return "";
    return d.toISOString().split("T")[0];
  } catch {
    return "";
  }
}

/**
 * Dedicated core function to execute an update on an existing project.
 * Updates project metadata, syncs team membership changes (without recreating duplicates),
 * dispatches invitations, and keeps local cache in sync.
 *
 * @param {string} projectId
 * @param {Object} projectData
 * @param {Object} context - { currentUserRole, currentUserId, organizationId }
 * @returns {Promise<Object>} The updated and normalized project object.
 */
export async function executeEditProject(projectId, projectData, context = {}) {
  const {
    name,
    description = "",
    status = "active",
    startDate = null,
    dueDate = null,
    selectedManagerIds = [],
    selectedMemberIds = [],
    initialManagerIds = [],
    initialMemberIds = [],
    newInvitations = [],
  } = projectData;

  const { currentUserRole = MEMBER_ROLE, currentUserId = null, organizationId = null } = context;

  if (!projectId) {
    throw new Error("Project ID is required for editing.");
  }

  if (currentUserRole === MEMBER_ROLE) {
    throw new Error("Members are not authorized to edit project settings.");
  }

  if (!name || !name.trim()) {
    throw new Error("Project name cannot be empty.");
  }

  if (startDate && dueDate && new Date(dueDate) < new Date(startDate)) {
    throw new Error("Due date cannot be earlier than start date.");
  }

  // 1. Update project metadata in Supabase (or fallback to local cache)
  const updatePayload = {
    name: name.trim(),
    description: description.trim(),
    status,
    start_date: startDate || null,
    due_date: dueDate || null,
    updated_at: new Date().toISOString(),
  };

  let updatedRecord = null;
  try {
    const { data, error } = await supabase
      .from("projects")
      .update(updatePayload)
      .eq("id", projectId)
      .select()
      .single();

    if (!error && data) {
      updatedRecord = data;
    }
  } catch (err) {
    console.warn("Supabase project update notice:", err?.message || err);
  }

  if (!updatedRecord) {
    updatedRecord = { id: projectId, ...updatePayload };
  }

  projectService.updateLocalProject(projectId, updatedRecord);

  // 2. Reconcile Team Members (diffing initial vs current selections)
  const isOwner = currentUserRole === OWNER_ROLE;

  // Managers to add or switch to manager
  const managersToAdd = selectedManagerIds.filter(
    (id) => id && !initialManagerIds.includes(id)
  );

  // Members to add or switch to member
  const membersToAdd = selectedMemberIds.filter(
    (id) => id && !initialMemberIds.includes(id)
  );

  // Managers removed
  const managersToRemove = initialManagerIds.filter(
    (id) => id && !selectedManagerIds.includes(id) && !selectedMemberIds.includes(id)
  );

  // Members removed
  const membersToRemove = initialMemberIds.filter(
    (id) => id && !selectedMemberIds.includes(id) && !selectedManagerIds.includes(id)
  );

  // A. Handle removals
  const allToRemove = [...new Set([...managersToRemove, ...membersToRemove])];
  for (const userId of allToRemove) {
    try {
      await projectService.removeProjectMember({
        projectId,
        userId,
        userRole: currentUserRole,
        callerId: currentUserId,
      });
    } catch (e) {
      console.warn("Notice removing project member:", userId, e?.message || e);
    }
  }

  // B. Handle manager additions/switches
  for (const userId of managersToAdd) {
    try {
      if (initialMemberIds.includes(userId)) {
        // Was member, now upgraded to manager
        await supabase
          .from("project_members")
          .update({ role: MANAGER_ROLE, updated_at: new Date().toISOString() })
          .eq("project_id", projectId)
          .eq("user_id", userId);
        projectService.saveLocalProjectMembers([
          { project_id: projectId, user_id: userId, role: MANAGER_ROLE },
        ]);
      } else {
        // Brand new addition as manager
        await projectService.assignProjectMember({
          projectId,
          userId,
          role: MANAGER_ROLE,
          assignedBy: currentUserId,
        });
      }
    } catch (e) {
      console.warn("Notice assigning project manager:", userId, e?.message || e);
    }
  }

  // C. Handle member additions/switches
  for (const userId of membersToAdd) {
    try {
      if (initialManagerIds.includes(userId)) {
        // Was manager, now changed to member
        await supabase
          .from("project_members")
          .update({ role: MEMBER_ROLE, updated_at: new Date().toISOString() })
          .eq("project_id", projectId)
          .eq("user_id", userId);
        projectService.saveLocalProjectMembers([
          { project_id: projectId, user_id: userId, role: MEMBER_ROLE },
        ]);
      } else {
        // Brand new addition as member
        await projectService.assignProjectMember({
          projectId,
          userId,
          role: MEMBER_ROLE,
          assignedBy: currentUserId,
        });
      }
    } catch (e) {
      console.warn("Notice assigning project member:", userId, e?.message || e);
    }
  }

  // 3. Process any new invitations
  if (newInvitations && newInvitations.length > 0 && organizationId) {
    for (const inv of newInvitations) {
      try {
        await projectService.inviteToProject({
          organizationId,
          projectId,
          email: inv.email,
          fullName: inv.fullName,
          role: inv.role || MEMBER_ROLE,
          invitedBy: currentUserId,
        });
      } catch (invErr) {
        console.error("Edit project: invitation creation error:", invErr);
      }
    }
  }

  // 4. Invalidate caches and fetch fresh normalized project
  projectService.clearProjectsCache();

  let refreshedProject = null;
  try {
    refreshedProject = await projectService.getProjectById(
      projectId,
      { userId: currentUserId, userRole: currentUserRole },
      true
    );
  } catch (_) {}

  if (!refreshedProject) {
    refreshedProject = {
      ...updatedRecord,
      assignedManagers: selectedManagerIds.map((id) => ({ id, userId: id, role: MANAGER_ROLE })),
      assignedMembers: selectedMemberIds.map((id) => ({ id, userId: id, role: MEMBER_ROLE })),
      totalTeamCount: selectedManagerIds.length + selectedMemberIds.length,
    };
  }

  // Notify the rest of the application
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("project-updated", { detail: refreshedProject })
    );
  }

  return refreshedProject;
}

/**
 * EditProjectModal Component
 *
 * Dedicated modal providing the full Edit Project functionality:
 * - Update project name, description, status, start date, due date
 * - Sync assigned managers and members
 * - Send new project invitations
 * - Ensures project is updated directly by ID without creating duplicate entries
 */
export default function EditProjectModal({
  isOpen,
  onClose,
  project,
  projectId = null,
  organizationId = null,
  organizationName = "Workspace",
  currentUserId = null,
  currentUserRole = MEMBER_ROLE,
  existingMembers = [],
  onProjectUpdated = null,
}) {
  const overlayRef = useRef(null);

  const targetProjectId = project?.id || projectId;
  const targetOrgId = project?.organization_id || organizationId;

  // Active Tab: 'general' | 'team' | 'invite'
  const [activeTab, setActiveTab] = useState("general");

  // Form Fields
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("active");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [pinToSidebar, setPinToSidebar] = useState(false);

  // Team Selection
  const [selectedManagerIds, setSelectedManagerIds] = useState([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState([]);

  // Initial team states (to compute diff on save)
  const [initialManagerIds, setInitialManagerIds] = useState([]);
  const [initialMemberIds, setInitialMemberIds] = useState([]);

  // Search & View All for Team Selection
  const [managerSearch, setManagerSearch] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const [showAllManagers, setShowAllManagers] = useState(false);
  const [showAllMembers, setShowAllMembers] = useState(false);

  // New Invitations
  const [newInvites, setNewInvites] = useState([]);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState(MEMBER_ROLE);

  // States
  const [loading, setLoading] = useState(false);
  const [fetchingDetails, setFetchingDetails] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const isOwner = currentUserRole === OWNER_ROLE;
  const isManager = currentUserRole === MANAGER_ROLE;
  const canManageManagers = isOwner;

  // Local members state that syncs with props and auto-fetches if empty
  const [internalMembers, setInternalMembers] = useState(existingMembers || []);

  useEffect(() => {
    if (existingMembers && existingMembers.length > 0) {
      setInternalMembers(existingMembers);
    }
  }, [existingMembers]);

  // Fetch workspace members if not already populated
  useEffect(() => {
    if (isOpen && targetOrgId && internalMembers.length === 0) {
      import("@/services/organization.service")
        .then((mod) =>
          (mod.default || mod.organizationService).getOrganizationMembers(
            targetOrgId,
            { currentUserId, currentUserRole }
          )
        )
        .then((data) => {
          if (data && data.length > 0) {
            setInternalMembers(data);
          }
        })
        .catch(() => {});
    }
  }, [isOpen, targetOrgId, currentUserId, currentUserRole, internalMembers.length]);

  const activeMembers =
    internalMembers.length > 0 ? internalMembers : existingMembers || [];

  // Separate org members into managers and members (keeping current user first)
  const orgManagers = useMemo(() => {
    const list = activeMembers.filter(
      (m) => m.role === MANAGER_ROLE || m.role === OWNER_ROLE
    );
    if (currentUserId) {
      list.sort((a, b) => {
        const aIsMe =
          a.user_id === currentUserId ||
          a.id === currentUserId ||
          a.profiles?.id === currentUserId
            ? 1
            : 0;
        const bIsMe =
          b.user_id === currentUserId ||
          b.id === currentUserId ||
          b.profiles?.id === currentUserId
            ? 1
            : 0;
        return bIsMe - aIsMe;
      });
    }
    return list;
  }, [activeMembers, currentUserId]);

  const orgMembers = useMemo(() => {
    const list = activeMembers.filter((m) => m.role === MEMBER_ROLE);
    if (currentUserId) {
      list.sort((a, b) => {
        const aIsMe =
          a.user_id === currentUserId ||
          a.id === currentUserId ||
          a.profiles?.id === currentUserId
            ? 1
            : 0;
        const bIsMe =
          b.user_id === currentUserId ||
          b.id === currentUserId ||
          b.profiles?.id === currentUserId
            ? 1
            : 0;
        return bIsMe - aIsMe;
      });
    }
    return list;
  }, [activeMembers, currentUserId]);

  // Filtered & Displayed Managers
  const filteredManagers = useMemo(() => {
    const q = managerSearch.trim().toLowerCase();
    if (!q) return orgManagers;
    return orgManagers.filter((mgr) => {
      const profile = mgr.profiles || mgr;
      const mName = (mgr.full_name || profile?.full_name || "").toLowerCase();
      const mEmail = (mgr.email || profile?.email || "").toLowerCase();
      return mName.includes(q) || mEmail.includes(q);
    });
  }, [orgManagers, managerSearch]);

  const isSearchingManagers = Boolean(managerSearch.trim());
  const displayedManagers = useMemo(() => {
    if (isSearchingManagers) return filteredManagers;
    return showAllManagers ? filteredManagers : filteredManagers.slice(0, 4);
  }, [isSearchingManagers, showAllManagers, filteredManagers]);

  // Filtered & Displayed Members
  const filteredMembers = useMemo(() => {
    const q = memberSearch.trim().toLowerCase();
    if (!q) return orgMembers;
    return orgMembers.filter((mem) => {
      const profile = mem.profiles || mem;
      const mName = (mem.full_name || profile?.full_name || "").toLowerCase();
      const mEmail = (mem.email || profile?.email || "").toLowerCase();
      return mName.includes(q) || mEmail.includes(q);
    });
  }, [orgMembers, memberSearch]);

  const isSearchingMembers = Boolean(memberSearch.trim());
  const displayedMembers = useMemo(() => {
    if (isSearchingMembers) return filteredMembers;
    return showAllMembers ? filteredMembers : filteredMembers.slice(0, 4);
  }, [isSearchingMembers, showAllMembers, filteredMembers]);

  // Populate form fields whenever the modal opens or the target project changes
  useEffect(() => {
    if (!isOpen) return;

    setErrorMsg("");
    setActiveTab("general");
    setNewInvites([]);
    setInviteName("");
    setInviteEmail("");
    setInviteRole(MEMBER_ROLE);
    setManagerSearch("");
    setMemberSearch("");
    setShowAllManagers(false);
    setShowAllMembers(false);

    const initFromProject = (data) => {
      if (!data) return;
      setName(data.name || "");
      setDescription(data.description || "");
      setStatus(data.status || "active");
      setStartDate(formatDateForInput(data.start_date));
      setDueDate(formatDateForInput(data.due_date));
      setPinToSidebar(isProjectPinned(targetOrgId, currentUserId, targetProjectId));

      // Extract existing assigned managers
      const mgrIds = [];
      if (Array.isArray(data.assignedManagers)) {
        data.assignedManagers.forEach((m) => {
          const id = m.userId || m.id;
          if (id && !mgrIds.includes(id)) mgrIds.push(id);
        });
      }
      if (Array.isArray(data.project_members)) {
        data.project_members.forEach((pm) => {
          if (pm.role === MANAGER_ROLE) {
            const id = pm.user_id || pm.userId;
            if (id && !mgrIds.includes(id)) mgrIds.push(id);
          }
        });
      }

      // Extract existing assigned members
      const memIds = [];
      if (Array.isArray(data.assignedMembers)) {
        data.assignedMembers.forEach((m) => {
          const id = m.userId || m.id;
          if (id && !memIds.includes(id) && !mgrIds.includes(id)) memIds.push(id);
        });
      }
      if (Array.isArray(data.project_members)) {
        data.project_members.forEach((pm) => {
          if (pm.role === MEMBER_ROLE) {
            const id = pm.user_id || pm.userId;
            if (id && !memIds.includes(id) && !mgrIds.includes(id)) memIds.push(id);
          }
        });
      }

      setSelectedManagerIds(mgrIds);
      setSelectedMemberIds(memIds);
      setInitialManagerIds(mgrIds);
      setInitialMemberIds(memIds);
    };

    if (project) {
      initFromProject(project);
    } else if (targetProjectId) {
      // If only project ID was passed, fetch the full project
      setFetchingDetails(true);
      projectService
        .getProjectById(
          targetProjectId,
          { userId: currentUserId, userRole: currentUserRole },
          true
        )
        .then((data) => {
          if (data) initFromProject(data);
        })
        .catch((err) => {
          console.error("Failed to load project details for editing:", err);
          setErrorMsg("Failed to load project details.");
        })
        .finally(() => {
          setFetchingDetails(false);
        });
    }
  }, [isOpen, project, targetProjectId, currentUserId, currentUserRole]);

  // Handle escape key to close
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape" && !loading) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, loading, onClose]);

  if (!isOpen) return null;

  const handleOverlayClick = (e) => {
    if (e.target === overlayRef.current && !loading) onClose();
  };

  const toggleManager = (id) => {
    if (!id || !canManageManagers) return;
    setSelectedManagerIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
    // Remove from members if selected as manager
    setSelectedMemberIds((prev) => prev.filter((i) => i !== id));
  };

  const toggleMember = (id) => {
    if (!id) return;
    setSelectedMemberIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
    // Remove from managers if selected as member
    setSelectedManagerIds((prev) => prev.filter((i) => i !== id));
  };

  // Toggle select for currently displayed managers
  const isAllDisplayedManagersSelected =
    displayedManagers.length > 0 &&
    displayedManagers.every((m) =>
      selectedManagerIds.includes(m.user_id || m.id)
    );

  const handleToggleSelectManagers = () => {
    if (!canManageManagers) return;
    const displayedIds = displayedManagers
      .map((m) => m.user_id || m.id)
      .filter(Boolean);
    if (isAllDisplayedManagersSelected) {
      setSelectedManagerIds((prev) =>
        prev.filter((id) => !displayedIds.includes(id))
      );
    } else {
      setSelectedManagerIds((prev) => [
        ...prev,
        ...displayedIds.filter((id) => !prev.includes(id)),
      ]);
      // Remove any newly selected managers from member selections
      setSelectedMemberIds((prev) =>
        prev.filter((id) => !displayedIds.includes(id))
      );
    }
  };

  // Toggle select for currently displayed members
  const isAllDisplayedMembersSelected =
    displayedMembers.length > 0 &&
    displayedMembers.every((m) =>
      selectedMemberIds.includes(m.user_id || m.id)
    );

  const handleToggleSelectMembers = () => {
    const displayedIds = displayedMembers
      .map((m) => m.user_id || m.id)
      .filter(Boolean);
    if (isAllDisplayedMembersSelected) {
      setSelectedMemberIds((prev) =>
        prev.filter((id) => !displayedIds.includes(id))
      );
    } else {
      setSelectedMemberIds((prev) => [
        ...prev,
        ...displayedIds.filter((id) => !prev.includes(id)),
      ]);
      // Remove any newly selected members from manager selections
      setSelectedManagerIds((prev) =>
        prev.filter((id) => !displayedIds.includes(id))
      );
    }
  };

  const selectManagersBtnText = isSearchingManagers
    ? isAllDisplayedManagersSelected
      ? "Deselect Results"
      : "Select Results"
    : displayedManagers.length === orgManagers.length
    ? isAllDisplayedManagersSelected
      ? "Deselect All"
      : "Select All"
    : isAllDisplayedManagersSelected
    ? "Deselect Visible"
    : `Select Visible (${displayedManagers.length})`;

  const selectMembersBtnText = isSearchingMembers
    ? isAllDisplayedMembersSelected
      ? "Deselect Results"
      : "Select Results"
    : displayedMembers.length === orgMembers.length
    ? isAllDisplayedMembersSelected
      ? "Deselect All"
      : "Select All"
    : isAllDisplayedMembersSelected
    ? "Deselect Visible"
    : `Select Visible (${displayedMembers.length})`;

  // Handle adding external invitations
  const handleAddInvite = (e) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail.trim())) {
      toast.error("Please enter a valid email address.");
      return;
    }

    if (
      newInvites.some(
        (inv) => inv.email.toLowerCase() === inviteEmail.trim().toLowerCase()
      )
    ) {
      toast.warning("This email is already added to invitations.");
      return;
    }

    setNewInvites((prev) => [
      ...prev,
      {
        fullName: inviteName.trim() || inviteEmail.split("@")[0],
        email: inviteEmail.trim().toLowerCase(),
        role: inviteRole,
      },
    ]);
    setInviteName("");
    setInviteEmail("");
    setInviteRole(MEMBER_ROLE);
  };

  const handleRemoveInvite = (idx) => {
    setNewInvites((prev) => prev.filter((_, i) => i !== idx));
  };

  // Main Submit Handler: updates existing project in-place without creating duplicates
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");

    if (!name.trim()) {
      setErrorMsg("Project name is required.");
      setActiveTab("general");
      return;
    }

    if (startDate && dueDate && new Date(dueDate) < new Date(startDate)) {
      setErrorMsg("Due date cannot be earlier than start date.");
      setActiveTab("general");
      return;
    }

    if (!targetProjectId) {
      setErrorMsg("No project selected to edit.");
      return;
    }

    setLoading(true);
    try {
      const updatedProject = await executeEditProject(
        targetProjectId,
        {
          name: name.trim(),
          description: description.trim(),
          status,
          startDate: startDate || null,
          dueDate: dueDate || null,
          selectedManagerIds,
          selectedMemberIds,
          initialManagerIds,
          initialMemberIds,
          newInvitations: newInvites,
        },
        {
          currentUserRole,
          currentUserId,
          organizationId: targetOrgId,
        }
      );

      if (pinToSidebar) {
        pinProject(targetOrgId, currentUserId, targetProjectId);
      } else {
        unpinProject(targetOrgId, currentUserId, targetProjectId);
      }

      toast.success("Project updated successfully!");
      if (onProjectUpdated) {
        onProjectUpdated(updatedProject);
      }
      onClose();
    } catch (err) {
      console.error("Edit project error:", err);
      const msg = err?.message || "Failed to update project.";
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Portal>
      <div
        ref={overlayRef}
        onClick={handleOverlayClick}
        className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs select-none animate-fadeIn"
      >
        <div
          className="relative w-full max-w-2xl bg-white rounded-lg shadow-xl border border-slate-200/90 overflow-hidden flex flex-col animate-scaleUp"
          style={{ maxHeight: "90vh" }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal Header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200/80 bg-slate-50/50 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-teal-50 text-[#0F766E] border border-teal-200/60 flex items-center justify-center font-bold">
                <FiEdit2 className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Edit Project: <span className="text-[#0F766E]">{project?.name || name || "Loading..."}</span>
                </h2>
                <p className="text-xs text-slate-500">
                  Workspace: <span className="font-semibold text-slate-700">{organizationName}</span>
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              title="Close modal"
            >
              <FiX className="w-4 h-4" />
            </button>
          </div>

          {fetchingDetails ? (
            <div className="p-12 text-center text-xs font-semibold text-slate-400 space-y-2">
              <span className="inline-block w-6 h-6 border-2 border-slate-300 border-t-[#0F766E] rounded-full animate-spin" />
              <p>Loading project details...</p>
            </div>
          ) : (
            <div className="flex flex-col flex-1 overflow-hidden">
              {/* Navigation Tabs */}
              <div className="flex border-b border-slate-200 px-6 bg-slate-50/30 gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setActiveTab("general")}
                  className={`py-3 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                    activeTab === "general"
                      ? "border-[#0F766E] text-[#0F766E]"
                      : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  1. Project Details
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("team")}
                  className={`py-3 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeTab === "team"
                      ? "border-[#0F766E] text-[#0F766E]"
                      : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <span>2. Manage Team</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-lg bg-slate-200 text-slate-700 font-semibold">
                    {selectedManagerIds.length + selectedMemberIds.length}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("invite")}
                  className={`py-3 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeTab === "invite"
                      ? "border-[#0F766E] text-[#0F766E]"
                      : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <span>3. Invite Members</span>
                  {newInvites.length > 0 && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded-lg bg-teal-100 text-teal-800 font-bold">
                      {newInvites.length}
                    </span>
                  )}
                </button>
              </div>

              {/* Error Alert */}
              {errorMsg && (
                <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
                  <FiAlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Form Content */}
              <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
                {/* TAB 1: General Details */}
                {activeTab === "general" && (
                  <div className="space-y-4 animate-fadeIn">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                        Project Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Core Platform Modernization"
                        className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-[#0F766E] focus:border-[#0F766E] transition-all text-slate-900"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                        Description
                      </label>
                      <textarea
                        rows={3}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="High-level objectives, scope, or roadmap for this project..."
                        className="w-full px-3.5 py-2.5 text-xs bg-white border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-[#0F766E] focus:border-[#0F766E] transition-all text-slate-900"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                          Status
                        </label>
                        <Select
                          value={status}
                          onChange={(val) => setStatus(val)}
                          className="w-full h-9 text-xs font-semibold"
                          options={[
                            { value: "planning", label: "📋 Planning" },
                            { value: "active", label: "⚡ Active" },
                            { value: "on_hold", label: "⏸️ On Hold" },
                            { value: "completed", label: "✅ Completed" },
                            { value: "archived", label: "📦 Archived" },
                          ]}
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                          Start Date
                        </label>
                        <DatePicker
                          value={startDate ? dayjs(startDate) : null}
                          onChange={(d, dateStr) => setStartDate(dateStr || "")}
                          className="w-full h-9 text-xs font-semibold"
                          allowClear
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                          Due Date
                        </label>
                        <DatePicker
                          value={dueDate ? dayjs(dueDate) : null}
                          onChange={(d, dateStr) => setDueDate(dateStr || "")}
                          className="w-full h-9 text-xs font-semibold"
                          allowClear
                        />
                      </div>
                    </div>

                    {/* Pin to sidebar option */}
                    <div className="p-3 bg-slate-50/80 rounded-lg border border-slate-200/80 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-md bg-teal-50 border border-teal-200/60 text-[#0F766E] flex items-center justify-center shrink-0">
                          <LuPin className="w-3.5 h-3.5 fill-current" />
                        </div>
                        <div>
                          <span className="text-xs font-bold text-slate-800">
                            Pin to Sidebar
                          </span>
                          <p className="text-[10px] text-slate-400">
                            Show this project in your sidebar navigation
                          </p>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={pinToSidebar}
                          onChange={(e) => setPinToSidebar(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#0F766E]"></div>
                      </label>
                    </div>

                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => setActiveTab("team")}
                        className="text-xs font-bold text-[#0F766E] hover:text-[#0D655E] inline-flex items-center gap-1 cursor-pointer"
                      >
                        <span>Continue to Team Management →</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* TAB 2: Assign & Manage Team */}
                {activeTab === "team" && (
                  <div className="space-y-5 animate-fadeIn">
                    <div className="bg-teal-50/60 border border-teal-200/80 rounded-lg p-3 text-xs text-teal-900 flex items-start gap-2">
                      <FiInfo className="w-4 h-4 shrink-0 text-[#0F766E] mt-0.5" />
                      <span>
                        Manage team members assigned to this project. Selected members retain access to project boards and assigned tasks.
                        {!canManageManagers && (
                          <span className="block mt-1 font-semibold text-amber-800">
                            Note: Project Manager assignments can only be modified by the Workspace Owner.
                          </span>
                        )}
                      </span>
                    </div>

                    {/* Organization Managers Section */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-purple-700 flex items-center gap-1.5">
                            <FiShield className="w-3.5 h-3.5" />
                            <span>Project Managers ({orgManagers.length})</span>
                          </h4>
                          {!isSearchingManagers && orgManagers.length > 4 && (
                            <button
                              type="button"
                              onClick={() => setShowAllManagers((prev) => !prev)}
                              className="text-[11px] font-semibold text-purple-600 hover:text-purple-800 transition-colors cursor-pointer underline"
                            >
                              {showAllManagers ? "Show Less" : `View All (${orgManagers.length})`}
                            </button>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {canManageManagers && displayedManagers.length > 0 && (
                            <button
                              type="button"
                              onClick={handleToggleSelectManagers}
                              className="text-[11px] font-bold text-purple-600 hover:text-purple-800 transition-colors cursor-pointer"
                            >
                              {selectManagersBtnText}
                            </button>
                          )}
                          <span className="text-[11px] text-purple-700 bg-purple-50 px-2 py-0.5 rounded-lg font-bold border border-purple-200">
                            {selectedManagerIds.length} assigned
                          </span>
                        </div>
                      </div>

                      {/* Manager Search Input */}
                      {orgManagers.length > 0 && (
                        <div className="relative">
                          <FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                          <input
                            type="text"
                            value={managerSearch}
                            onChange={(e) => setManagerSearch(e.target.value)}
                            placeholder="Search managers by name or email..."
                            className="w-full h-8 pl-8 pr-7 text-xs bg-white border border-slate-200 hover:border-slate-300 focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20 rounded-lg outline-none transition-all placeholder:text-slate-400"
                          />
                          {managerSearch && (
                            <button
                              type="button"
                              onClick={() => setManagerSearch("")}
                              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
                              title="Clear search"
                            >
                              <FiX className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      )}

                      {orgManagers.length === 0 ? (
                        <p className="text-xs text-slate-400 italic bg-slate-50 p-3 rounded-lg border border-slate-200">
                          No managers found in this organization.
                        </p>
                      ) : filteredManagers.length === 0 ? (
                        <div className="text-center py-4 px-3 bg-slate-50/70 rounded-lg border border-slate-200 text-xs text-slate-500 space-y-1.5">
                          <p>
                            No managers match <span className="font-semibold text-slate-700">"{managerSearch}"</span>
                          </p>
                          <button
                            type="button"
                            onClick={() => setManagerSearch("")}
                            className="text-[11px] text-purple-600 hover:text-purple-800 font-bold underline cursor-pointer"
                          >
                            Clear search
                          </button>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-56 overflow-y-auto p-1">
                          {displayedManagers.map((mgr) => {
                            const mgrId = mgr.user_id || mgr.id;
                            const isSelected = selectedManagerIds.includes(mgrId);
                            const profile = mgr.profiles || mgr;
                            const displayName =
                              mgr.full_name ||
                              profile?.full_name ||
                              mgr.email ||
                              profile?.email ||
                              "Manager";
                            const displayEmail = mgr.email || profile?.email || "";
                            const initials =
                              displayName
                                .split(" ")
                                .map((w) => w[0])
                                .join("")
                                .toUpperCase()
                                .slice(0, 2) || "M";
                            const isSelf =
                              currentUserId &&
                              (mgr.user_id === currentUserId || mgr.id === currentUserId);

                            return (
                              <div
                                key={mgrId}
                                onClick={() => canManageManagers && toggleManager(mgrId)}
                                className={`p-2.5 rounded-lg border text-xs flex items-center justify-between transition-all ${
                                  canManageManagers ? "cursor-pointer" : "cursor-default opacity-85"
                                } ${
                                  isSelected
                                    ? "bg-purple-50/90 border-purple-400 ring-1 ring-purple-400/20 shadow-2xs"
                                    : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50"
                                }`}
                              >
                                <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-2">
                                  <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 font-bold flex items-center justify-center shrink-0 text-xs">
                                    {initials}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <p className="font-bold text-slate-900 truncate">
                                        {displayName}
                                      </p>
                                      {isSelf && (
                                        <span className="text-[9px] font-bold text-purple-700 bg-purple-100 px-1 py-0.2 rounded-lg border border-purple-200">
                                          You
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[11px] text-slate-500 font-medium truncate flex items-center gap-1 mt-0.5">
                                      <FiMail className="w-3 h-3 text-slate-400 shrink-0" />
                                      <span>{displayEmail || "No email"}</span>
                                    </p>
                                  </div>
                                </div>
                                <div
                                  role="checkbox"
                                  aria-checked={isSelected}
                                  className={`w-4 h-4 rounded-lg flex items-center justify-center shrink-0 border transition-all ${
                                    isSelected
                                      ? "bg-purple-600 border-purple-600 text-white"
                                      : "border-slate-300 bg-white"
                                  }`}
                                >
                                  {isSelected && <FiCheck className="w-3 h-3 stroke-[3]" />}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Organization Members Section */}
                    <div className="space-y-3 pt-2 border-t border-slate-200/80">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-[#0F766E] flex items-center gap-1.5">
                            <FiUsers className="w-3.5 h-3.5" />
                            <span>Team Members ({orgMembers.length})</span>
                          </h4>
                          {!isSearchingMembers && orgMembers.length > 4 && (
                            <button
                              type="button"
                              onClick={() => setShowAllMembers((prev) => !prev)}
                              className="text-[11px] font-semibold text-[#0F766E] hover:text-[#0D655E] transition-colors cursor-pointer underline"
                            >
                              {showAllMembers ? "Show Less" : `View All (${orgMembers.length})`}
                            </button>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {displayedMembers.length > 0 && (
                            <button
                              type="button"
                              onClick={handleToggleSelectMembers}
                              className="text-[11px] font-bold text-[#0F766E] hover:text-[#0D655E] transition-colors cursor-pointer"
                            >
                              {selectMembersBtnText}
                            </button>
                          )}
                          <span className="text-[11px] text-[#0F766E] bg-teal-50 px-2 py-0.5 rounded-lg font-bold border border-teal-200">
                            {selectedMemberIds.length} assigned
                          </span>
                        </div>
                      </div>

                      {/* Member Search Input */}
                      {orgMembers.length > 0 && (
                        <div className="relative">
                          <FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                          <input
                            type="text"
                            value={memberSearch}
                            onChange={(e) => setMemberSearch(e.target.value)}
                            placeholder="Search members by name or email..."
                            className="w-full h-8 pl-8 pr-7 text-xs bg-white border border-slate-200 hover:border-slate-300 focus:border-[#0F766E] focus:ring-1 focus:ring-[#0F766E]/20 rounded-lg outline-none transition-all placeholder:text-slate-400"
                          />
                          {memberSearch && (
                            <button
                              type="button"
                              onClick={() => setMemberSearch("")}
                              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
                              title="Clear search"
                            >
                              <FiX className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      )}

                      {orgMembers.length === 0 ? (
                        <p className="text-xs text-slate-400 italic bg-slate-50 p-3 rounded-lg border border-slate-200">
                          No team members found in this organization.
                        </p>
                      ) : filteredMembers.length === 0 ? (
                        <div className="text-center py-4 px-3 bg-slate-50/70 rounded-lg border border-slate-200 text-xs text-slate-500 space-y-1.5">
                          <p>
                            No members match <span className="font-semibold text-slate-700">"{memberSearch}"</span>
                          </p>
                          <button
                            type="button"
                            onClick={() => setMemberSearch("")}
                            className="text-[11px] text-[#0F766E] hover:text-[#0D655E] font-bold underline cursor-pointer"
                          >
                            Clear search
                          </button>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-56 overflow-y-auto p-1">
                          {displayedMembers.map((mem) => {
                            const memId = mem.user_id || mem.id;
                            const isSelected = selectedMemberIds.includes(memId);
                            const profile = mem.profiles || mem;
                            const displayName =
                              mem.full_name ||
                              profile?.full_name ||
                              mem.email ||
                              profile?.email ||
                              "Member";
                            const displayEmail = mem.email || profile?.email || "";
                            const initials =
                              displayName
                                .split(" ")
                                .map((w) => w[0])
                                .join("")
                                .toUpperCase()
                                .slice(0, 2) || "U";
                            const isSelf =
                              currentUserId &&
                              (mem.user_id === currentUserId || mem.id === currentUserId);

                            return (
                              <div
                                key={memId}
                                onClick={() => toggleMember(memId)}
                                className={`p-2.5 rounded-lg border text-xs flex items-center justify-between cursor-pointer transition-all ${
                                  isSelected
                                    ? "bg-teal-50/90 border-[#0F766E] ring-1 ring-[#0F766E]/20 shadow-2xs"
                                    : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50"
                                }`}
                              >
                                <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-2">
                                  <div className="w-8 h-8 rounded-lg bg-teal-100 text-[#0F766E] font-bold flex items-center justify-center shrink-0 text-xs">
                                    {initials}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <p className="font-bold text-slate-900 truncate">
                                        {displayName}
                                      </p>
                                      {isSelf && (
                                        <span className="text-[9px] font-bold text-[#0F766E] bg-teal-100 px-1 py-0.2 rounded-lg border border-teal-200">
                                          You
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[11px] text-slate-500 font-medium truncate flex items-center gap-1 mt-0.5">
                                      <FiMail className="w-3 h-3 text-slate-400 shrink-0" />
                                      <span>{displayEmail || "No email"}</span>
                                    </p>
                                  </div>
                                </div>
                                <div
                                  role="checkbox"
                                  aria-checked={isSelected}
                                  className={`w-4 h-4 rounded-lg flex items-center justify-center shrink-0 border transition-all ${
                                    isSelected
                                      ? "bg-[#0F766E] border-[#0F766E] text-white"
                                      : "border-slate-300 bg-white"
                                  }`}
                                >
                                  {isSelected && <FiCheck className="w-3 h-3 stroke-[3]" />}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* TAB 3: Invite New Members */}
                {activeTab === "invite" && (
                  <div className="space-y-4 animate-fadeIn">
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-600">
                      Need to add team members who haven't joined <strong>{organizationName}</strong> yet?
                      Send project invitations directly. They will receive invite links to join this workspace and project.
                    </div>

                    {/* Invite Inputs */}
                    <div className="p-4 bg-slate-50/50 rounded-lg border border-slate-200/90 space-y-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                        Add New Invitee
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                            Full Name
                          </label>
                          <input
                            type="text"
                            value={inviteName}
                            onChange={(e) => setInviteName(e.target.value)}
                            placeholder="e.g. Alex Morgan"
                            className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg outline-none focus:ring-1 focus:ring-[#0F766E] text-slate-800"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                            Email Address <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="email"
                            value={inviteEmail}
                            onChange={(e) => setInviteEmail(e.target.value)}
                            placeholder="alex@company.com"
                            className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg outline-none focus:ring-1 focus:ring-[#0F766E] text-slate-800"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-3 pt-1">
                        <div className="flex items-center gap-2">
                          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                            Role:
                          </label>
                          <Select
                            value={inviteRole}
                            onChange={(val) => setInviteRole(val)}
                            className="w-36 h-7.5 text-xs font-semibold"
                            options={[
                              { value: MEMBER_ROLE, label: "Member" },
                              ...(canManageManagers
                                ? [{ value: MANAGER_ROLE, label: "Project Manager" }]
                                : []),
                            ]}
                          />
                        </div>

                        <button
                          type="button"
                          onClick={handleAddInvite}
                          className="px-3 py-1.5 bg-[#0F766E] hover:bg-[#0D655E] active:scale-[0.98] text-white text-xs font-bold rounded-lg transition-all inline-flex items-center gap-1 cursor-pointer"
                        >
                          <FiPlus className="w-3.5 h-3.5" />
                          <span>Add Invitee</span>
                        </button>
                      </div>
                    </div>

                    {/* Queue of New Invites */}
                    {newInvites.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                          Invitations to be sent on save ({newInvites.length})
                        </h4>
                        <div className="space-y-1.5 max-h-48 overflow-y-auto">
                          {newInvites.map((inv, idx) => (
                            <div
                              key={idx}
                              className="p-2.5 bg-white border border-slate-200 rounded-lg flex items-center justify-between text-xs"
                            >
                              <div className="truncate">
                                <span className="font-bold text-slate-800 mr-1.5">
                                  {inv.fullName}
                                </span>
                                <span className="text-slate-500 font-mono text-[11px]">
                                  ({inv.email})
                                </span>
                                <span
                                  className={`ml-2 text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-lg border ${
                                    inv.role === MANAGER_ROLE
                                      ? "bg-purple-100 text-purple-800 border-purple-200"
                                      : "bg-teal-100 text-teal-800 border-teal-200"
                                  }`}
                                >
                                  {inv.role}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoveInvite(idx)}
                                className="text-slate-400 hover:text-red-600 p-1 rounded-lg cursor-pointer"
                                title="Remove invitee"
                              >
                                <FiTrash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Bottom Actions */}
                <div className="flex items-center justify-between pt-4 border-t border-slate-200 shrink-0">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={loading}
                    className="h-9 px-4 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer inline-flex items-center justify-center"
                  >
                    Cancel
                  </button>

                  <div className="flex items-center gap-2.5">
                    {activeTab !== "general" && (
                      <button
                        type="button"
                        onClick={() =>
                          setActiveTab((curr) => (curr === "invite" ? "team" : "general"))
                        }
                        className="h-9 px-3.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer inline-flex items-center justify-center"
                      >
                        ← Back
                      </button>
                    )}

                    <button
                      type="submit"
                      disabled={loading}
                      className="inline-flex items-center justify-center gap-2 h-9 px-5 bg-[#0F766E] hover:bg-[#0D655E] active:scale-[0.98] text-white text-xs font-semibold rounded-lg shadow-sm shadow-teal-900/15 transition-all cursor-pointer disabled:opacity-60"
                    >
                      {loading ? (
                        <span className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <FiCheck className="w-3.5 h-3.5" />
                      )}
                      <span>Save Changes</span>
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </Portal>
  );
}
