"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  FiX,
  FiUsers,
  FiUserPlus,
  FiShield,
  FiUser,
  FiLogOut,
  FiEdit3,
  FiCheck,
  FiTrash2,
  FiSearch,
  FiMoreVertical,
  FiCamera,
} from "react-icons/fi";
import { toast } from "react-toastify";
import { getNameInitials } from "@/utils/commonFunction";
import chatService from "../chatService";

export default function GroupDetailsModal({
  isOpen,
  onClose,
  group,
  currentUserId,
  allTeamMembers = [],
  onGroupUpdated,
  onMemberChanged,
  onLeaveGroup,
  onDeleteGroup,
}) {
  const [members, setMembers] = useState([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isSavingInfo, setIsSavingInfo] = useState(false);

  // Add Member Mode
  const [isAddingMembers, setIsAddingMembers] = useState(false);
  const [selectedNewUserIds, setSelectedNewUserIds] = useState([]);
  const [memberSearchQuery, setMemberSearchQuery] = useState("");
  const [isSubmittingAdd, setIsSubmittingAdd] = useState(false);

  // Action Menu Dropdown State: { [memberId]: boolean }
  const [openMenuMemberId, setOpenMenuMemberId] = useState(null);
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  const fileInputRef = useRef(null);

  // Load Group Members
  const loadMembers = useCallback(async () => {
    if (!group?.id) return;
    try {
      setIsLoadingMembers(true);
      const data = await chatService.getGroupMembers(group.id);
      setMembers(data || []);
    } catch (err) {
      console.error("loadMembers error:", err);
    } finally {
      setIsLoadingMembers(false);
    }
  }, [group?.id]);

  useEffect(() => {
    if (isOpen && group?.id) {
      setName(group.name || "");
      setDescription(group.description || "");
      setIsEditingInfo(false);
      setIsAddingMembers(false);
      setSelectedNewUserIds([]);
      setMemberSearchQuery("");
      setOpenMenuMemberId(null);
      loadMembers();
    }
  }, [isOpen, group, loadMembers]);

  // Lookup map for resolving team members
  const teamMemberMap = useMemo(() => {
    const map = new Map();
    (allTeamMembers || []).forEach((m) => {
      const id = m.user_id || m.id || m.profiles?.id;
      if (id) {
        map.set(id, {
          user_id: id,
          full_name: m.full_name || m.name || m.profiles?.full_name || "Teammate",
          email: m.email || m.profiles?.email || "",
          avatar_url: m.avatar_url || m.profiles?.avatar_url || null,
          role: m.role || "member",
        });
      }
    });
    return map;
  }, [allTeamMembers]);

  // Enriched members with full_name, email, and avatar
  const enrichedMembers = useMemo(() => {
    return members.map((m) => {
      const tm = teamMemberMap.get(m.user_id);
      const fullName =
        m.full_name && m.full_name.trim() && m.full_name !== "Workspace Member"
          ? m.full_name
          : tm?.full_name || (m.user_id === currentUserId ? "You" : "Teammate");
      const email = m.email || tm?.email || "";
      const avatarUrl = m.avatar_url || tm?.avatar_url || null;

      return {
        ...m,
        full_name: fullName,
        email: email,
        avatar_url: avatarUrl,
      };
    });
  }, [members, teamMemberMap, currentUserId]);

  // Determine current user's role in this group
  const currentUserRole = useMemo(() => {
    const currentMember = enrichedMembers.find((m) => m.user_id === currentUserId);
    return currentMember?.role || group?.currentUserRole || "member";
  }, [enrichedMembers, currentUserId, group?.currentUserRole]);

  const isCurrentAdmin = currentUserRole === "admin";

  // Admins count for last-admin protection
  const adminCount = useMemo(() => {
    return enrichedMembers.filter((m) => m.role === "admin" && m.is_active !== false).length;
  }, [enrichedMembers]);

  // Teammates not currently in this group
  const nonGroupMembers = useMemo(() => {
    const existingUserIds = new Set(enrichedMembers.map((m) => m.user_id));
    return (allTeamMembers || [])
      .map((m) => {
        const uId = m.user_id || m.id || m.profiles?.id;
        return {
          user_id: uId,
          full_name: m.full_name || m.name || m.profiles?.full_name || "Teammate",
          email: m.email || m.profiles?.email || "",
          role: m.role || "member",
        };
      })
      .filter((m) => m.user_id && !existingUserIds.has(m.user_id));
  }, [allTeamMembers, enrichedMembers]);

  // Filtered teammates for adding
  const filteredNonGroupMembers = useMemo(() => {
    if (!memberSearchQuery?.trim()) return nonGroupMembers;
    const q = memberSearchQuery.toLowerCase().trim();
    return nonGroupMembers.filter(
      (m) =>
        m.full_name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q)
    );
  }, [nonGroupMembers, memberSearchQuery]);

  if (!isOpen || !group) return null;

  // Handle avatar upload
  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !group?.id) return;

    try {
      const imageUrl = await chatService.uploadGroupImage(file);
      if (imageUrl) {
        const updated = await chatService.updateGroupInfo({
          groupId: group.id,
          groupImage: imageUrl,
        });
        toast.success("Group avatar updated!");
        if (onGroupUpdated) onGroupUpdated(updated);
      }
    } catch (err) {
      toast.error("Failed to upload avatar");
    }
  };

  // Save Group Info (Name & Description)
  const handleSaveInfo = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Group name cannot be empty");
      return;
    }

    try {
      setIsSavingInfo(true);
      const updated = await chatService.updateGroupInfo({
        groupId: group.id,
        name: trimmed,
        description: description.trim(),
      });
      toast.success("Group details updated");
      setIsEditingInfo(false);
      if (onGroupUpdated) onGroupUpdated(updated);
    } catch (err) {
      toast.error("Failed to update group details");
    } finally {
      setIsSavingInfo(false);
    }
  };

  // Add Selected Members to Group
  const handleAddMembersSubmit = async () => {
    if (selectedNewUserIds.length === 0) return;
    try {
      setIsSubmittingAdd(true);
      await chatService.addGroupMembers({
        groupId: group.id,
        userIds: selectedNewUserIds,
      });
      toast.success(
        `Added ${selectedNewUserIds.length} member${selectedNewUserIds.length > 1 ? "s" : ""}!`
      );
      setSelectedNewUserIds([]);
      setIsAddingMembers(false);
      await loadMembers();
      if (onMemberChanged) onMemberChanged();
    } catch (err) {
      console.error("Add members error:", err);
      toast.error(err.message || "Failed to add members");
    } finally {
      setIsSubmittingAdd(false);
    }
  };

  // Promote / Demote Role
  const handleRoleChange = async (targetUser, newRole) => {
    if (newRole === "member" && targetUser.role === "admin" && adminCount <= 1) {
      toast.error(
        "Cannot demote the last remaining administrator. Please promote someone else first."
      );
      return;
    }

    try {
      setIsProcessingAction(true);
      await chatService.updateMemberRole({
        groupId: group.id,
        targetUserId: targetUser.user_id,
        newRole,
      });
      toast.success(`Updated role for ${targetUser.full_name} to ${newRole}`);
      setOpenMenuMemberId(null);
      await loadMembers();
      if (onMemberChanged) onMemberChanged();
    } catch (err) {
      toast.error(err.message || "Failed to update member role");
    } finally {
      setIsProcessingAction(false);
    }
  };

  // Remove Member
  const handleRemoveMember = async (targetUser) => {
    if (targetUser.role === "admin" && adminCount <= 1) {
      toast.error("Cannot remove the last administrator of the group.");
      return;
    }

    if (
      !window.confirm(
        `Are you sure you want to remove ${targetUser.full_name} from this group?`
      )
    ) {
      return;
    }

    try {
      setIsProcessingAction(true);
      await chatService.removeGroupMember({
        groupId: group.id,
        targetUserId: targetUser.user_id,
      });
      toast.success(`Removed ${targetUser.full_name} from the group`);
      setOpenMenuMemberId(null);
      await loadMembers();
      if (onMemberChanged) onMemberChanged();
    } catch (err) {
      toast.error(err.message || "Failed to remove member");
    } finally {
      setIsProcessingAction(false);
    }
  };

  // Leave Group
  const handleLeaveGroup = async () => {
    if (isCurrentAdmin && adminCount <= 1 && enrichedMembers.length > 1) {
      toast.error(
        "You are the last administrator! Please promote another member to admin before leaving."
      );
      return;
    }

    if (
      !window.confirm(
        `Are you sure you want to leave "${group.name}"? You will no longer receive messages.`
      )
    ) {
      return;
    }

    try {
      setIsProcessingAction(true);
      await chatService.removeGroupMember({
        groupId: group.id,
        targetUserId: currentUserId,
      });
      toast.success(`You left "${group.name}"`);
      onClose();
      if (onLeaveGroup) onLeaveGroup(group.id);
    } catch (err) {
      toast.error(err.message || "Failed to leave group");
    } finally {
      setIsProcessingAction(false);
    }
  };

  // Delete Group (Admin only)
  const handleDeleteGroup = async () => {
    if (!isCurrentAdmin) {
      toast.error("Only group administrators can delete this group");
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to delete "${group.name}"?\n\nThis will permanently delete the group and all its messages for all members. This action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      setIsProcessingAction(true);
      await chatService.deleteGroup(group.id);
      toast.success(`Group "${group.name}" was deleted successfully`);
      onClose();
      if (onDeleteGroup) {
        onDeleteGroup(group.id);
      }
    } catch (err) {
      console.error("Delete group error:", err);
      toast.error(err.message || "Failed to delete group");
    } finally {
      setIsProcessingAction(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2">
            <FiUsers className="w-5 h-5 text-[#0F766E]" />
            <h3 className="text-base font-bold text-slate-900">Group Details</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Group Overview Banner */}
          <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200/70">
            {/* Avatar */}
            <div className="relative group shrink-0">
              <div className="w-16 h-16 rounded-2xl bg-teal-600 text-white flex items-center justify-center font-bold text-xl uppercase overflow-hidden shadow-xs">
                {group.group_image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={group.group_image}
                    alt={group.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  getNameInitials(group.name)
                )}
              </div>
              {isCurrentAdmin && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute -bottom-1 -right-1 w-6 h-6 bg-[#0F766E] text-white rounded-full flex items-center justify-center shadow-xs hover:bg-[#0D655E] cursor-pointer transition-colors"
                  title="Change group avatar"
                >
                  <FiCamera className="w-3.5 h-3.5" />
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
              />
            </div>

            {/* Info or Edit Form */}
            <div className="flex-1 min-w-0">
              {isEditingInfo ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full text-xs sm:text-sm font-bold bg-white border border-teal-300 rounded-lg px-2.5 py-1 text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-teal-600"
                    placeholder="Group name"
                  />
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-teal-600"
                    placeholder="Optional description"
                  />
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleSaveInfo}
                      disabled={isSavingInfo}
                      className="px-3 py-1 bg-[#0F766E] text-white text-xs font-bold rounded-lg shadow-2xs hover:bg-[#0D655E] flex items-center gap-1 cursor-pointer"
                    >
                      <FiCheck className="w-3.5 h-3.5" />
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setName(group.name || "");
                        setDescription(group.description || "");
                        setIsEditingInfo(false);
                      }}
                      className="px-2.5 py-1 text-slate-500 text-xs hover:text-slate-800 cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <h4 className="text-base font-bold text-slate-900 truncate">
                      {group.name}
                    </h4>
                    {isCurrentAdmin && (
                      <button
                        type="button"
                        onClick={() => setIsEditingInfo(true)}
                        className="p-1 text-slate-400 hover:text-slate-700 rounded-md hover:bg-slate-200/60 cursor-pointer transition-colors"
                        title="Edit group details"
                      >
                        <FiEdit3 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  {group.description && (
                    <p className="text-xs text-slate-600 mb-2 line-clamp-2">
                      {group.description}
                    </p>
                  )}
                  <div className="flex items-center gap-2 text-[11px] text-slate-400">
                    <span className="px-2 py-0.5 rounded-full bg-teal-50 text-[#0F766E] font-semibold border border-teal-200/60">
                      {enrichedMembers.length} Members
                    </span>
                    <span>•</span>
                    <span className="capitalize">
                      Your role: <strong className="text-slate-700">{currentUserRole}</strong>
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Members Section Header */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h5 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Group Members ({enrichedMembers.length})
              </h5>
              {isCurrentAdmin && !isAddingMembers && nonGroupMembers.length > 0 && (
                <button
                  type="button"
                  onClick={() => setIsAddingMembers(true)}
                  className="flex items-center gap-1.5 px-3 py-1 bg-teal-50 text-[#0F766E] hover:bg-teal-100 border border-teal-200/80 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  <FiUserPlus className="w-3.5 h-3.5" />
                  Add Members
                </button>
              )}
            </div>

            {/* Add Members Panel (when toggled on by admin) */}
            {isAddingMembers && (
              <div className="p-3 bg-teal-50/50 border border-teal-200/80 rounded-2xl space-y-2.5 animate-in fade-in duration-150">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-teal-900">
                    Select Teammates to Add
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingMembers(false);
                      setSelectedNewUserIds([]);
                    }}
                    className="text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <FiX className="w-4 h-4" />
                  </button>
                </div>

                {/* Search */}
                <div className="relative">
                  <FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={memberSearchQuery}
                    onChange={(e) => setMemberSearchQuery(e.target.value)}
                    placeholder="Search by name or email..."
                    className="w-full bg-white border border-slate-200 text-xs rounded-xl pl-8 pr-3 py-1.5 focus:outline-hidden focus:border-[#0F766E]"
                  />
                </div>

                {/* List of candidates */}
                <div className="max-h-40 overflow-y-auto space-y-1 bg-white border border-slate-100 rounded-xl p-1">
                  {filteredNonGroupMembers.length > 0 ? (
                    filteredNonGroupMembers.map((m) => {
                      const isSelected = selectedNewUserIds.includes(m.user_id);
                      return (
                        <button
                          key={m.user_id}
                          type="button"
                          onClick={() => {
                            setSelectedNewUserIds((prev) =>
                              prev.includes(m.user_id)
                                ? prev.filter((id) => id !== m.user_id)
                                : [...prev, m.user_id]
                            );
                          }}
                          className={`w-full flex items-center justify-between p-1.5 rounded-lg text-left text-xs cursor-pointer ${
                            isSelected
                              ? "bg-teal-50 text-teal-900 font-semibold"
                              : "hover:bg-slate-50 text-slate-700"
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <div className="w-6 h-6 rounded-lg bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-[10px]">
                              {getNameInitials(m.full_name)}
                            </div>
                            <span className="truncate">{m.full_name}</span>
                          </div>
                          <div
                            className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 ${
                              isSelected
                                ? "bg-[#0F766E] border-[#0F766E] text-white"
                                : "border-slate-300 bg-white"
                            }`}
                          >
                            {isSelected && <FiCheck className="w-3 h-3 stroke-3" />}
                          </div>
                        </button>
                      );
                    })
                  ) : (
                    <div className="py-3 text-center text-xs text-slate-400">
                      No matching teammates to add.
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingMembers(false);
                      setSelectedNewUserIds([]);
                    }}
                    className="px-3 py-1 text-xs text-slate-600 hover:text-slate-800 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleAddMembersSubmit}
                    disabled={selectedNewUserIds.length === 0 || isSubmittingAdd}
                    className="px-4 py-1.5 bg-[#0F766E] text-white text-xs font-bold rounded-xl shadow-2xs hover:bg-[#0D655E] disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                  >
                    {isSubmittingAdd ? "Adding..." : `Add (${selectedNewUserIds.length})`}
                  </button>
                </div>
              </div>
            )}

            {/* Current Members List */}
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {isLoadingMembers ? (
                <div className="py-6 text-center text-xs text-slate-400">
                  <div className="w-5 h-5 border-2 border-slate-300 border-t-[#0F766E] rounded-full animate-spin mx-auto mb-1.5" />
                  Loading members...
                </div>
              ) : enrichedMembers.length > 0 ? (
                enrichedMembers.map((member) => {
                  const isMe = member.user_id === currentUserId;
                  const isMemberAdmin = member.role === "admin";
                  const isMenuOpen = openMenuMemberId === member.user_id;

                  return (
                    <div
                      key={member.user_id}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50/70 hover:bg-slate-100/70 border border-slate-200/60 transition-colors relative"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs uppercase shrink-0 overflow-hidden ${
                            isMemberAdmin
                              ? "bg-amber-100 text-amber-800 border border-amber-300/80"
                              : "bg-slate-200 text-slate-700 border border-slate-300"
                          }`}
                        >
                          {member.avatar_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={member.avatar_url}
                              alt={member.full_name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            getNameInitials(member.full_name)
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-xs font-bold text-slate-900 truncate">
                              {member.full_name}
                            </p>
                            {isMe && (
                              <span className="text-[10px] text-teal-700 font-semibold bg-teal-50 px-1.5 py-0.2 rounded border border-teal-200/60">
                                You
                              </span>
                            )}
                          </div>
                          {member.email && (
                            <p className="text-[11px] text-slate-500 truncate">
                              {member.email}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Role & Admin Actions */}
                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border ${
                            isMemberAdmin
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : "bg-slate-100 text-slate-600 border-slate-200"
                          }`}
                        >
                          {member.role}
                        </span>

                        {/* Three-dot menu for admins managing other members */}
                        {isCurrentAdmin && !isMe && (
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() =>
                                setOpenMenuMemberId(isMenuOpen ? null : member.user_id)
                              }
                              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
                              title="Member actions"
                            >
                              <FiMoreVertical className="w-4 h-4" />
                            </button>

                            {isMenuOpen && (
                              <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-xl shadow-lg border border-slate-200 py-1 z-20 animate-in fade-in zoom-in-95 duration-100">
                                {isMemberAdmin ? (
                                  <button
                                    type="button"
                                    onClick={() => handleRoleChange(member, "member")}
                                    disabled={isProcessingAction}
                                    className="w-full px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                                  >
                                    <FiUser className="w-3.5 h-3.5 text-slate-400" />
                                    Dismiss as Admin
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleRoleChange(member, "admin")}
                                    disabled={isProcessingAction}
                                    className="w-full px-3 py-1.5 text-left text-xs text-amber-700 hover:bg-amber-50 flex items-center gap-2 cursor-pointer font-medium"
                                  >
                                    <FiShield className="w-3.5 h-3.5 text-amber-600" />
                                    Make Group Admin
                                  </button>
                                )}

                                <div className="h-px bg-slate-100 my-1" />

                                <button
                                  type="button"
                                  onClick={() => handleRemoveMember(member)}
                                  disabled={isProcessingAction}
                                  className="w-full px-3 py-1.5 text-left text-xs text-rose-600 hover:bg-rose-50 flex items-center gap-2 cursor-pointer font-medium"
                                >
                                  <FiTrash2 className="w-3.5 h-3.5" />
                                  Remove from Group
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-4 text-center text-xs text-slate-400">
                  No members found in this group.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer (Leave Group & Delete Group) */}
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleLeaveGroup}
              disabled={isProcessingAction}
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 px-3 py-1.5 rounded-xl transition-colors cursor-pointer"
            >
              <FiLogOut className="w-3.5 h-3.5 text-slate-500" />
              Leave Group
            </button>

            {isCurrentAdmin && (
              <button
                type="button"
                onClick={handleDeleteGroup}
                disabled={isProcessingAction}
                className="flex items-center gap-1.5 text-xs font-bold text-rose-600 hover:text-white hover:bg-rose-600 border border-rose-200 hover:border-rose-600 px-3 py-1.5 rounded-xl transition-all cursor-pointer shadow-2xs"
                title="Permanently delete this group"
              >
                <FiTrash2 className="w-3.5 h-3.5" />
                Delete Group
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-bold text-slate-600 hover:text-slate-800 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer shadow-2xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
