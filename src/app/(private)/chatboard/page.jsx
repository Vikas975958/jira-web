"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";
import { useOrganization } from "@/context/OrganizationContext";
import chatService from "./chatService";
import ChatSidebar from "./components/ChatSidebar";
import ChatConversationArea from "./components/ChatConversationArea";
import EmptyChatState from "./components/EmptyChatState";
import { MEMBER_ROLE } from "@/utils/constants";

export default function ChatboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryUserId = searchParams?.get("userId");

  const authState = useSelector((state) => state.authSlice);
  const user = authState?.userData;
  const currentUserId = user?.id;

  const {
    currentOrg,
    organizations,
    members = [],
    loadingMembers,
  } = useOrganization();

  const activeOrg =
    currentOrg?.organizations ||
    currentOrg ||
    organizations?.[0]?.organizations ||
    organizations?.[0];
  const orgId = activeOrg?.id;
  const userRole = currentOrg?.role || organizations?.[0]?.role || user?.role || MEMBER_ROLE;

  // Conversations and Active Chat States
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [unreadCounts, setUnreadCounts] = useState({});
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // Message Pagination States (Infinite Scroll)
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [isLoadingOlderMessages, setIsLoadingOlderMessages] = useState(false);
  const isLoadingOlderRef = useRef(false);

  // Search State for Sidebar
  const [searchQuery, setSearchQuery] = useState("");
  const [onlineUserIds, setOnlineUserIds] = useState([]);

  // Mobile navigation: true = show active conversation, false = show sidebar
  const [isMobileChatOpen, setIsMobileChatOpen] = useState(false);

  // Realtime channel references
  const activeConversationChannelRef = useRef(null);
  const userChannelRef = useRef(null);
  const activeConvRef = useRef(activeConversation);

  useEffect(() => {
    activeConvRef.current = activeConversation;
  }, [activeConversation]);

  // Track online presence of users in active organization
  useEffect(() => {
    if (!orgId || !currentUserId) return;

    const channel = chatService.trackOnlinePresence(
      orgId,
      currentUserId,
      (onlineIds) => {
        setOnlineUserIds(onlineIds || []);
      }
    );

    return () => {
      if (channel) {
        channel.unsubscribe();
      }
    };
  }, [orgId, currentUserId]);

  // Load Conversations and Unread Counts
  const loadConversations = useCallback(async (showLoading = false) => {
    if (!orgId || !currentUserId) return;
    try {
      if (showLoading) {
        setIsLoadingConversations(true);
      }
      const [convs, unreads] = await Promise.all([
        chatService.getConversations({
          organizationId: orgId,
          userId: currentUserId,
        }),
        chatService.getUnreadCounts({
          userId: currentUserId,
        }),
      ]);

      setConversations(convs || []);
      setUnreadCounts(unreads || {});
    } catch (err) {
      console.error("loadConversations error:", err);
    } finally {
      if (showLoading) {
        setIsLoadingConversations(false);
      }
    }
  }, [orgId, currentUserId]);

  useEffect(() => {
    loadConversations(true);
  }, [loadConversations]);

  // Load Messages for Active Conversation (Initial Batch)
  const loadMessages = useCallback(async (conversationId) => {
    if (!conversationId) {
      setMessages([]);
      setHasMoreMessages(false);
      setIsLoadingOlderMessages(false);
      isLoadingOlderRef.current = false;
      return;
    }
    try {
      setIsLoadingMessages(true);
      isLoadingOlderRef.current = false;
      const res = await chatService.getMessages({
        conversationId,
        limit: 30,
      });
      const initialMsgs = res?.messages || (Array.isArray(res) ? res : []);
      setMessages(initialMsgs);
      setHasMoreMessages(Boolean(res?.hasMore));

      // Mark incoming messages as read
      if (currentUserId) {
        await chatService.markMessagesAsRead({
          conversationId,
          userId: currentUserId,
        });
        // Clear unread count for this conversation
        setUnreadCounts((prev) => ({ ...prev, [conversationId]: 0 }));
      }
    } catch (err) {
      console.error("loadMessages error:", err);
    } finally {
      setIsLoadingMessages(false);
    }
  }, [currentUserId]);

  // Load Older Messages (Reverse Infinite Scroll Pagination)
  const loadOlderMessages = useCallback(async () => {
    if (
      !activeConversation?.id ||
      isLoadingOlderRef.current ||
      !hasMoreMessages
    ) {
      return;
    }

    const oldestMessage = messages[0];
    if (!oldestMessage?.created_at) return;

    try {
      isLoadingOlderRef.current = true;
      setIsLoadingOlderMessages(true);

      const res = await chatService.getMessages({
        conversationId: activeConversation.id,
        limit: 30,
        beforeTimestamp: oldestMessage.created_at,
      });

      if (res?.messages && res.messages.length > 0) {
        setMessages((prev) => {
          const existingIds = new Set(prev.map((m) => m.id));
          const newOlder = res.messages.filter((m) => !existingIds.has(m.id));
          return [...newOlder, ...prev];
        });
      }

      setHasMoreMessages(Boolean(res?.hasMore));
    } catch (err) {
      console.error("loadOlderMessages error:", err);
    } finally {
      setIsLoadingOlderMessages(false);
      isLoadingOlderRef.current = false;
    }
  }, [activeConversation?.id, hasMoreMessages, messages]);

  // Edit Message Handler
  const handleEditMessage = useCallback(
    async ({ messageId, newMessage }) => {
      if (!messageId || !newMessage?.trim() || !currentUserId || !activeConversation?.id) {
        return;
      }

      try {
        const updated = await chatService.editMessage({
          messageId,
          newMessage: newMessage.trim(),
          senderId: currentUserId,
          conversationId: activeConversation.id,
        });

        // Immediately reflect changes in UI
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? {
                  ...m,
                  ...updated,
                  message: newMessage.trim(),
                  is_edited: true,
                  updated_at: updated?.updated_at || new Date().toISOString(),
                }
              : m
          )
        );

        // Update conversation preview if edited message was the latest
        setConversations((prev) =>
          prev.map((c) => {
            if (c.id === activeConversation.id) {
              const isLatest = messages[messages.length - 1]?.id === messageId;
              if (isLatest) {
                return {
                  ...c,
                  last_message_text: newMessage.trim(),
                };
              }
            }
            return c;
          })
        );

        return updated;
      } catch (err) {
        console.error("handleEditMessage error:", err);
        toast.error("Failed to edit message. Please try again.");
        throw err;
      }
    },
    [activeConversation?.id, currentUserId, messages]
  );

  // Setup Realtime Subscription for Active Conversation
  useEffect(() => {
    if (activeConversationChannelRef.current) {
      activeConversationChannelRef.current.unsubscribe();
      activeConversationChannelRef.current = null;
    }

    if (!activeConversation?.id) return;

    loadMessages(activeConversation.id);

    const channel = chatService.subscribeToConversation(
      activeConversation.id,
      (newMsg) => {
        setMessages((prev) => {
          if (prev.some((m) => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });

        // If I received this new message in the open chat, mark it read immediately
        if (newMsg.recipient_id === currentUserId) {
          chatService.markMessagesAsRead({
            conversationId: activeConversation.id,
            userId: currentUserId,
          });
        }

        // Update conversation last message in list
        setConversations((prev) =>
          prev.map((c) =>
            c.id === activeConversation.id
              ? {
                  ...c,
                  last_message_text: newMsg.message,
                  last_message_at: newMsg.created_at,
                  last_sender_id: newMsg.sender_id,
                }
              : c
          )
        );
      },
      (updatedMsg) => {
        setMessages((prev) =>
          prev.map((m) => (m.id === updatedMsg.id ? updatedMsg : m))
        );
      }
    );

    activeConversationChannelRef.current = channel;

    return () => {
      if (activeConversationChannelRef.current) {
        activeConversationChannelRef.current.unsubscribe();
        activeConversationChannelRef.current = null;
      }
    };
  }, [activeConversation?.id, loadMessages, currentUserId]);

  // Realtime Subscription for incoming background messages/updates across all chats
  useEffect(() => {
    if (!currentUserId) return;

    if (userChannelRef.current) {
      userChannelRef.current.unsubscribe();
      userChannelRef.current = null;
    }

    const channel = chatService.subscribeToUserUpdates(
      currentUserId,
      (notification) => {
        if (notification.type === "NEW_MESSAGE") {
          const newMsg = notification.data;
          const currentActiveId = activeConvRef.current?.id;

          // If the message is for a different conversation than the currently open one, increment unread
          if (newMsg.conversation_id !== currentActiveId) {
            setUnreadCounts((prev) => ({
              ...prev,
              [newMsg.conversation_id]: (prev[newMsg.conversation_id] || 0) + 1,
            }));
          }

          // Refresh or re-order conversations in-place without flashing
          setConversations((prev) => {
            const index = prev.findIndex((c) => c.id === newMsg.conversation_id);
            if (index !== -1) {
              const updated = {
                ...prev[index],
                last_message_text: newMsg.message,
                last_message_at: newMsg.created_at,
                last_sender_id: newMsg.sender_id,
              };
              const remaining = prev.filter((_, idx) => idx !== index);
              return [updated, ...remaining];
            } else {
              // Silently fetch in background only if a completely new conversation arrived
              loadConversations(false);
              return prev;
            }
          });
        } else if (notification.type === "CONVERSATION_UPDATED") {
          const updatedRow = notification.data;
          if (updatedRow?.id) {
            setConversations((prev) => {
              const index = prev.findIndex((c) => c.id === updatedRow.id);
              if (index !== -1) {
                const updated = {
                  ...prev[index],
                  ...updatedRow,
                };
                const remaining = prev.filter((_, idx) => idx !== index);
                return [updated, ...remaining];
              }
              return [updatedRow, ...prev];
            });
          }
        }
      }
    );

    userChannelRef.current = channel;

    return () => {
      if (userChannelRef.current) {
        userChannelRef.current.unsubscribe();
        userChannelRef.current = null;
      }
    };
  }, [currentUserId, loadConversations]);

  // Open conversation and sync active global state immediately
  const handleOpenConversation = useCallback(
    (conv) => {
      if (!conv) {
        setActiveConversation(null);
        if (typeof window !== "undefined") {
          window.__WORKGRID_ACTIVE_CONVERSATION_ID__ = null;
          window.__WORKGRID_ACTIVE_CHAT_USER_ID__ = null;
          window.__WORKGRID_IS_MOBILE_CHAT_OPEN__ = false;
        }
        return;
      }

      const otherId =
        conv.otherUserId ||
        conv.otherUser?.user_id ||
        conv.otherUser?.id ||
        (String(conv.user1_id).toLowerCase() === String(currentUserId).toLowerCase()
          ? conv.user2_id
          : conv.user1_id);

      setActiveConversation(conv);
      setIsMobileChatOpen(true);
      setHasMoreMessages(false);
      setIsLoadingOlderMessages(false);
      isLoadingOlderRef.current = false;

      if (typeof window !== "undefined") {
        window.__WORKGRID_ACTIVE_CONVERSATION_ID__ = conv.id ? String(conv.id) : null;
        window.__WORKGRID_ACTIVE_CHAT_USER_ID__ = otherId ? String(otherId) : null;
        window.__WORKGRID_IS_MOBILE_CHAT_OPEN__ = true;
        window.dispatchEvent(
          new CustomEvent("chat-conversation-opened", {
            detail: { userId: otherId, conversationId: conv.id },
          })
        );
      }
    },
    [currentUserId]
  );

  // Start or Open Conversation with a specific user
  const handleStartChatWithUser = useCallback(
    async (targetUser) => {
      const targetUserId = targetUser.user_id || targetUser.id || targetUser.profiles?.id;
      if (!targetUserId || !orgId || !currentUserId) return;

      if (targetUserId === currentUserId) {
        toast.info("This is your own profile account.");
        return;
      }

      try {
        const conv = await chatService.getOrCreateConversation({
          organizationId: orgId,
          currentUserId,
          otherUserId: targetUserId,
        });

        // Ensure otherUser data is attached
        const enrichedConv = {
          ...conv,
          otherUserId: targetUserId,
          otherUser: {
            user_id: targetUserId,
            full_name:
              targetUser.full_name ||
              targetUser.name ||
              targetUser.profiles?.full_name ||
              "Teammate",
            email: targetUser.email || targetUser.profiles?.email || "",
            role: targetUser.role || "member",
          },
        };

        // Add to conversations list if not present
        setConversations((prev) => {
          if (prev.some((c) => c.id === conv.id)) {
            return prev.map((c) => (c.id === conv.id ? { ...c, ...conv } : c));
          }
          return [enrichedConv, ...prev];
        });

        handleOpenConversation(enrichedConv);
      } catch (err) {
        console.error("handleStartChatWithUser error:", err);
        toast.error("Could not initiate chat conversation. Please try again.");
      }
    },
    [orgId, currentUserId, handleOpenConversation]
  );

  // Sync currently open conversation target user for smart notification suppression
  useEffect(() => {
    if (typeof window !== "undefined") {
      if (!activeConversation) {
        window.__WORKGRID_ACTIVE_CONVERSATION_ID__ = null;
        window.__WORKGRID_ACTIVE_CHAT_USER_ID__ = null;
        window.__WORKGRID_IS_MOBILE_CHAT_OPEN__ = false;
        return;
      }
      const otherId =
        activeConversation.otherUserId ||
        activeConversation.otherUser?.user_id ||
        activeConversation.otherUser?.id ||
        (String(activeConversation.user1_id).toLowerCase() === String(currentUserId).toLowerCase()
          ? activeConversation.user2_id
          : activeConversation.user1_id);

      window.__WORKGRID_ACTIVE_CONVERSATION_ID__ = activeConversation.id ? String(activeConversation.id) : null;
      window.__WORKGRID_ACTIVE_CHAT_USER_ID__ = otherId ? String(otherId) : null;
      window.__WORKGRID_IS_MOBILE_CHAT_OPEN__ = Boolean(isMobileChatOpen);

      window.dispatchEvent(
        new CustomEvent("chat-conversation-opened", {
          detail: { userId: otherId, conversationId: activeConversation.id },
        })
      );
    }
    return () => {
      if (typeof window !== "undefined") {
        window.__WORKGRID_ACTIVE_CONVERSATION_ID__ = null;
        window.__WORKGRID_ACTIVE_CHAT_USER_ID__ = null;
      }
    };
  }, [activeConversation, currentUserId, isMobileChatOpen]);

  // Handle URL `userId` parameter auto-open or switch
  useEffect(() => {
    if (queryUserId && members.length > 0 && currentUserId) {
      const currentOtherId =
        activeConversation?.otherUserId ||
        (activeConversation?.user1_id === currentUserId
          ? activeConversation?.user2_id
          : activeConversation?.user1_id);

      if (currentOtherId !== queryUserId) {
        const targetMember = members.find(
          (m) => (m.user_id || m.id || m.profiles?.id) === queryUserId
        );
        if (targetMember) {
          handleStartChatWithUser(targetMember);
        }
      }
    }
  }, [queryUserId, members, currentUserId, activeConversation, handleStartChatWithUser]);

  // Handle direct custom event to open chat with user (from notification or external triggers)
  useEffect(() => {
    const handleOpenChatUserEvent = (e) => {
      const targetId = e?.detail?.userId;
      if (!targetId || !members.length) return;
      const targetMember = members.find(
        (m) => (m.user_id || m.id || m.profiles?.id) === targetId
      );
      if (targetMember) {
        handleStartChatWithUser(targetMember);
      }
    };

    if (typeof window !== "undefined") {
      window.addEventListener("open-chat-user", handleOpenChatUserEvent);
    }

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("open-chat-user", handleOpenChatUserEvent);
      }
    };
  }, [members, handleStartChatWithUser]);

  // Send Message Handler
  const handleSendMessage = async (text) => {
    if (!activeConversation?.id || !currentUserId || !text.trim() || isSending) return;

    const otherUserId =
      activeConversation.user1_id === currentUserId
        ? activeConversation.user2_id
        : activeConversation.user1_id;

    try {
      setIsSending(true);

      const newMsg = await chatService.sendMessage({
        conversationId: activeConversation.id,
        senderId: currentUserId,
        recipientId: otherUserId,
        message: text,
      });

      // Optimistic append if realtime takes a second
      setMessages((prev) => {
        if (prev.some((m) => m.id === newMsg.id)) return prev;
        return [...prev, newMsg];
      });

      // Update conversation in list
      setConversations((prev) => {
        const remaining = prev.filter((c) => c.id !== activeConversation.id);
        const updated = {
          ...activeConversation,
          last_message_text: newMsg.message,
          last_message_at: newMsg.created_at,
          last_sender_id: currentUserId,
        };
        return [updated, ...remaining];
      });
    } catch (err) {
      console.error("handleSendMessage error:", err);
      toast.error("Failed to send message. Please try again.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="h-full max-h-full flex flex-col bg-white overflow-hidden select-none">
      {/* Main 2-Column Chat Area */}
      <div className="flex-1 flex overflow-hidden min-h-0 relative">
        {/* Left Column: Sidebar (Team Members & Direct Messages) */}
        <div
          className={`w-full md:w-80 shrink-0 h-full ${
            isMobileChatOpen ? "hidden md:flex" : "flex"
          }`}
        >
          <ChatSidebar
            conversations={conversations}
            activeConversation={activeConversation}
            onSelectConversation={handleOpenConversation}
            teamMembers={members}
            unreadCounts={unreadCounts}
            currentUserId={currentUserId}
            onStartChatWithUser={handleStartChatWithUser}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            onlineUserIds={onlineUserIds}
            isLoading={isLoadingConversations || loadingMembers}
          />
        </div>

        {/* Right Column: Active Conversation or Empty State */}
        <div
          className={`flex-1 h-full min-w-0 ${
            !isMobileChatOpen ? "hidden md:flex" : "flex"
          }`}
        >
          {activeConversation ? (
            <ChatConversationArea
              conversation={activeConversation}
              messages={messages}
              currentUserId={currentUserId}
              onSendMessage={handleSendMessage}
              onEditMessage={handleEditMessage}
              hasMoreMessages={hasMoreMessages}
              isLoadingOlderMessages={isLoadingOlderMessages}
              onLoadOlderMessages={loadOlderMessages}
              onBackClick={() => {
                setIsMobileChatOpen(false);
                if (typeof window !== "undefined") {
                  window.__WORKGRID_IS_MOBILE_CHAT_OPEN__ = false;
                }
              }}
              isLoadingMessages={isLoadingMessages}
              isSending={isSending}
              isOtherUserOnline={onlineUserIds.includes(
                activeConversation.user1_id === currentUserId
                  ? activeConversation.user2_id
                  : activeConversation.user1_id
              )}
            />
          ) : (
            <EmptyChatState
              onSelectRoleFilter={(role) => setSearchQuery(role)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
