"use client";

import React, { useState, useMemo } from "react";
import {
  FiSearch,
  FiMessageSquare,
  FiUsers,
  FiPlus,
} from "react-icons/fi";
import { getNameInitials } from "@/utils/commonFunction";
import { MANAGER_ROLE, OWNER_ROLE } from "@/utils/constants";

export default function ChatSidebar({
  conversations = [],
  activeConversation = null,
  teamMembers = [],
  unreadCounts = {},
  groups = [],
  groupUnreadCounts = {},
  currentUserId,
  onStartChatWithUser,
  onSelectGroup,
  onOpenCreateGroup,
  searchQuery,
  setSearchQuery,
  onlineUserIds = [],
  isLoading = false,
}) {
  const [activeTab, setActiveTab] = useState("direct"); // "direct" | "groups"

  // Calculate total unread counts for badges
  const totalDirectUnreads = useMemo(() => {
    return Object.values(unreadCounts).reduce((acc, c) => acc + (c || 0), 0);
  }, [unreadCounts]);

  const totalGroupUnreads = useMemo(() => {
    return Object.values(groupUnreadCounts).reduce((acc, c) => acc + (c || 0), 0);
  }, [groupUnreadCounts]);

  // Combine team members with any active conversation metadata
  const memberList = useMemo(() => {
    const convByOtherUserId = new Map();
    conversations.forEach((conv) => {
      const otherUserId = conv.user1_id === currentUserId ? conv.user2_id : conv.user1_id;
      convByOtherUserId.set(otherUserId, conv);
    });

    return (teamMembers || [])
      .map((m) => {
        const uId = m.user_id || m.id || m.profiles?.id;
        const conv = convByOtherUserId.get(uId);
        const unread = conv ? unreadCounts[conv.id] || 0 : 0;

        return {
          user_id: uId,
          full_name: m.full_name || m.name || m.profiles?.full_name || "Teammate",
          email: m.email || m.profiles?.email || "",
          role: m.role || "member",
          conversation: conv,
          last_message_text: conv?.last_message_text || "",
          last_message_at: conv?.last_message_at || null,
          unread,
        };
      })
      .filter((m) => {
        if (!m.user_id || m.user_id === currentUserId) return false;
        if (!searchQuery?.trim()) return true;
        const q = searchQuery.toLowerCase().trim();
        return (
          m.full_name.toLowerCase().includes(q) ||
          m.email.toLowerCase().includes(q) ||
          m.role.toLowerCase().includes(q) ||
          m.last_message_text.toLowerCase().includes(q)
        );
      });
  }, [teamMembers, conversations, currentUserId, unreadCounts, searchQuery]);

  // Filtered Groups list
  const filteredGroups = useMemo(() => {
    return (groups || []).filter((g) => {
      if (!searchQuery?.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        g.name?.toLowerCase().includes(q) ||
        g.description?.toLowerCase().includes(q) ||
        g.last_message_text?.toLowerCase().includes(q)
      );
    });
  }, [groups, searchQuery]);

  // Format relative timestamp helper
  const formatTimeAgo = (dateStr) => {
    if (!dateStr) return "";
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 1) return "Just now";
      if (diffMins < 60) return `${diffMins}m`;
      if (diffHours < 24) return `${diffHours}h`;
      if (diffDays === 1) return "Yesterday";
      if (diffDays < 7) return `${diffDays}d`;
      return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    } catch (e) {
      return "";
    }
  };

  const getRoleBadge = (role) => {
    switch (role) {
      case OWNER_ROLE:
        return "bg-amber-50 text-amber-700 border-amber-200/80";
      case MANAGER_ROLE:
        return "bg-indigo-50 text-indigo-700 border-indigo-200/80";
      default:
        return "bg-teal-50 text-[#0F766E] border-teal-200/80";
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-white border-r border-slate-200 select-none overflow-hidden">
      {/* Sidebar Header */}
      <div className="p-3 border-b border-slate-200/80 space-y-2.5 shrink-0 bg-slate-50/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#0F766E] text-white flex items-center justify-center font-bold text-xs shadow-2xs">
              <FiMessageSquare className="w-3.5 h-3.5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 leading-tight">
                WorkGrid Chat
              </h2>
            </div>
          </div>

          {/* New Group Button */}
          {onOpenCreateGroup && (
            <button
              type="button"
              onClick={onOpenCreateGroup}
              className="flex items-center gap-1 px-2.5 py-1 bg-[#0F766E] hover:bg-[#0D655E] text-white rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer"
              title="Create new group"
            >
              <FiPlus className="w-3.5 h-3.5" />
              <span>New Group</span>
            </button>
          )}
        </div>

        {/* Tab Switcher: Direct Messages vs Groups */}
        <div className="grid grid-cols-2 gap-1 p-1 bg-slate-200/60 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveTab("direct")}
            className={`flex items-center justify-center gap-1.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === "direct"
                ? "bg-white text-slate-900 shadow-2xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <FiMessageSquare className="w-3.5 h-3.5" />
            <span>Direct</span>
            {totalDirectUnreads > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-[#0F766E] text-white text-[9px] font-bold">
                {totalDirectUnreads}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("groups")}
            className={`flex items-center justify-center gap-1.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === "groups"
                ? "bg-white text-slate-900 shadow-2xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <FiUsers className="w-3.5 h-3.5" />
            <span>Groups</span>
            {totalGroupUnreads > 0 ? (
              <span className="px-1.5 py-0.2 rounded-full bg-[#0F766E] text-white text-[9px] font-bold">
                {totalGroupUnreads}
              </span>
            ) : groups.length > 0 ? (
              <span className="text-[10px] text-slate-400 font-semibold">
                ({groups.length})
              </span>
            ) : null}
          </button>
        </div>

        {/* Search input */}
        <div className="relative">
          <FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              activeTab === "direct"
                ? "Search team & managers..."
                : "Search group conversations..."
            }
            className="w-full bg-white border border-slate-200 text-xs text-slate-800 placeholder-slate-400 rounded-lg pl-8 pr-2.5 py-1.5 focus:outline-hidden focus:border-[#0F766E] focus:ring-1 focus:ring-teal-600/20 transition-all shadow-2xs"
          />
        </div>
      </div>

      {/* Main Content Area based on Active Tab */}
      {activeTab === "direct" ? (
        /* ================= Direct Messages List ================= */
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          <div className="px-2 py-1 flex items-center justify-between text-[11px] font-semibold text-slate-400 tracking-wider uppercase">
            <span>Team Members ({memberList.length})</span>
          </div>

          {isLoading && memberList.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400 space-y-2">
              <div className="w-5 h-5 border-2 border-slate-300 border-t-[#0F766E] rounded-full animate-spin mx-auto" />
              <p>Loading team members...</p>
            </div>
          ) : memberList.length > 0 ? (
            memberList.map((member) => {
              const isSelected =
                activeConversation &&
                !activeConversation.isGroup &&
                (activeConversation.user1_id === member.user_id ||
                  activeConversation.user2_id === member.user_id);
              const initials = getNameInitials(member.full_name);
              const timeAgo = formatTimeAgo(member.last_message_at);
              const roleBadgeClass = getRoleBadge(member.role);
              const isOnline = onlineUserIds.includes(member.user_id);

              return (
                <button
                  key={member.user_id}
                  type="button"
                  onClick={() => onStartChatWithUser(member)}
                  className={`w-full flex items-center gap-2.5 p-2 rounded-xl text-left transition-colors cursor-pointer relative group ${
                    isSelected
                      ? "bg-teal-50/90 border border-teal-200 shadow-2xs ring-1 ring-teal-600/10"
                      : "hover:bg-slate-50 border border-transparent"
                  }`}
                >
                  {/* Avatar with presence dot */}
                  <div className="relative shrink-0">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs uppercase shadow-2xs transition-colors ${
                        isSelected
                          ? "bg-[#0F766E] text-white"
                          : "bg-slate-100 text-slate-700 border border-slate-200 group-hover:border-teal-200"
                      }`}
                    >
                      {initials}
                    </div>
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-white transition-all ${
                        isOnline ? "bg-emerald-500 shadow-xs" : "bg-slate-300"
                      }`}
                      title={isOnline ? "Online" : "Offline"}
                    />
                  </div>

                  {/* Member Info & Last Message */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <p className="text-xs font-bold text-slate-900 truncate">
                        {member.full_name}
                      </p>
                      {timeAgo && (
                        <span className="text-[10px] text-slate-400 shrink-0 font-medium">
                          {timeAgo}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-1">
                      <p
                        className={`text-[11px] truncate ${
                          member.unread > 0
                            ? "font-semibold text-slate-900"
                            : "text-slate-500 font-normal"
                        }`}
                      >
                        {member.last_message_text || member.email || "Click to start chatting"}
                      </p>

                      <div className="flex items-center gap-1 shrink-0">
                        <span
                          className={`text-[8px] px-1.5 py-0.2 rounded font-semibold uppercase tracking-wider border ${roleBadgeClass}`}
                        >
                          {member.role}
                        </span>

                        {member.unread > 0 && (
                          <span className="px-1.5 py-0.2 rounded-full bg-[#0F766E] text-white text-[9px] font-bold">
                            {member.unread}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })
          ) : (
            <div className="py-8 text-center text-xs text-slate-400 space-y-1">
              <FiUsers className="w-6 h-6 mx-auto text-slate-300" />
              <p className="font-medium text-slate-600">No team members found</p>
              <p className="text-[10px] text-slate-400">
                Try searching with a different name or email.
              </p>
            </div>
          )}
        </div>
      ) : (
        /* ================= Groups List ================= */
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          <div className="px-2 py-1 flex items-center justify-between text-[11px] font-semibold text-slate-400 tracking-wider uppercase">
            <span>Groups ({filteredGroups.length})</span>
            {onOpenCreateGroup && (
              <button
                type="button"
                onClick={onOpenCreateGroup}
                className="text-[11px] text-[#0F766E] hover:underline font-bold capitalize cursor-pointer flex items-center gap-0.5"
              >
                <FiPlus className="w-3 h-3" />
                <span>Create</span>
              </button>
            )}
          </div>

          {isLoading && filteredGroups.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400 space-y-2">
              <div className="w-5 h-5 border-2 border-slate-300 border-t-[#0F766E] rounded-full animate-spin mx-auto" />
              <p>Loading groups...</p>
            </div>
          ) : filteredGroups.length > 0 ? (
            filteredGroups.map((grp) => {
              const isSelected =
                activeConversation &&
                activeConversation.isGroup &&
                activeConversation.id === grp.id;
              const unread = groupUnreadCounts[grp.id] || 0;
              const timeAgo = formatTimeAgo(grp.last_message_at);

              return (
                <button
                  key={grp.id}
                  type="button"
                  onClick={() => onSelectGroup && onSelectGroup(grp)}
                  className={`w-full flex items-center gap-2.5 p-2 rounded-xl text-left transition-colors cursor-pointer relative group ${
                    isSelected
                      ? "bg-teal-50/90 border border-teal-200 shadow-2xs ring-1 ring-teal-600/10"
                      : "hover:bg-slate-50 border border-transparent"
                  }`}
                >
                  {/* Group Avatar */}
                  <div className="relative shrink-0">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs uppercase shadow-2xs transition-colors overflow-hidden ${
                        isSelected
                          ? "bg-[#0F766E] text-white"
                          : "bg-teal-700 text-white"
                      }`}
                    >
                      {grp.group_image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={grp.group_image}
                          alt={grp.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        getNameInitials(grp.name)
                      )}
                    </div>
                  </div>

                  {/* Group Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <p className="text-xs font-bold text-slate-900 truncate">
                        {grp.name}
                      </p>
                      {timeAgo && (
                        <span className="text-[10px] text-slate-400 shrink-0 font-medium">
                          {timeAgo}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-1">
                      <p
                        className={`text-[11px] truncate ${
                          unread > 0
                            ? "font-semibold text-slate-900"
                            : "text-slate-500 font-normal"
                        }`}
                      >
                        {grp.last_message_text || grp.description || "No messages yet"}
                      </p>

                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-[9px] px-1.5 py-0.2 rounded-full font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                          {grp.memberCount || 1}
                        </span>

                        {unread > 0 && (
                          <span className="px-1.5 py-0.2 rounded-full bg-[#0F766E] text-white text-[9px] font-bold">
                            {unread}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })
          ) : (
            <div className="py-8 text-center text-xs text-slate-400 space-y-2">
              <div className="w-10 h-10 rounded-2xl bg-teal-50 text-[#0F766E] flex items-center justify-center mx-auto shadow-2xs">
                <FiUsers className="w-5 h-5" />
              </div>
              <p className="font-semibold text-slate-700">No groups yet</p>
              <p className="text-[11px] text-slate-400 max-w-[200px] mx-auto">
                Create a group to chat and collaborate with teammates together!
              </p>
              {onOpenCreateGroup && (
                <button
                  type="button"
                  onClick={onOpenCreateGroup}
                  className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0F766E] text-white rounded-xl text-xs font-bold hover:bg-[#0D655E] shadow-2xs transition-all cursor-pointer"
                >
                  <FiPlus className="w-3.5 h-3.5" />
                  <span>Create First Group</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}