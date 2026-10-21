"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  FiArrowLeft,
  FiSearch,
  FiX,
  FiCheck,
  FiShield,
  FiUser,
  FiClock,
  FiMessageSquare,
} from "react-icons/fi";
import { LuCheckCheck } from "react-icons/lu";
import { getNameInitials } from "@/utils/commonFunction";
import { MANAGER_ROLE, OWNER_ROLE } from "@/utils/constants";
import ChatMessageInput from "./ChatMessageInput";

export default function ChatConversationArea({
  conversation,
  messages = [],
  currentUserId,
  onSendMessage,
  onBackClick,
  isLoadingMessages = false,
  isSending = false,
  isOtherUserOnline = false,
}) {
  const [inChatSearch, setInChatSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const messagesEndRef = useRef(null);

  const otherUser = conversation?.otherUser || {
    full_name: "Workspace Member",
    email: "",
    role: "member",
  };

  // Auto-scroll to bottom on message load or new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Group messages by Date (Today, Yesterday, or formatted date)
  const groupedMessages = useMemo(() => {
    const groups = [];
    let currentGroup = null;

    const getDayKey = (dateStr) => {
      if (!dateStr) return "Unknown";
      const d = new Date(dateStr);
      const today = new Date();
      const yesterday = new Date();
      yesterday.setDate(today.getDate() - 1);

      if (d.toDateString() === today.toDateString()) return "Today";
      if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
      return d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: d.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
      });
    };

    messages.forEach((msg) => {
      const dayKey = getDayKey(msg.created_at);
      if (!currentGroup || currentGroup.date !== dayKey) {
        currentGroup = { date: dayKey, messages: [] };
        groups.push(currentGroup);
      }
      currentGroup.messages.push(msg);
    });

    return groups;
  }, [messages]);

  // Filter messages if in-chat search query exists
  const filteredGroups = useMemo(() => {
    if (!inChatSearch.trim()) return groupedMessages;
    const q = inChatSearch.toLowerCase().trim();

    return groupedMessages
      .map((g) => ({
        date: g.date,
        messages: g.messages.filter((m) => (m.message || "").toLowerCase().includes(q)),
      }))
      .filter((g) => g.messages.length > 0);
  }, [groupedMessages, inChatSearch]);

  const formatMessageTime = (dateStr) => {
    if (!dateStr) return "";
    try {
      const d = new Date(dateStr);
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
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
    <div className="flex-1 flex flex-col h-full bg-white select-none overflow-hidden relative">
      {/* Conversation Top Header */}
      <div className="px-4 py-2.5 bg-white border-b border-slate-200/80 flex items-center justify-between gap-3 shrink-0 shadow-2xs z-10">
        <div className="flex items-center gap-3 min-w-0">
          {/* Mobile Back Button */}
          <button
            type="button"
            onClick={onBackClick}
            className="md:hidden p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors shrink-0 cursor-pointer"
            title="Back to conversations"
          >
            <FiArrowLeft className="w-5 h-5" />
          </button>

          {/* Other User Avatar */}
          <div className="relative shrink-0">
            <div className="w-9 h-9 rounded-xl bg-teal-50 text-[#0F766E] border border-teal-200 flex items-center justify-center font-bold text-xs uppercase shadow-2xs">
              {getNameInitials(otherUser.full_name)}
            </div>
            <span
              className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-white transition-all ${
                isOtherUserOnline ? "bg-emerald-500 shadow-xs" : "bg-slate-300"
              }`}
              title={isOtherUserOnline ? "Online" : "Offline"}
            />
          </div>

          {/* User Info & Role */}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                {otherUser.full_name}
              </h3>
              <span
                className={`text-[9px] px-1.5 py-0.2 rounded font-semibold uppercase tracking-wider border shrink-0 ${getRoleBadge(
                  otherUser.role
                )}`}
              >
                {otherUser.role}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] truncate">
              {isOtherUserOnline ? (
                <span className="flex items-center gap-1 text-emerald-600 font-medium shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Online
                </span>
              ) : (
                <span className="flex items-center gap-1 text-slate-400 shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                  Offline
                </span>
              )}
              {otherUser.email && (
                <>
                  <span className="text-slate-300">•</span>
                  <span className="text-slate-400 truncate">{otherUser.email}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right actions (Search in conversation) */}
        <div className="flex items-center gap-1.5 shrink-0">
          {showSearch ? (
            <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 shadow-2xs">
              <FiSearch className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <input
                type="text"
                autoFocus
                value={inChatSearch}
                onChange={(e) => setInChatSearch(e.target.value)}
                placeholder="Search in chat..."
                className="w-32 sm:w-48 text-xs bg-transparent focus:outline-hidden text-slate-800 placeholder-slate-400"
              />
              <button
                type="button"
                onClick={() => {
                  setInChatSearch("");
                  setShowSearch(false);
                }}
                className="text-slate-400 hover:text-slate-700 p-0.5 cursor-pointer"
              >
                <FiX className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowSearch(true)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              title="Search messages in this conversation"
            >
              <FiSearch className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Messages Feed Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/40">
        {isLoadingMessages ? (
          <div className="h-full flex flex-col items-center justify-center space-y-2 text-slate-400 text-xs">
            <div className="w-6 h-6 border-2 border-slate-300 border-t-[#0F766E] rounded-full animate-spin" />
            <p>Loading conversation history...</p>
          </div>
        ) : filteredGroups.length > 0 ? (
          filteredGroups.map((group, groupIdx) => (
            <div key={groupIdx} className="space-y-3">
              {/* Date Group Header Divider */}
              <div className="flex items-center justify-center">
                <span className="px-2.5 py-0.5 rounded-full bg-slate-100 border border-slate-200/80 text-[10px] font-semibold text-slate-500 shadow-2xs">
                  {group.date}
                </span>
              </div>

              {/* Messages in Group */}
              {group.messages.map((msg) => {
                const isMe = msg.sender_id === currentUserId;
                const timeStr = formatMessageTime(msg.created_at);

                return (
                  <div
                    key={msg.id}
                    className={`flex items-end gap-2 group ${
                      isMe ? "justify-end" : "justify-start"
                    }`}
                  >
                    {/* Other User Avatar (on received message) */}
                    {!isMe && (
                      <div className="w-7 h-7 rounded-lg bg-teal-50 text-[#0F766E] border border-teal-200/80 flex items-center justify-center font-bold text-[10px] shrink-0 uppercase mb-0.5">
                        {getNameInitials(otherUser.full_name)}
                      </div>
                    )}

                    {/* Message Bubble */}
                    <div
                      className={`max-w-[78%] sm:max-w-md px-3.5 py-2 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-2xs transition-all ${
                        isMe
                          ? "bg-[#0F766E] text-white rounded-br-xs"
                          : "bg-white text-slate-800 border border-slate-200/80 rounded-bl-xs"
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words">{msg.message}</p>

                      <div
                        className={`flex items-center justify-end gap-1 mt-1 text-[9px] ${
                          isMe ? "text-teal-100" : "text-slate-400"
                        }`}
                      >
                        <span>{timeStr}</span>
                        {isMe && (
                          <span title={msg.is_read ? "Read" : "Sent"}>
                            {msg.is_read ? (
                              <LuCheckCheck className="w-3 h-3 text-teal-200 stroke-2" />
                            ) : (
                              <FiCheck className="w-2.5 h-2.5 text-teal-200" />
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        ) : (
          <div className="h-full flex flex-col items-center justify-center p-6 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-teal-50 text-[#0F766E] flex items-center justify-center">
              <FiMessageSquare className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <p className="text-xs sm:text-sm font-bold text-slate-800">
                Start the conversation with {otherUser.full_name}
              </p>
              <p className="text-[11px] text-slate-400 max-w-xs leading-relaxed">
                Send a private message to collaborate on projects, discuss tasks, and sync in real time.
              </p>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Message Input Bar */}
      <ChatMessageInput
        onSendMessage={onSendMessage}
        disabled={isSending}
        placeholder={`Message ${otherUser.full_name}...`}
      />
    </div>
  );
}
