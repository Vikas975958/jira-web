"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useSelector } from "react-redux";
import {
  FiMessageSquare,
  FiX,
  FiArrowRight,
  FiCornerDownLeft,
} from "react-icons/fi";
import { supabase } from "@/lib/supabaseconfig";
import { useOrganization } from "@/context/OrganizationContext";
import { getNameInitials } from "@/utils/commonFunction";
import { OWNER_ROLE, MANAGER_ROLE, MEMBER_ROLE } from "@/utils/constants";

/**
 * Play a pleasant, soft two-tone chime via Web Audio API.
 * Requires 0 external audio files and works instantaneously.
 */
function playChimeSound() {
  try {
    const AudioContextClass =
      window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;

    // Tone 1: Gentle Sine Note (D5 - 587.33 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(587.33, now);
    gain1.gain.setValueAtTime(0.09, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.16);

    // Tone 2: Cheerful Higher Sine Note (A5 - 880 Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(880, now + 0.07);
    gain2.gain.setValueAtTime(0.12, now + 0.07);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.07);
    osc2.stop(now + 0.28);
  } catch (_) {
    // Audio context may be restricted by browser policy before user interaction
  }
}

/**
 * Single Google Chat style notification card.
 */
function NotificationCard({ notif, onDismiss, onOpenChat }) {
  const [isHovered, setIsHovered] = useState(false);
  const [progress, setProgress] = useState(100);
  const remainingTimeRef = useRef(7500); // 7.5 seconds
  const lastTickRef = useRef(Date.now());

  // Handle countdown & progress bar with hover pause
  useEffect(() => {
    lastTickRef.current = Date.now();
    const interval = setInterval(() => {
      if (isHovered) {
        lastTickRef.current = Date.now();
        return;
      }

      const now = Date.now();
      const delta = now - lastTickRef.current;
      lastTickRef.current = now;

      remainingTimeRef.current -= delta;
      const pct = Math.max(0, (remainingTimeRef.current / 7500) * 100);
      setProgress(pct);

      if (remainingTimeRef.current <= 0) {
        clearInterval(interval);
        onDismiss(notif.id);
      }
    }, 50);

    return () => clearInterval(interval);
  }, [isHovered, notif.id, onDismiss]);

  const initials = getNameInitials(notif.senderName || "User");

  const getRoleBadgeStyle = (role) => {
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
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="pointer-events-auto bg-white/98 backdrop-blur-md rounded-2xl border border-slate-200/90 shadow-2xl p-3.5 w-84 sm:w-96 transition-all duration-300 hover:shadow-teal-900/10 hover:border-teal-300/80 group select-none relative overflow-hidden animate-in slide-in-from-bottom-5 fade-in duration-200"
    >
      {/* Top Header Bar */}
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 rounded-md bg-[#0F766E] text-white flex items-center justify-center shadow-2xs">
            <FiMessageSquare className="w-3 h-3" />
          </div>
          <span className="text-[11px] font-bold text-slate-700 tracking-wide">
            WorkGrid Chat
          </span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse ml-0.5" />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-400 font-medium">
            Just now
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDismiss(notif.id);
            }}
            className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 p-1 rounded-full transition-colors cursor-pointer"
            title="Dismiss notification"
          >
            <FiX className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Clickable Area */}
      <div
        onClick={() => onOpenChat(notif)}
        className="flex items-start gap-3 cursor-pointer"
      >
        {/* User Avatar with Presence Dot */}
        <div className="relative shrink-0 mt-0.5">
          <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200/90 text-slate-800 font-bold flex items-center justify-center text-xs uppercase shadow-2xs group-hover:bg-teal-50 group-hover:text-[#0F766E] group-hover:border-teal-200 transition-colors">
            {initials}
          </div>
          <span
            className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-white shadow-2xs"
            title="Online"
          />
        </div>

        {/* Sender details and message preview */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-xs sm:text-sm font-bold text-slate-900 truncate">
              {notif.senderName}
            </p>
            {notif.senderRole && (
              <span
                className={`text-[9px] px-1.5 py-0.2 rounded-md font-bold uppercase tracking-wider border ${getRoleBadgeStyle(
                  notif.senderRole
                )}`}
              >
                {notif.senderRole}
              </span>
            )}
          </div>

          {/* Message snippet */}
          <div className="mt-1 bg-slate-50/90 group-hover:bg-teal-50/40 border border-slate-100 group-hover:border-teal-100 rounded-lg p-2 transition-colors">
            <p className="text-xs text-slate-700 leading-snug line-clamp-2 font-medium break-words">
              {notif.message}
            </p>
          </div>
        </div>
      </div>

      {/* Footer / Reply Action Button */}
      <div className="mt-2.5 pt-2 flex items-center justify-between">
        <span className="text-[10px] text-slate-400 font-medium">
          Click to reply
        </span>
        <button
          type="button"
          onClick={() => onOpenChat(notif)}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0F766E] hover:text-[#0D655E] bg-teal-50/80 hover:bg-teal-100/90 px-2.5 py-1 rounded-lg border border-teal-200/70 transition-all cursor-pointer shadow-2xs group/btn"
        >
          <span>Reply</span>
          <FiArrowRight className="w-3 h-3 transition-transform group-hover/btn:translate-x-0.5" />
        </button>
      </div>

      {/* Progress Bar Timer */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-100">
        <div
          className="h-full bg-gradient-to-r from-teal-500 to-[#0F766E] transition-all ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Global Realtime Chat Notification Manager.
 * Listens to incoming chat messages and renders Google Chat style bottom-right notifications.
 */
export default function ChatNotificationPopup() {
  const router = useRouter();
  const pathname = usePathname();
  const authState = useSelector((state) => state.authSlice);
  const user = authState?.userData;
  const currentUserId = user?.id;

  const { members = [] } = useOrganization();
  const membersRef = useRef(members);

  useEffect(() => {
    membersRef.current = members;
  }, [members]);

  const [notifications, setNotifications] = useState([]);

  // Auto request notification permission on user's first interaction
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission().catch(() => {});
      }
    }
  }, []);

  const dismissNotification = useCallback((id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  // Clear any notification for a user if their chat conversation is currently open or opened
  useEffect(() => {
    const handleConversationOpened = (e) => {
      const targetUserId = e?.detail?.userId;
      const targetConvId = e?.detail?.conversationId;

      setNotifications((prev) =>
        prev.filter((n) => {
          if (
            targetUserId &&
            String(n.senderId).toLowerCase() === String(targetUserId).toLowerCase()
          ) {
            return false;
          }
          if (
            targetConvId &&
            String(n.conversationId).toLowerCase() === String(targetConvId).toLowerCase()
          ) {
            return false;
          }
          return true;
        })
      );
    };

    if (typeof window !== "undefined") {
      window.addEventListener(
        "chat-conversation-opened",
        handleConversationOpened
      );
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener(
          "chat-conversation-opened",
          handleConversationOpened
        );
      }
    };
  }, []);

  // When pathname changes or route updates to /chatboard, clear notifications matching currently open chat
  useEffect(() => {
    if (typeof window === "undefined") return;
    const currentPath = pathname || window.location.pathname || "";
    if (currentPath.includes("/chatboard")) {
      const activeId = window.__WORKGRID_ACTIVE_CHAT_USER_ID__;
      const activeCId = window.__WORKGRID_ACTIVE_CONVERSATION_ID__;
      if (activeId || activeCId) {
        setNotifications((prev) =>
          prev.filter((n) => {
            if (
              activeId &&
              String(n.senderId).toLowerCase() === String(activeId).toLowerCase()
            ) {
              return false;
            }
            if (
              activeCId &&
              String(n.conversationId).toLowerCase() === String(activeCId).toLowerCase()
            ) {
              return false;
            }
            return true;
          })
        );
      }
    }
  }, [pathname]);

  const openChat = useCallback(
    (notif) => {
      dismissNotification(notif.id);

      if (pathname === "/chatboard") {
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("open-chat-user", {
              detail: { userId: notif.senderId },
            })
          );
        }
      } else {
        router.push(`/chatboard?userId=${notif.senderId}`);
      }
    },
    [pathname, router, dismissNotification]
  );

  // Subscribe to real-time incoming messages
  useEffect(() => {
    if (!currentUserId) return;

    const channelName = `chat_notif_popup_${currentUserId}_${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `recipient_id=eq.${currentUserId}`,
        },
        async (payload) => {
          const newMsg = payload?.new;
          if (!newMsg || !newMsg.sender_id) return;

          // Smart suppression: if the chat of this user is already open, DO NOT show notify message
          const currentPath =
            (pathname || "") ||
            (typeof window !== "undefined" ? window.location.pathname : "");
          const isOnChatboard =
            currentPath.startsWith("/chatboard") ||
            currentPath.includes("/chatboard");

          const activeChatUserId =
            typeof window !== "undefined"
              ? window.__WORKGRID_ACTIVE_CHAT_USER_ID__
              : null;
          const activeConvId =
            typeof window !== "undefined"
              ? window.__WORKGRID_ACTIVE_CONVERSATION_ID__
              : null;

          const isMobile =
            typeof window !== "undefined" && window.innerWidth < 768;
          const isMobileChatOpen =
            typeof window !== "undefined"
              ? window.__WORKGRID_IS_MOBILE_CHAT_OPEN__ ?? true
              : true;
          const isChatVisible = !isMobile || isMobileChatOpen;

          const matchesSender =
            Boolean(activeChatUserId) &&
            String(activeChatUserId).toLowerCase() ===
              String(newMsg.sender_id).toLowerCase();

          const matchesConversation =
            Boolean(activeConvId) &&
            Boolean(newMsg.conversation_id) &&
            String(activeConvId).toLowerCase() ===
              String(newMsg.conversation_id).toLowerCase();

          const isChatAlreadyOpen =
            isOnChatboard &&
            isChatVisible &&
            (matchesSender || matchesConversation);

          // If the chat of this user is already open, DO NOT show notification!
          if (isChatAlreadyOpen) {
            return;
          }

          // Resolve sender information from members list or fallback query
          let sender = (membersRef.current || []).find(
            (m) =>
              (m.user_id || m.id || m.profiles?.id) === newMsg.sender_id
          );

          let senderName =
            sender?.full_name ||
            sender?.name ||
            sender?.profiles?.full_name ||
            null;
          let senderRole = sender?.role || "member";
          let senderEmail = sender?.email || sender?.profiles?.email || "";

          // If sender not in active members cache, fetch profile once
          if (!senderName) {
            try {
              const { data: profile } = await supabase
                .from("profiles")
                .select("id, full_name, email, role")
                .eq("id", newMsg.sender_id)
                .maybeSingle();

              if (profile) {
                senderName =
                  profile.full_name ||
                  profile.email?.split("@")[0] ||
                  "Teammate";
                senderRole = profile.role || senderRole;
                senderEmail = profile.email || senderEmail;
              }
            } catch (_) {}
          }

          if (!senderName) {
            senderName = "Teammate";
          }

          // Play modern chime sound
          playChimeSound();

          // If window/tab is in the background, trigger standard desktop Notification
          if (
            typeof window !== "undefined" &&
            typeof document !== "undefined" &&
            document.hidden &&
            "Notification" in window &&
            Notification.permission === "granted"
          ) {
            try {
              const deskNotif = new Notification(
                `Message from ${senderName}`,
                {
                  body: newMsg.message,
                  icon: "/favicon.ico",
                }
              );
              deskNotif.onclick = () => {
                window.focus();
                openChat({
                  id: newMsg.id,
                  senderId: newMsg.sender_id,
                });
              };
            } catch (_) {}
          }

          // Add to notifications queue (keep at most 3 cards stacked)
          setNotifications((prev) => {
            const filtered = prev.filter(
              (n) => n.senderId !== newMsg.sender_id
            );
            const item = {
              id: newMsg.id || String(Date.now()),
              conversationId: newMsg.conversation_id,
              senderId: newMsg.sender_id,
              senderName,
              senderRole,
              senderEmail,
              message: newMsg.message,
              createdAt: newMsg.created_at || new Date().toISOString(),
            };
            return [...filtered.slice(-2), item];
          });
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [currentUserId, pathname, openChat]);

  if (notifications.length === 0) return null;

  return (
    <aside
      aria-label="New chat notifications"
      className="fixed bottom-5 right-5 z-[999999] flex flex-col items-end gap-3 pointer-events-none"
    >
      {notifications.map((notif) => (
        <NotificationCard
          key={notif.id}
          notif={notif}
          onDismiss={dismissNotification}
          onOpenChat={openChat}
        />
      ))}
    </aside>
  );
}

