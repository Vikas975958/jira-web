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
  const loadConversations = useCallback(async () => {
    if (!orgId || !currentUserId) return;
    try {
      setIsLoadingConversations(true);
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
      setIsLoadingConversations(false);
    }
  }, [orgId, currentUserId]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Load Messages for Active Conversation
  const loadMessages = useCallback(async (conversationId) => {
    if (!conversationId) {
      setMessages([]);
      return;
    }
    try {
      setIsLoadingMessages(true);
      const data = await chatService.getMessages(conversationId);
      setMessages(data || []);
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

          // Refresh or re-order conversations
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
              loadConversations();
              return prev;
            }
          });
        } else if (notification.type === "CONVERSATION_UPDATED") {
          loadConversations();
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

        setActiveConversation(enrichedConv);
        setIsMobileChatOpen(true);
      } catch (err) {
        console.error("handleStartChatWithUser error:", err);
        toast.error("Could not initiate chat conversation. Please try again.");
      }
    },
    [orgId, currentUserId]
  );

  // Handle URL `userId` parameter auto-open
  useEffect(() => {
    if (queryUserId && members.length > 0 && currentUserId && !activeConversation) {
      const targetMember = members.find(
        (m) => (m.user_id || m.id || m.profiles?.id) === queryUserId
      );
      if (targetMember) {
        handleStartChatWithUser(targetMember);
      }
    }
  }, [queryUserId, members, currentUserId, activeConversation, handleStartChatWithUser]);

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
    <div className="h-full max-h-full flex flex-col bg-slate-100 overflow-hidden select-none">
      {/* Main 2-Column Chat Area */}
      <div className="flex-1 flex overflow-hidden min-h-0 relative">
        {/* Left Column: Sidebar (Team Members & Direct Messages) */}
        <div
          className={`w-full md:w-80 lg:w-96 shrink-0 h-full ${
            isMobileChatOpen ? "hidden md:flex" : "flex"
          }`}
        >
          <ChatSidebar
            conversations={conversations}
            activeConversation={activeConversation}
            onSelectConversation={(conv) => {
              setActiveConversation(conv);
              setIsMobileChatOpen(true);
            }}
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
              onBackClick={() => setIsMobileChatOpen(false)}
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
