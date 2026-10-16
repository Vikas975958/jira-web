"use client";

import React, { useState, useEffect, useRef } from "react";
import { toast } from "react-toastify";
import {
  FiFolderPlus,
  FiX,
  FiCheck,
  FiUsers,
  FiShield,
  FiUser,
  FiCalendar,
  FiInfo,
  FiAlertCircle,
  FiPlus,
  FiTrash2,
  FiMail,
  FiCopy,
} from "react-icons/fi";
import projectService from "@/services/project.service";
import { MEMBER_ROLE, MANAGER_ROLE, OWNER_ROLE } from "@/utils/constants";
import Portal from "@/components/Portal";

export default function CreateProjectModal({
  isOpen,
  onClose,
  organizationId,
  organizationName = "Workspace",
  currentUserId,
  currentUserRole = MEMBER_ROLE,
  existingMembers = [],
  onProjectCreated,
}) {
  const overlayRef = useRef(null);

  // Form Fields
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("active");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");

  // Team Selection
  const [selectedManagerIds, setSelectedManagerIds] = useState([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState([]);

  // New Invitees Section (Case A & Case B)
  const [newInvites, setNewInvites] = useState([]);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState(MEMBER_ROLE);

  const [activeTab, setActiveTab] = useState("general"); // 'general' | 'team' | 'invite'
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [createdResult, setCreatedResult] = useState(null);

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

  useEffect(() => {
    if (isOpen && organizationId) {
      import("@/services/organization.service")
        .then((mod) => (mod.default || mod.organizationService).getOrganizationMembers(organizationId, { currentUserId, currentUserRole }))
        .then((data) => {
          if (data && data.length > 0) {
            setInternalMembers(data);
          }
        })
        .catch(() => {});
    }
  }, [isOpen, organizationId, currentUserId, currentUserRole]);

  const activeMembers = internalMembers.length > 0 ? internalMembers : (existingMembers || []);

  // Separate org members into managers and members (always keeping current user at top)
  const orgManagers = React.useMemo(() => {
    const list = activeMembers.filter(
      (m) => m.role === MANAGER_ROLE || m.role === OWNER_ROLE
    );
    if (currentUserId) {
      list.sort((a, b) => {
        const aIsMe = (a.user_id === currentUserId || a.id === currentUserId || a.profiles?.id === currentUserId) ? 1 : 0;
        const bIsMe = (b.user_id === currentUserId || b.id === currentUserId || b.profiles?.id === currentUserId) ? 1 : 0;
        return bIsMe - aIsMe;
      });
    }
    return list;
  }, [activeMembers, currentUserId]);

  const orgMembers = React.useMemo(() => {
    const list = activeMembers.filter((m) => m.role === MEMBER_ROLE);
    if (currentUserId) {
      list.sort((a, b) => {
        const aIsMe = (a.user_id === currentUserId || a.id === currentUserId || a.profiles?.id === currentUserId) ? 1 : 0;
        const bIsMe = (b.user_id === currentUserId || b.id === currentUserId || b.profiles?.id === currentUserId) ? 1 : 0;
        return bIsMe - aIsMe;
      });
    }
    return list;
  }, [activeMembers, currentUserId]);

  useEffect(() => {
    if (isOpen) {
      setName("");
      setDescription("");
      setStatus("active");
      setStartDate(new Date().toISOString().split("T")[0]);
      setDueDate("");
      setSelectedManagerIds(currentUserId && isManager ? [currentUserId] : []);
      setSelectedMemberIds([]);
      setNewInvites([]);
      setInviteName("");
      setInviteEmail("");
      setInviteRole(MEMBER_ROLE);
      setActiveTab("general");
      setErrorMsg("");
      setCreatedResult(null);
    }
  }, [isOpen, currentUserId, isManager]);

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
    if (!id) return;
    setSelectedManagerIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const toggleMember = (id) => {
    if (!id) return;
    setSelectedMemberIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleSelectAllManagers = () => {
    const allIds = orgManagers.map((m) => m.user_id || m.id).filter(Boolean);
    if (selectedManagerIds.length === allIds.length && allIds.length > 0) {
      setSelectedManagerIds([]);
    } else {
      setSelectedManagerIds(allIds);
    }
  };

  const handleSelectAllMembers = () => {
    const allIds = orgMembers.map((m) => m.user_id || m.id).filter(Boolean);
    if (selectedMemberIds.length === allIds.length && allIds.length > 0) {
      setSelectedMemberIds([]);
    } else {
      setSelectedMemberIds(allIds);
    }
  };

  const handleAddInvite = (e) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail.trim())) {
      toast.error("Please enter a valid email address.");
      return;
    }

    if (newInvites.some((inv) => inv.email.toLowerCase() === inviteEmail.trim().toLowerCase())) {
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");

    if (!name.trim()) {
      setErrorMsg("Project name is required.");
      setActiveTab("general");
      return;
    }

    if (!organizationId) {
      setErrorMsg("No active organization found.");
      return;
    }

    setLoading(true);
    try {
      const created = await projectService.createProject(
        {
          organizationId,
          name: name.trim(),
          description: description.trim(),
          status,
          startDate: startDate || null,
          dueDate: dueDate || null,
          assignedManagerIds: selectedManagerIds,
          assignedMemberIds: selectedMemberIds,
          newInvitations: newInvites,
        },
        {
          creatorId: currentUserId,
          creatorRole: currentUserRole,
        }
      );

      setCreatedResult(created);
      if (onProjectCreated) {
        onProjectCreated(created);
      }
    } catch (err) {
      console.error("Create project error:", err);
      const msg = err?.message || "Failed to create project.";
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
              <FiFolderPlus className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Create New Project</h2>
              <p className="text-xs text-slate-500">
                Workspace: <span className="font-semibold text-slate-700">{organizationName}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <FiX className="w-4 h-4" />
          </button>
        </div>

        {/* Success View */}
        {createdResult ? (
          <div className="p-8 space-y-6 overflow-y-auto">
            <div className="w-14 h-14 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto shadow-sm">
              <FiCheck className="w-8 h-8" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-lg font-bold text-slate-900">Project Created!</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                <span className="font-bold text-slate-800">{createdResult.name}</span> has been set up with{" "}
                {selectedManagerIds.length} manager(s) and {selectedMemberIds.length} member(s).
              </p>
            </div>

            {createdResult.invitationsSent && createdResult.invitationsSent.length > 0 && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Project Invitations Generated ({createdResult.invitationsSent.length})
                </h4>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {createdResult.invitationsSent.map((inv, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 bg-white border border-slate-200 rounded-lg flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="truncate">
                        <span className="font-bold text-slate-800">{inv.email}</span>
                        <span className="ml-2 text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-lg bg-teal-100 text-teal-800">
                          {inv.intended_role}
                        </span>
                      </div>
                      {inv.signupUrl && (
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(inv.signupUrl);
                          }}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#0F766E] hover:text-[#0D655E] shrink-0 cursor-pointer"
                        >
                          <FiCopy className="w-3.5 h-3.5" />
                          <span>Copy Link</span>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 bg-[#0F766E] hover:bg-[#0D655E] active:bg-[#115E59] active:scale-[0.98] text-white text-xs font-bold rounded-lg shadow-md shadow-teal-900/20 transition-all cursor-pointer"
              >
                Close & View Projects
              </button>
            </div>
          </div>
        ) : (
          /* Normal Form */
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* Tabs */}
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
                <span>2. Assign Team</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-lg bg-slate-200 text-slate-700">
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
                <span>3. Invite New Members</span>
                {newInvites.length > 0 && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded-lg bg-teal-100 text-teal-800 font-bold">
                    {newInvites.length}
                  </span>
                )}
              </button>
            </div>

            {/* Error Message */}
            {errorMsg && (
              <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
                <FiAlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Tab Contents */}
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
                      <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                        className="w-full px-3 py-2 text-xs font-semibold bg-white border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-[#0F766E] text-slate-800"
                      >
                        <option value="planning">📋 Planning</option>
                        <option value="active">⚡ Active</option>
                        <option value="on_hold">⏸️ On Hold</option>
                        <option value="completed">✅ Completed</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                        Start Date
                      </label>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-[#0F766E] text-slate-800"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                        Due Date
                      </label>
                      <input
                        type="date"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-[#0F766E] text-slate-800"
                      />
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => setActiveTab("team")}
                      className="text-xs font-bold text-[#0F766E] hover:text-[#0D655E] inline-flex items-center gap-1 cursor-pointer"
                    >
                      <span>Continue to Team Assignment →</span>
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 2: Assign Team Section */}
              {activeTab === "team" && (
                <div className="space-y-5 animate-fadeIn">
                  <div className="bg-teal-50/60 border border-teal-200/80 rounded-lg p-3 text-xs text-teal-900 flex items-start gap-2">
                    <FiInfo className="w-4 h-4 shrink-0 text-[#0F766E] mt-0.5" />
                    <span>
                      Assign existing managers and members from{" "}
                      <strong>{organizationName}</strong>. Only verified members of this organization can be directly added.
                    </span>
                  </div>

                  {/* Managers Section */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-purple-700 flex items-center gap-1.5">
                        <FiShield className="w-3.5 h-3.5" />
                        <span>Organization Managers ({orgManagers.length})</span>
                      </h4>
                      <div className="flex items-center gap-2">
                        {orgManagers.length > 0 && (
                          <button
                            type="button"
                            onClick={handleSelectAllManagers}
                            className="text-[11px] font-bold text-purple-600 hover:text-purple-800 transition-colors cursor-pointer"
                          >
                            {selectedManagerIds.length === orgManagers.length ? "Deselect All" : "Select All"}
                          </button>
                        )}
                        <span className="text-[11px] text-purple-700 bg-purple-50 px-2 py-0.5 rounded-lg font-bold border border-purple-200">
                          {selectedManagerIds.length} selected
                        </span>
                      </div>
                    </div>


                    {orgManagers.length === 0 ? (
                      <p className="text-xs text-slate-400 italic bg-slate-50 p-3 rounded-lg border border-slate-200">
                        No additional managers found in this organization.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-48 overflow-y-auto p-1">
                        {orgManagers.map((mgr) => {
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
                              onClick={() => toggleManager(mgrId)}
                              className={`p-2.5 rounded-lg border text-xs flex items-center justify-between cursor-pointer transition-all ${
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

                  {/* Members Section */}
                  <div className="space-y-3 pt-3 border-t border-slate-100">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-[#0F766E] flex items-center gap-1.5">
                        <FiUsers className="w-3.5 h-3.5" />
                        <span>Organization Members ({orgMembers.length})</span>
                      </h4>
                      <div className="flex items-center gap-2">
                        {orgMembers.length > 0 && (
                          <button
                            type="button"
                            onClick={handleSelectAllMembers}
                            className="text-[11px] font-bold text-[#0F766E] hover:text-[#0D655E] transition-colors cursor-pointer"
                          >
                            {selectedMemberIds.length === orgMembers.length ? "Deselect All" : "Select All"}
                          </button>
                        )}
                        <span className="text-[11px] text-[#0F766E] bg-teal-50 px-2 py-0.5 rounded-lg font-bold border border-teal-200">
                          {selectedMemberIds.length} selected
                        </span>
                      </div>
                    </div>


                    {orgMembers.length === 0 ? (
                      <p className="text-xs text-slate-400 italic bg-slate-50 p-3 rounded-lg border border-slate-200">
                        No team members registered yet. Use the Invite tab to add people!
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-48 overflow-y-auto p-1">
                        {orgMembers.map((mem) => {
                          const memId = mem.user_id || mem.id;
                          const isSelected = selectedMemberIds.includes(memId);
                          const profile = mem.profiles || mem;
                          const displayName =
                            mem.full_name ||
                            profile?.full_name ||
                            mem.email ||
                            profile?.email ||
                            "Team Member";
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
                                  ? "bg-teal-50/90 border-[#0F766E]/40 ring-1 ring-[#0F766E]/20 shadow-2xs"
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

              {/* TAB 3: Invite New Users (Case A & B) */}
              {activeTab === "invite" && (
                <div className="space-y-4 animate-fadeIn">
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 flex items-start gap-2">
                    <FiMail className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                    <div>
                      <p className="font-bold">Project Team Invitations</p>
                      <p className="mt-0.5 text-[11px] leading-relaxed">
                        If a user does not have an account yet, a secure signup link will be created.
                        Once they accept, they will automatically be joined to this organization and project team!
                      </p>
                    </div>
                  </div>

                  {/* Add invite row */}
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                          Full Name
                        </label>
                        <input
                          type="text"
                          value={inviteName}
                          onChange={(e) => setInviteName(e.target.value)}
                          placeholder="e.g. Sarah Connor"
                          className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-[#0F766E] text-slate-900"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                          Email <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="email"
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                          placeholder="sarah@example.com"
                          className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-[#0F766E] text-slate-900"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                          Project Role
                        </label>
                        <select
                          value={inviteRole}
                          onChange={(e) => setInviteRole(e.target.value)}
                          className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-[#0F766E] text-slate-800"
                        >
                          <option value={MEMBER_ROLE}>Team Member</option>
                          {canManageManagers && (
                            <option value={MANAGER_ROLE}>Project Manager</option>
                          )}
                        </select>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleAddInvite}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                    >
                      <FiPlus className="w-3.5 h-3.5" />
                      <span>Add to Invite Queue</span>
                    </button>
                  </div>

                  {/* Staged Invites List */}
                  {newInvites.length > 0 && (
                    <div className="space-y-2">
                      <h5 className="text-[11px] font-bold uppercase text-slate-600">
                        Queued Project Invitations ({newInvites.length})
                      </h5>
                      <div className="space-y-1.5 max-h-40 overflow-y-auto">
                        {newInvites.map((inv, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between p-2.5 bg-white border border-slate-200 rounded-lg text-xs"
                          >
                            <div className="truncate">
                              <span className="font-bold text-slate-800">{inv.fullName}</span>
                              <span className="text-slate-500 font-mono ml-2">({inv.email})</span>
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
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>

                <div className="flex items-center gap-3">
                  {activeTab !== "general" && (
                    <button
                      type="button"
                      onClick={() =>
                        setActiveTab((curr) => (curr === "invite" ? "team" : "general"))
                      }
                      className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                    >
                      ← Back
                    </button>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#0F766E] hover:bg-[#0D655E] active:scale-[0.98] text-white text-xs font-bold rounded-lg shadow-md shadow-teal-900/20 transition-all cursor-pointer disabled:opacity-60"
                  >
                    {loading ? (
                      <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <FiCheck className="w-4 h-4" />
                    )}
                    <span>Create Project</span>
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
