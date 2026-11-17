"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";
import { useOrganization } from "@/context/OrganizationContext";
import chatService from "./chatService";
import ChatSidebar from "./components/ChatSidebar";
import ChatConversationArea from "./components/ChatConversationArea";
import EmptyChatState from "./components/EmptyChatState";
import CreateGroupModal from "./components/CreateGroupModal";
import GroupDetailsModal from "./components/GroupDetailsModal";
import { MEMBER_ROLE } from "@/utils/constants";

export default function ChatboardPage() {
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

  // 1-to-1 Conversations States
  const [conversations, setConversations] = useState([]);
  const [unreadCounts, setUnreadCounts] = useState({});
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);

  // Group Chat States
  const [groups, setGroups] = useState([]);
  const [groupUnreadCounts, setGroupUnreadCounts] = useState({});
  const [isLoadingGroups, setIsLoadingGroups] = useState(true);
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [isGroupDetailsOpen, setIsGroupDetailsOpen] = useState(false);

  // Active Chat & Messages State (Unified for 1-to-1 and Groups)
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // Message Pagination States (Infinite Scroll)
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [isLoadingOlderMessages, setIsLoadingOlderMessages] = useState(false);
  const isLoadingOlderRef = useRef(false);

  // Search & Online Presence States
  const [searchQuery, setSearchQuery] = useState("");
  const [onlineUserIds, setOnlineUserIds] = useState([]);

  // Mobile navigation: true = show active conversation, false = show sidebar
  const [isMobileChatOpen, setIsMobileChatOpen] = useState(false);

  // Realtime channel references
  const activeConversationChannelRef = useRef(null);
  const userChannelRef = useRef(null);
  const userGroupChannelRef = useRef(null);
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

  // Load 1-to-1 Conversations and Unread Counts
  const loadConversations = useCallback(
    async (showLoading = false) => {
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
    },
    [orgId, currentUserId]
  );

  // Load Groups and Group Unread Counts
  const loadGroups = useCallback(
    async (showLoading = false) => {
      if (!orgId || !currentUserId) return;
      try {
        if (showLoading) {
          setIsLoadingGroups(true);
        }
        const fetchedGroups = await chatService.getGroups({
          organizationId: orgId,
          userId: currentUserId,
        });

        setGroups(fetchedGroups || []);

        if (fetchedGroups && fetchedGroups.length > 0) {
          const groupIds = fetchedGroups.map((g) => g.id);
          const grpUnreads = await chatService.getGroupUnreadCounts({
            userId: currentUserId,
            groupIds,
          });
          setGroupUnreadCounts(grpUnreads || {});
        } else {
          setGroupUnreadCounts({});
        }
      } catch (err) {
        console.error("loadGroups error:", err);
      } finally {
        if (showLoading) {
          setIsLoadingGroups(false);
        }
      }
    },
    [orgId, currentUserId]
  );

  useEffect(() => {
    loadConversations(true);
    loadGroups(true);
  }, [loadConversations, loadGroups]);

  // Load Messages for Active Conversation or Group (Initial Batch)
  const loadMessages = useCallback(
    async (conv) => {
      if (!conv?.id) {
        setMessages([]);
        setHasMoreMessages(false);
        setIsLoadingOlderMessages(false);
        isLoadingOlderRef.current = false;
        return;
      }
      try {
        setIsLoadingMessages(true);
        isLoadingOlderRef.current = false;

        let res;
        if (conv.isGroup) {
          res = await chatService.getGroupMessages({
            groupId: conv.id,
            limit: 30,
          });
        } else {
          res = await chatService.getMessages({
            conversationId: conv.id,
            limit: 30,
          });
        }

        const initialMsgs = res?.messages || (Array.isArray(res) ? res : []);
        setMessages(initialMsgs);
        setHasMoreMessages(Boolean(res?.hasMore));

        // Mark incoming messages as read
        if (currentUserId) {
          if (conv.isGroup) {
            await chatService.markGroupMessagesAsRead({
              groupId: conv.id,
              userId: currentUserId,
            });
            setGroupUnreadCounts((prev) => ({ ...prev, [conv.id]: 0 }));
          } else {
            await chatService.markMessagesAsRead({
              conversationId: conv.id,
              userId: currentUserId,
            });
            setUnreadCounts((prev) => ({ ...prev, [conv.id]: 0 }));
          }
        }
      } catch (err) {
        console.error("loadMessages error:", err);
      } finally {
        setIsLoadingMessages(false);
      }
    },
    [currentUserId]
  );

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

      let res;
      if (activeConversation.isGroup) {
        res = await chatService.getGroupMessages({
          groupId: activeConversation.id,
          limit: 30,
          beforeTimestamp: oldestMessage.created_at,
        });
      } else {
        res = await chatService.getMessages({
          conversationId: activeConversation.id,
          limit: 30,
          beforeTimestamp: oldestMessage.created_at,
        });
      }

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
  }, [activeConversation, hasMoreMessages, messages]);

  // Edit Message Handler (Unified for 1-to-1 and Group Messages)
  const handleEditMessage = useCallback(
    async ({ messageId, newMessage }) => {
      if (
        !messageId ||
        !newMessage?.trim() ||
        !currentUserId ||
        !activeConversation?.id
      ) {
        return;
      }

      try {
        let updated;
        if (activeConversation.isGroup) {
          updated = await chatService.editGroupMessage({
            messageId,
            newMessage: newMessage.trim(),
            senderId: currentUserId,
            groupId: activeConversation.id,
          });
        } else {
          updated = await chatService.editMessage({
            messageId,
            newMessage: newMessage.trim(),
            senderId: currentUserId,
            conversationId: activeConversation.id,
          });
        }

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
        const isLatest = messages[messages.length - 1]?.id === messageId;
        if (isLatest) {
          if (activeConversation.isGroup) {
            setGroups((prev) =>
              prev.map((g) =>
                g.id === activeConversation.id
                  ? { ...g, last_message_text: newMessage.trim() }
                  : g
              )
            );
          } else {
            setConversations((prev) =>
              prev.map((c) =>
                c.id === activeConversation.id
                  ? { ...c, last_message_text: newMessage.trim() }
                  : c
              )
            );
          }
        }

        return updated;
      } catch (err) {
        console.error("handleEditMessage error:", err);
        toast.error("Failed to edit message. Please try again.");
        throw err;
      }
    },
    [activeConversation, currentUserId, messages]
  );

  // Setup Realtime Subscription for Active Conversation (1-to-1 or Group)
  useEffect(() => {
    if (activeConversationChannelRef.current) {
      activeConversationChannelRef.current.unsubscribe();
      activeConversationChannelRef.current = null;
    }

    if (!activeConversation?.id) return;

    loadMessages(activeConversation);

    if (activeConversation.isGroup) {
      // Group Realtime Subscription
      const channel = chatService.subscribeToGroup(
        activeConversation.id,
        (newMsg) => {
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });

          // If current user is viewing this group and received a message, mark as read
          if (newMsg.sender_id !== currentUserId) {
            chatService.markGroupMessagesAsRead({
              groupId: activeConversation.id,
              userId: currentUserId,
            });
          }

          // Update last message in groups list
          setGroups((prev) =>
            prev.map((g) =>
              g.id === activeConversation.id
                ? {
                    ...g,
                    last_message_text: newMsg.message,
                    last_message_at: newMsg.created_at,
                    last_sender_id: newMsg.sender_id,
                  }
                : g
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
    } else {
      // 1-to-1 Realtime Subscription
      const channel = chatService.subscribeToConversation(
        activeConversation.id,
        (newMsg) => {
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });

          if (newMsg.recipient_id === currentUserId) {
            chatService.markMessagesAsRead({
              conversationId: activeConversation.id,
              userId: currentUserId,
            });
          }

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
    }

    return () => {
      if (activeConversationChannelRef.current) {
        activeConversationChannelRef.current.unsubscribe();
        activeConversationChannelRef.current = null;
      }
    };
  }, [activeConversation, loadMessages, currentUserId]);

  // Realtime Subscription for Background 1-to-1 Chat Events
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

          if (newMsg.conversation_id !== currentActiveId) {
            setUnreadCounts((prev) => ({
              ...prev,
              [newMsg.conversation_id]:
                (prev[newMsg.conversation_id] || 0) + 1,
            }));
          }

          setConversations((prev) => {
            const index = prev.findIndex(
              (c) => c.id === newMsg.conversation_id
            );
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

  // Realtime Subscription for Group Updates & Membership Changes
  useEffect(() => {
    if (!currentUserId) return;

    if (userGroupChannelRef.current) {
      userGroupChannelRef.current.unsubscribe();
      userGroupChannelRef.current = null;
    }

    const channel = chatService.subscribeToUserGroupUpdates(
      currentUserId,
      () => {
        // Refresh groups in background when group info or membership changes
        loadGroups(false);
      }
    );

    userGroupChannelRef.current = channel;

    return () => {
      if (userGroupChannelRef.current) {
        userGroupChannelRef.current.unsubscribe();
        userGroupChannelRef.current = null;
      }
    };
  }, [currentUserId, loadGroups]);

  // Open 1-to-1 Conversation
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
        (String(conv.user1_id).toLowerCase() ===
        String(currentUserId).toLowerCase()
          ? conv.user2_id
          : conv.user1_id);

      const formattedConv = {
        ...conv,
        isGroup: false,
      };

      setActiveConversation(formattedConv);
      setIsMobileChatOpen(true);
      setHasMoreMessages(false);
      setIsLoadingOlderMessages(false);
      isLoadingOlderRef.current = false;

      if (typeof window !== "undefined") {
        window.__WORKGRID_ACTIVE_CONVERSATION_ID__ = conv.id
          ? String(conv.id)
          : null;
        window.__WORKGRID_ACTIVE_CHAT_USER_ID__ = otherId
          ? String(otherId)
          : null;
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

  // Open Group Conversation
  const handleOpenGroup = useCallback((grp) => {
    if (!grp) return;

    const groupConv = {
      ...grp,
      isGroup: true,
    };

    setActiveConversation(groupConv);
    setIsMobileChatOpen(true);
    setHasMoreMessages(false);
    setIsLoadingOlderMessages(false);
    isLoadingOlderRef.current = false;

    if (typeof window !== "undefined") {
      window.__WORKGRID_ACTIVE_CONVERSATION_ID__ = grp.id ? String(grp.id) : null;
      window.__WORKGRID_ACTIVE_CHAT_USER_ID__ = null;
      window.__WORKGRID_IS_MOBILE_CHAT_OPEN__ = true;
    }
  }, []);

  // Start or Open Conversation with a specific user
  const handleStartChatWithUser = useCallback(
    async (targetUser) => {
      const targetUserId =
        targetUser.user_id || targetUser.id || targetUser.profiles?.id;
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

        const enrichedConv = {
          ...conv,
          isGroup: false,
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

  // Sync window global state for active conversation
  useEffect(() => {
    if (typeof window !== "undefined") {
      if (!activeConversation) {
        window.__WORKGRID_ACTIVE_CONVERSATION_ID__ = null;
        window.__WORKGRID_ACTIVE_CHAT_USER_ID__ = null;
        window.__WORKGRID_IS_MOBILE_CHAT_OPEN__ = false;
        return;
      }

      if (activeConversation.isGroup) {
        window.__WORKGRID_ACTIVE_CONVERSATION_ID__ = String(activeConversation.id);
        window.__WORKGRID_ACTIVE_CHAT_USER_ID__ = null;
        window.__WORKGRID_IS_MOBILE_CHAT_OPEN__ = Boolean(isMobileChatOpen);
      } else {
        const otherId =
          activeConversation.otherUserId ||
          activeConversation.otherUser?.user_id ||
          activeConversation.otherUser?.id ||
          (String(activeConversation.user1_id).toLowerCase() ===
          String(currentUserId).toLowerCase()
            ? activeConversation.user2_id
            : activeConversation.user1_id);

        window.__WORKGRID_ACTIVE_CONVERSATION_ID__ = activeConversation.id
          ? String(activeConversation.id)
          : null;
        window.__WORKGRID_ACTIVE_CHAT_USER_ID__ = otherId
          ? String(otherId)
          : null;
        window.__WORKGRID_IS_MOBILE_CHAT_OPEN__ = Boolean(isMobileChatOpen);

        window.dispatchEvent(
          new CustomEvent("chat-conversation-opened", {
            detail: { userId: otherId, conversationId: activeConversation.id },
          })
        );
      }
    }
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
  }, [
    queryUserId,
    members,
    currentUserId,
    activeConversation,
    handleStartChatWithUser,
  ]);

  // Handle direct custom event to open chat with user
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

  // Send Message Handler (Unified)
  const handleSendMessage = async (text) => {
    if (
      !activeConversation?.id ||
      !currentUserId ||
      !text.trim() ||
      isSending
    ) {
      return;
    }

    try {
      setIsSending(true);

      if (activeConversation.isGroup) {
        // Send to group
        const newMsg = await chatService.sendGroupMessage({
          groupId: activeConversation.id,
          senderId: currentUserId,
          message: text,
        });

        setMessages((prev) => {
          if (prev.some((m) => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });

        setGroups((prev) => {
          const remaining = prev.filter((g) => g.id !== activeConversation.id);
          const updated = {
            ...activeConversation,
            last_message_text: newMsg.message,
            last_message_at: newMsg.created_at,
            last_sender_id: currentUserId,
          };
          return [updated, ...remaining];
        });
      } else {
        // Send 1-to-1
        const otherUserId =
          activeConversation.user1_id === currentUserId
            ? activeConversation.user2_id
            : activeConversation.user1_id;

        const newMsg = await chatService.sendMessage({
          conversationId: activeConversation.id,
          senderId: currentUserId,
          recipientId: otherUserId,
          message: text,
        });

        setMessages((prev) => {
          if (prev.some((m) => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });

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
      }
    } catch (err) {
      console.error("handleSendMessage error:", err);
      toast.error("Failed to send message. Please try again.");
    } finally {
      setIsSending(false);
    }
  };

  // Group Creation Callback
  const handleCreateGroupSuccess = (newGroup) => {
    setGroups((prev) => [newGroup, ...prev]);
    handleOpenGroup(newGroup);
  };

  // Group Details Updates Callback
  const handleGroupUpdated = (updatedGroup) => {
    setGroups((prev) =>
      prev.map((g) =>
        g.id === updatedGroup.id ? { ...g, ...updatedGroup } : g
      )
    );
    if (activeConversation?.id === updatedGroup.id) {
      setActiveConversation((prev) => ({ ...prev, ...updatedGroup }));
    }
  };

  // Leave Group Callback
  const handleLeaveGroupSuccess = (groupId) => {
    setGroups((prev) => prev.filter((g) => g.id !== groupId));
    if (activeConversation?.id === groupId) {
      setActiveConversation(null);
      setMessages([]);
      setIsMobileChatOpen(false);
      if (typeof window !== "undefined") {
        window.__WORKGRID_ACTIVE_CONVERSATION_ID__ = null;
        window.__WORKGRID_IS_MOBILE_CHAT_OPEN__ = false;
      }
    }
  };

  // Delete Group Callback (Admin only)
  const handleDeleteGroupSuccess = (groupId) => {
    setGroups((prev) => prev.filter((g) => g.id !== groupId));
    setGroupUnreadCounts((prev) => {
      const next = { ...prev };
      delete next[groupId];
      return next;
    });
    if (activeConversation?.id === groupId) {
      setActiveConversation(null);
      setMessages([]);
      setIsMobileChatOpen(false);
      if (typeof window !== "undefined") {
        window.__WORKGRID_ACTIVE_CONVERSATION_ID__ = null;
        window.__WORKGRID_IS_MOBILE_CHAT_OPEN__ = false;
      }
    }
  };

  return (
    <div className="h-full max-h-full flex flex-col bg-white overflow-hidden select-none">
      {/* Main 2-Column Chat Area */}
      <div className="flex-1 flex overflow-hidden min-h-0 relative">
        {/* Left Column: Sidebar (Direct & Group Tabs) */}
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
            groups={groups}
            groupUnreadCounts={groupUnreadCounts}
            onSelectGroup={handleOpenGroup}
            onOpenCreateGroup={() => setIsCreateGroupOpen(true)}
            currentUserId={currentUserId}
            onStartChatWithUser={handleStartChatWithUser}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            onlineUserIds={onlineUserIds}
            isLoading={
              isLoadingConversations || loadingMembers || isLoadingGroups
            }
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
              allTeamMembers={members}
              onSendMessage={handleSendMessage}
              onEditMessage={handleEditMessage}
              onOpenGroupDetails={() => setIsGroupDetailsOpen(true)}
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
              isOtherUserOnline={
                activeConversation.isGroup
                  ? false
                  : onlineUserIds.includes(
                      activeConversation.user1_id === currentUserId
                        ? activeConversation.user2_id
                        : activeConversation.user1_id
                    )
              }
            />
          ) : (
            <EmptyChatState
              onSelectRoleFilter={(role) => setSearchQuery(role)}
            />
          )}
        </div>
      </div>

      {/* Create Group Modal */}
      <CreateGroupModal
        isOpen={isCreateGroupOpen}
        onClose={() => setIsCreateGroupOpen(false)}
        teamMembers={members}
        currentUserId={currentUserId}
        orgId={orgId}
        onCreateGroupSuccess={handleCreateGroupSuccess}
      />

      {/* Group Details Modal */}
      {activeConversation?.isGroup && (
        <GroupDetailsModal
          isOpen={isGroupDetailsOpen}
          onClose={() => setIsGroupDetailsOpen(false)}
          group={activeConversation}
          currentUserId={currentUserId}
          allTeamMembers={members}
          onGroupUpdated={handleGroupUpdated}
          onMemberChanged={() => loadGroups(false)}
          onLeaveGroup={handleLeaveGroupSuccess}
          onDeleteGroup={handleDeleteGroupSuccess}
        />
      )}
    </div>
  );
}