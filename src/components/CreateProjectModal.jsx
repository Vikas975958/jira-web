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

  // Separate org members into managers and members
  const orgManagers = existingMembers.filter(
    (m) => m.role === MANAGER_ROLE || m.role === OWNER_ROLE
  );
  const orgMembers = existingMembers.filter((m) => m.role === MEMBER_ROLE);

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
    setSelectedManagerIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const toggleMember = (id) => {
    setSelectedMemberIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
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

      toast.success(`Project "${created.name}" created successfully!`);
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
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-[999] flex items-center justify-center p-4 select-none"
      style={{ backgroundColor: "rgba(15, 23, 42, 0.65)", backdropFilter: "blur(4px)" }}
    >
      <div
        className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        style={{ maxHeight: "90vh", animation: "modalSlideIn 0.2s ease-out" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Accent Top Bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-[#0052CC] via-indigo-600 to-purple-600" />

        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold shadow-xs">
              <FiFolderPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Create New Project</h2>
              <p className="text-xs text-slate-500">
                Workspace: <span className="font-semibold text-slate-700">{organizationName}</span>
              </p>
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

        {/* Success View */}
        {createdResult ? (
          <div className="p-8 space-y-6 overflow-y-auto">
            <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto shadow-sm">
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
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
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
                        <span className="ml-2 text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">
                          {inv.intended_role}
                        </span>
                      </div>
                      {inv.signupUrl && (
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(inv.signupUrl);
                            toast.success(`Copied invite link for ${inv.email}`);
                          }}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800 shrink-0 cursor-pointer"
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
                className="px-6 py-2.5 bg-[#0052CC] hover:bg-[#0747A6] text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer"
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
                    ? "border-blue-600 text-blue-600"
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
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <span>2. Assign Team</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-700">
                  {selectedManagerIds.length + selectedMemberIds.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("invite")}
                className={`py-3 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === "invite"
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <span>3. Invite New Members</span>
                {newInvites.length > 0 && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-blue-100 text-blue-800 font-bold">
                    {newInvites.length}
                  </span>
                )}
              </button>
            </div>

            {/* Error Message */}
            {errorMsg && (
              <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
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
                      className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-slate-900"
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
                      className="w-full px-3.5 py-2.5 text-xs bg-white border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-slate-900"
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
                        className="w-full px-3 py-2 text-xs font-semibold bg-white border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
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
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
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
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
                      />
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => setActiveTab("team")}
                      className="text-xs font-bold text-blue-600 hover:text-blue-800 inline-flex items-center gap-1 cursor-pointer"
                    >
                      <span>Continue to Team Assignment →</span>
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 2: Assign Team Section */}
              {activeTab === "team" && (
                <div className="space-y-5 animate-fadeIn">
                  <div className="bg-blue-50/60 border border-blue-200/80 rounded-xl p-3 text-xs text-blue-800 flex items-start gap-2">
                    <FiInfo className="w-4 h-4 shrink-0 text-blue-600 mt-0.5" />
                    <span>
                      Assign existing managers and members from{" "}
                      <strong>{organizationName}</strong>. Only verified members of this organization can be directly added.
                    </span>
                  </div>

                  {/* Managers Listing */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-purple-700 flex items-center gap-1.5">
                        <FiShield className="w-3.5 h-3.5" />
                        <span>Organization Managers ({orgManagers.length})</span>
                      </h4>
                      <span className="text-[11px] text-slate-500">
                        {selectedManagerIds.length} selected
                      </span>
                    </div>

                    {orgManagers.length === 0 ? (
                      <p className="text-xs text-slate-400 italic bg-slate-50 p-3 rounded-xl border border-slate-200">
                        No additional managers found in this organization.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-44 overflow-y-auto p-1">
                        {orgManagers.map((mgr) => {
                          const isSelected = selectedManagerIds.includes(mgr.user_id);
                          return (
                            <div
                              key={mgr.user_id}
                              onClick={() => toggleManager(mgr.user_id)}
                              className={`p-2.5 rounded-xl border text-xs flex items-center justify-between cursor-pointer transition-all ${
                                isSelected
                                  ? "bg-purple-50/80 border-purple-300 shadow-2xs"
                                  : "bg-white border-slate-200 hover:border-slate-300"
                              }`}
                            >
                              <div className="flex items-center gap-2.5 truncate">
                                <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-700 font-bold flex items-center justify-center shrink-0 text-xs">
                                  {mgr.full_name?.charAt(0)?.toUpperCase() || "M"}
                                </div>
                                <div className="truncate">
                                  <p className="font-bold text-slate-900 truncate">
                                    {mgr.full_name || mgr.email}
                                  </p>
                                  <p className="text-[10px] text-slate-500 font-mono truncate">
                                    {mgr.email}
                                  </p>
                                </div>
                              </div>
                              <div
                                className={`w-4 h-4 rounded-md flex items-center justify-center shrink-0 border ${
                                  isSelected
                                    ? "bg-purple-600 border-purple-600 text-white"
                                    : "border-slate-300 bg-white"
                                }`}
                              >
                                {isSelected && <FiCheck className="w-3 h-3" />}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Members Listing */}
                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-blue-700 flex items-center gap-1.5">
                        <FiUsers className="w-3.5 h-3.5" />
                        <span>Organization Members ({orgMembers.length})</span>
                      </h4>
                      <span className="text-[11px] text-slate-500">
                        {selectedMemberIds.length} selected
                      </span>
                    </div>

                    {orgMembers.length === 0 ? (
                      <p className="text-xs text-slate-400 italic bg-slate-50 p-3 rounded-xl border border-slate-200">
                        No team members registered yet. Use the Invite tab to add people!
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-48 overflow-y-auto p-1">
                        {orgMembers.map((mem) => {
                          const isSelected = selectedMemberIds.includes(mem.user_id);
                          return (
                            <div
                              key={mem.user_id}
                              onClick={() => toggleMember(mem.user_id)}
                              className={`p-2.5 rounded-xl border text-xs flex items-center justify-between cursor-pointer transition-all ${
                                isSelected
                                  ? "bg-blue-50/80 border-blue-300 shadow-2xs"
                                  : "bg-white border-slate-200 hover:border-slate-300"
                              }`}
                            >
                              <div className="flex items-center gap-2.5 truncate">
                                <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 font-bold flex items-center justify-center shrink-0 text-xs">
                                  {mem.full_name?.charAt(0)?.toUpperCase() || "U"}
                                </div>
                                <div className="truncate">
                                  <p className="font-bold text-slate-900 truncate">
                                    {mem.full_name || mem.email}
                                  </p>
                                  <p className="text-[10px] text-slate-500 font-mono truncate">
                                    {mem.email}
                                  </p>
                                </div>
                              </div>
                              <div
                                className={`w-4 h-4 rounded-md flex items-center justify-center shrink-0 border ${
                                  isSelected
                                    ? "bg-blue-600 border-blue-600 text-white"
                                    : "border-slate-300 bg-white"
                                }`}
                              >
                                {isSelected && <FiCheck className="w-3 h-3" />}
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
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 flex items-start gap-2">
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
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
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
                          className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
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
                          className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                          Project Role
                        </label>
                        <select
                          value={inviteRole}
                          onChange={(e) => setInviteRole(e.target.value)}
                          className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
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
                                className={`ml-2 text-[10px] uppercase font-bold px-1.5 py-0.5 rounded border ${
                                  inv.role === MANAGER_ROLE
                                    ? "bg-purple-100 text-purple-800 border-purple-200"
                                    : "bg-blue-100 text-blue-800 border-blue-200"
                                }`}
                              >
                                {inv.role}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveInvite(idx)}
                              className="text-slate-400 hover:text-red-600 p-1 rounded cursor-pointer"
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
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
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
                      className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                    >
                      ← Back
                    </button>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#0052CC] hover:bg-[#0747A6] active:scale-[0.98] text-white text-xs font-bold rounded-xl shadow-md shadow-blue-500/20 transition-all cursor-pointer disabled:opacity-60"
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
  );
}
