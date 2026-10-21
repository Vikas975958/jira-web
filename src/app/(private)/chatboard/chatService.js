import { supabase } from "@/lib/supabaseconfig";

/**
 * Service for managing 1-to-1 private chat conversations and messages.
 */
export const chatService = {
  /**
   * Fetch all 1-to-1 conversations for the current user in an organization.
   * @param {Object} params
   * @param {string} params.organizationId
   * @param {string} params.userId
   * @returns {Promise<Array>} List of conversations
   */
  async getConversations({ organizationId, userId }) {
    if (!organizationId || !userId) return [];

    try {
      const { data, error } = await supabase
        .from("chat_conversations")
        .select("*")
        .eq("organization_id", organizationId)
        .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
        .order("last_message_at", { ascending: false });

      if (error) {
        console.error("chatService.getConversations error:", error);
        return [];
      }

      return data || [];
    } catch (err) {
      console.error("chatService.getConversations unexpected error:", err);
      return [];
    }
  },

  /**
   * Get an existing conversation between two users or create a new one.
   * Uses the database RPC `get_or_create_chat_conversation` with fallback to direct insert.
   * @param {Object} params
   * @param {string} params.organizationId
   * @param {string} params.currentUserId
   * @param {string} params.otherUserId
   * @returns {Promise<Object>} Conversation record
   */
  async getOrCreateConversation({ organizationId, currentUserId, otherUserId }) {
    if (!organizationId || !currentUserId || !otherUserId) {
      throw new Error("Missing organizationId, currentUserId, or otherUserId");
    }

    if (currentUserId === otherUserId) {
      throw new Error("Cannot create a chat conversation with yourself");
    }

    // Try RPC first for safe atomic concurrency
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc(
        "get_or_create_chat_conversation",
        {
          p_organization_id: organizationId,
          p_other_user_id: otherUserId,
        }
      );

      if (!rpcError && rpcData && rpcData.length > 0) {
        return rpcData[0];
      }
    } catch (rpcErr) {
      console.warn("RPC get_or_create_chat_conversation failed, falling back to direct table query:", rpcErr);
    }

    // Direct table query fallback
    const u1 = currentUserId < otherUserId ? currentUserId : otherUserId;
    const u2 = currentUserId < otherUserId ? otherUserId : currentUserId;

    // Check if conversation exists
    const { data: existing, error: findError } = await supabase
      .from("chat_conversations")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("user1_id", u1)
      .eq("user2_id", u2)
      .maybeSingle();

    if (existing) {
      return existing;
    }

    // If not existing, insert a new conversation
    const { data: newConv, error: insertError } = await supabase
      .from("chat_conversations")
      .insert({
        organization_id: organizationId,
        user1_id: u1,
        user2_id: u2,
        last_message_text: "",
        last_message_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      // If error due to race condition (unique constraint), retry query
      const { data: retryConv } = await supabase
        .from("chat_conversations")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("user1_id", u1)
        .eq("user2_id", u2)
        .maybeSingle();

      if (retryConv) return retryConv;
      throw insertError;
    }

    return newConv;
  },

  /**
   * Fetch messages for a specific conversation.
   * @param {string} conversationId
   * @param {number} [limit=100]
   * @returns {Promise<Array>} List of messages
   */
  async getMessages(conversationId, limit = 100) {
    if (!conversationId) return [];

    try {
      const { data, error } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true })
        .limit(limit);

      if (error) {
        console.error("chatService.getMessages error:", error);
        return [];
      }

      return data || [];
    } catch (err) {
      console.error("chatService.getMessages unexpected error:", err);
      return [];
    }
  },

  /**
   * Send a private message in a conversation.
   * @param {Object} params
   * @param {string} params.conversationId
   * @param {string} params.senderId
   * @param {string} params.recipientId
   * @param {string} params.message
   * @returns {Promise<Object>} Created message
   */
  async sendMessage({ conversationId, senderId, recipientId, message }) {
    if (!conversationId || !senderId || !recipientId || !message?.trim()) {
      throw new Error("Missing required fields to send message");
    }

    const trimmedMsg = message.trim();
    const now = new Date().toISOString();

    const { data: newMsg, error: msgError } = await supabase
      .from("chat_messages")
      .insert({
        conversation_id: conversationId,
        sender_id: senderId,
        recipient_id: recipientId,
        message: trimmedMsg,
        is_read: false,
        created_at: now,
      })
      .select()
      .single();

    if (msgError) {
      console.error("chatService.sendMessage error:", msgError);
      throw msgError;
    }

    // Direct update to chat_conversations in case trigger is delayed or absent
    try {
      await supabase
        .from("chat_conversations")
        .update({
          last_message_text: trimmedMsg.substring(0, 200),
          last_message_at: now,
          last_sender_id: senderId,
          updated_at: now,
        })
        .eq("id", conversationId);
    } catch (e) {
      console.warn("Could not update conversation last_message directly:", e);
    }

    return newMsg;
  },

  /**
   * Mark all unread messages received by the user in a conversation as read.
   * @param {Object} params
   * @param {string} params.conversationId
   * @param {string} params.userId
   * @returns {Promise<number>} Number of rows updated
   */
  async markMessagesAsRead({ conversationId, userId }) {
    if (!conversationId || !userId) return 0;

    try {
      // Try RPC first
      const { data: rpcCount, error: rpcError } = await supabase.rpc(
        "mark_chat_messages_as_read",
        { p_conversation_id: conversationId }
      );

      if (!rpcError && typeof rpcCount === "number") {
        return rpcCount;
      }
    } catch (e) {
      // Fallback
    }

    try {
      const { data, error } = await supabase
        .from("chat_messages")
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq("conversation_id", conversationId)
        .eq("recipient_id", userId)
        .eq("is_read", false)
        .select("id");

      if (error) {
        console.error("chatService.markMessagesAsRead fallback error:", error);
        return 0;
      }

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("chat-messages-read"));
      }

      return data ? data.length : 0;
    } catch (err) {
      console.error("chatService.markMessagesAsRead error:", err);
      return 0;
    } finally {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("chat-messages-read"));
      }
    }
  },

  /**
   * Fetch unread message counts grouped by conversation for a user.
   * @param {Object} params
   * @param {string} params.userId
   * @returns {Promise<Object>} Map of conversationId -> unreadCount
   */
  async getUnreadCounts({ userId }) {
    if (!userId) return {};

    try {
      const { data, error } = await supabase
        .from("chat_messages")
        .select("conversation_id")
        .eq("recipient_id", userId)
        .eq("is_read", false);

      if (error) {
        console.error("chatService.getUnreadCounts error:", error);
        return {};
      }

      const counts = {};
      (data || []).forEach((row) => {
        counts[row.conversation_id] = (counts[row.conversation_id] || 0) + 1;
      });

      return counts;
    } catch (err) {
      console.error("chatService.getUnreadCounts unexpected error:", err);
      return {};
    }
  },

  /**
   * Realtime subscription to a specific conversation's messages.
   * @param {string} conversationId
   * @param {Function} onNewMessage
   * @param {Function} [onMessageUpdate]
   * @returns {Object} Channel subscription (call .unsubscribe() when done)
   */
  subscribeToConversation(conversationId, onNewMessage, onMessageUpdate) {
    if (!conversationId) return null;

    const channelName = `chat_conv_${conversationId}_${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          if (payload?.new && onNewMessage) {
            onNewMessage(payload.new);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "chat_messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          if (payload?.new && onMessageUpdate) {
            onMessageUpdate(payload.new);
          }
        }
      )
      .subscribe();

    return channel;
  },

  /**
   * Realtime subscription for any incoming messages or conversation updates for a user.
   * @param {string} userId
   * @param {Function} onNotification
   * @returns {Object} Channel subscription
   */
  subscribeToUserUpdates(userId, onNotification) {
    if (!userId) return null;

    const channelName = `user_chat_events_${userId}_${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `recipient_id=eq.${userId}`,
        },
        (payload) => {
          if (payload?.new && onNotification) {
            onNotification({ type: "NEW_MESSAGE", data: payload.new });
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chat_conversations",
        },
        (payload) => {
          const row = payload?.new || payload?.old;
          if (row && (row.user1_id === userId || row.user2_id === userId)) {
            if (onNotification) {
              onNotification({ type: "CONVERSATION_UPDATED", data: row });
            }
          }
        }
      )
      .subscribe();

    return channel;
  },

  /**
   * Track online presence for all users in an organization via Supabase Realtime Presence.
   * @param {string} organizationId
   * @param {string} userId
   * @param {Function} onPresenceChange
   * @returns {Object} Channel subscription
   */
  trackOnlinePresence(organizationId, userId, onPresenceChange) {
    if (!organizationId || !userId) return null;

    const channelName = `online_presence_${organizationId}`;
    const channel = supabase.channel(channelName, {
      config: {
        presence: {
          key: userId,
        },
      },
    });

    const notify = () => {
      const state = channel.presenceState();
      const onlineKeys = Object.keys(state || {});
      if (onPresenceChange) {
        onPresenceChange(onlineKeys);
      }
    };

    channel
      .on("presence", { event: "sync" }, notify)
      .on("presence", { event: "join" }, notify)
      .on("presence", { event: "leave" }, notify)
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            user_id: userId,
            online_at: new Date().toISOString(),
          });
        }
      });

    return channel;
  },
};

export default chatService;
