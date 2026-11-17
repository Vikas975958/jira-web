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
   * Fetch paginated messages for a specific conversation.
   * Fetches latest messages first (reverse chronological) and returns them in ascending order.
   * Supports both object params and legacy positional arguments.
   * @param {Object|string} arg1 - { conversationId, limit, beforeTimestamp } or conversationId string
   * @param {number} [arg2=30] - limit if arg1 is string
   * @param {string|null} [arg3=null] - beforeTimestamp if arg1 is string
   * @returns {Promise<{ messages: Array, hasMore: boolean }>}
   */
  async getMessages(arg1, arg2 = 30, arg3 = null) {
    let conversationId;
    let limit = 30;
    let beforeTimestamp = null;

    if (typeof arg1 === "object" && arg1 !== null) {
      conversationId = arg1.conversationId;
      limit = arg1.limit || 30;
      beforeTimestamp = arg1.beforeTimestamp || null;
    } else {
      conversationId = arg1;
      limit = typeof arg2 === "number" ? arg2 : 30;
      beforeTimestamp = arg3 || null;
    }

    if (!conversationId) return { messages: [], hasMore: false };

    try {
      let query = supabase
        .from("chat_messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (beforeTimestamp) {
        query = query.lt("created_at", beforeTimestamp);
      }

      const { data, error } = await query;

      if (error) {
        console.error("chatService.getMessages error:", error);
        return { messages: [], hasMore: false };
      }

      const raw = data || [];
      const hasMore = raw.length === limit;
      // Reverse to chronological order (oldest to newest)
      const messages = [...raw].reverse();

      return { messages, hasMore };
    } catch (err) {
      console.error("chatService.getMessages unexpected error:", err);
      return { messages: [], hasMore: false };
    }
  },

  /**
   * Edit an existing message sent by the user.
   * @param {Object} params
   * @param {string} params.messageId
   * @param {string} params.newMessage
   * @param {string} params.senderId
   * @param {string} [params.conversationId]
   * @returns {Promise<Object>} Updated message
   */
  async editMessage({ messageId, newMessage, senderId, conversationId }) {
    if (!messageId || !newMessage?.trim() || !senderId) {
      throw new Error("Missing required fields to edit message");
    }

    const trimmedMsg = newMessage.trim();
    const now = new Date().toISOString();

    let updatePayload = {
      message: trimmedMsg,
      updated_at: now,
      is_edited: true,
    };

    let { data: updatedMsg, error } = await supabase
      .from("chat_messages")
      .update(updatePayload)
      .eq("id", messageId)
      .eq("sender_id", senderId)
      .select()
      .maybeSingle();

    // Fallback if is_edited column is not in remote schema
    if (error && error.message && error.message.includes("is_edited")) {
      delete updatePayload.is_edited;
      const res = await supabase
        .from("chat_messages")
        .update(updatePayload)
        .eq("id", messageId)
        .eq("sender_id", senderId)
        .select()
        .maybeSingle();
      updatedMsg = res.data;
      error = res.error;
    }

    if (error) {
      console.error("chatService.editMessage error:", error);
      throw error;
    }

    // If conversationId is provided, update conversation preview if this was the latest message
    if (conversationId) {
      try {
        const { data: latestMsg } = await supabase
          .from("chat_messages")
          .select("id")
          .eq("conversation_id", conversationId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (latestMsg && latestMsg.id === messageId) {
          await supabase
            .from("chat_conversations")
            .update({
              last_message_text: trimmedMsg.substring(0, 200),
              updated_at: now,
            })
            .eq("id", conversationId);
        }
      } catch (convErr) {
        console.warn("Could not update conversation last_message preview:", convErr);
      }
    }

    return updatedMsg;
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

  // ===========================================================================
  // GROUP CHAT SERVICES
  // ===========================================================================

  /**
   * Fetch all active groups the current user belongs to within an organization.
   * @param {Object} params
   * @param {string} params.organizationId
   * @param {string} params.userId
   * @returns {Promise<Array>} List of group objects with member counts & user role
   */
  async getGroups({ organizationId, userId }) {
    if (!organizationId || !userId) return [];

    try {
      // 1. Find group IDs where current user is an active member
      const { data: memberRows, error: memberErr } = await supabase
        .from("chat_group_members")
        .select("group_id, role")
        .eq("user_id", userId)
        .eq("is_active", true);

      if (memberErr) {
        // If table doesn't exist yet, return empty list gracefully
        console.warn("chatService.getGroups chat_group_members error:", memberErr);
        return [];
      }

      if (!memberRows || memberRows.length === 0) {
        return [];
      }

      const groupIds = memberRows.map((r) => r.group_id);
      const roleMap = new Map(memberRows.map((r) => [r.group_id, r.role]));

      // 2. Fetch the corresponding chat_groups records
      const { data: groups, error: groupErr } = await supabase
        .from("chat_groups")
        .select("*")
        .in("id", groupIds)
        .eq("organization_id", organizationId)
        .eq("is_active", true)
        .order("last_message_at", { ascending: false });

      if (groupErr) {
        console.error("chatService.getGroups chat_groups error:", groupErr);
        return [];
      }

      if (!groups || groups.length === 0) {
        return [];
      }

      // 3. Count active members per group
      const { data: countRows } = await supabase
        .from("chat_group_members")
        .select("group_id")
        .in("group_id", groupIds)
        .eq("is_active", true);

      const countMap = {};
      (countRows || []).forEach((row) => {
        countMap[row.group_id] = (countMap[row.group_id] || 0) + 1;
      });

      // 4. Enrich group records
      return groups.map((g) => ({
        ...g,
        isGroup: true,
        currentUserRole: roleMap.get(g.id) || "member",
        memberCount: countMap[g.id] || 1,
      }));
    } catch (err) {
      console.error("chatService.getGroups unexpected error:", err);
      return [];
    }
  },

  /**
   * Create a new chat group with initial members.
   * Uses RPC `create_chat_group` with fallback to direct table inserts.
   * @param {Object} params
   * @param {string} params.organizationId
   * @param {string} params.name
   * @param {string} [params.description]
   * @param {string|null} [params.groupImage]
   * @param {Array<string>} [params.memberUserIds]
   * @returns {Promise<Object>} Created group object
   */
  async createGroup({ organizationId, name, description = "", groupImage = null, memberUserIds = [] }) {
    if (!organizationId || !name?.trim()) {
      throw new Error("Organization ID and group name are required");
    }

    const trimmedName = name.trim();
    const trimmedDesc = (description || "").trim();

    // 1. Try atomic database RPC first
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc("create_chat_group", {
        p_organization_id: organizationId,
        p_name: trimmedName,
        p_description: trimmedDesc,
        p_group_image: groupImage,
        p_member_user_ids: memberUserIds,
      });

      if (!rpcError && rpcData) {
        return {
          ...rpcData,
          isGroup: true,
          currentUserRole: "admin",
          memberCount: (memberUserIds?.length || 0) + 1,
        };
      }
      if (rpcError) {
        console.warn("create_chat_group RPC returned error, attempting direct insert:", rpcError);
      }
    } catch (rpcErr) {
      console.warn("create_chat_group RPC invocation failed, fallback to direct insert:", rpcErr);
    }

    // 2. Direct table insert fallback
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.id) {
      throw new Error("You must be authenticated to create a group");
    }

    // Insert group
    const { data: newGroup, error: groupInsertErr } = await supabase
      .from("chat_groups")
      .insert({
        organization_id: organizationId,
        name: trimmedName,
        description: trimmedDesc,
        group_image: groupImage,
        created_by: user.id,
        last_message_text: `Group "${trimmedName}" created`,
        last_message_at: new Date().toISOString(),
        last_sender_id: user.id,
        is_active: true,
      })
      .select()
      .single();

    if (groupInsertErr) {
      console.error("Failed to insert chat_group:", groupInsertErr);
      throw groupInsertErr;
    }

    // Add creator as admin
    const membersToInsert = [
      {
        group_id: newGroup.id,
        user_id: user.id,
        role: "admin",
        added_by: user.id,
        is_active: true,
      },
    ];

    // Add selected members as member
    (memberUserIds || []).forEach((uid) => {
      if (uid !== user.id) {
        membersToInsert.push({
          group_id: newGroup.id,
          user_id: uid,
          role: "member",
          added_by: user.id,
          is_active: true,
        });
      }
    });

    const { error: membersErr } = await supabase
      .from("chat_group_members")
      .insert(membersToInsert);

    if (membersErr) {
      console.warn("Error inserting group members directly:", membersErr);
    }

    // Insert initial system message
    try {
      await supabase.from("chat_messages").insert({
        group_id: newGroup.id,
        sender_id: user.id,
        message: `Group "${trimmedName}" was created.`,
        created_at: new Date().toISOString(),
      });
    } catch (msgErr) {
      console.warn("Could not insert initial group message:", msgErr);
    }

    return {
      ...newGroup,
      isGroup: true,
      currentUserRole: "admin",
      memberCount: membersToInsert.length,
    };
  },

  /**
   * Fetch members of a group with user profile info.
   * @param {string} groupId
   * @returns {Promise<Array>} List of member objects
   */
  async getGroupMembers(groupId) {
    if (!groupId) return [];

    try {
      const { data: memberRows, error: memberErr } = await supabase
        .from("chat_group_members")
        .select("*")
        .eq("group_id", groupId)
        .eq("is_active", true)
        .order("role", { ascending: true }) // 'admin' comes before 'member'
        .order("joined_at", { ascending: true });

      if (memberErr) {
        console.error("chatService.getGroupMembers error:", memberErr);
        return [];
      }

      const list = memberRows || [];
      if (list.length === 0) return [];

      const userIds = list.map((m) => m.user_id).filter(Boolean);

      // Attempt to fetch profile info for these users
      let profileMap = new Map();
      if (userIds.length > 0) {
        try {
          const { data: profs } = await supabase
            .from("profiles")
            .select("id, full_name, email, avatar_url")
            .in("id", userIds);

          if (profs && profs.length > 0) {
            profileMap = new Map(profs.map((p) => [p.id, p]));
          }
        } catch (_) {
          // Ignore profile query error
        }
      }

      return list.map((m) => {
        const prof = profileMap.get(m.user_id);
        return {
          id: m.id,
          group_id: m.group_id,
          user_id: m.user_id,
          role: m.role,
          joined_at: m.joined_at,
          added_by: m.added_by,
          is_active: m.is_active,
          full_name: prof?.full_name || "",
          email: prof?.email || "",
          avatar_url: prof?.avatar_url || null,
        };
      });
    } catch (err) {
      console.error("chatService.getGroupMembers unexpected error:", err);
      return [];
    }
  },

  /**
   * Fetch paginated messages for a group chat.
   * @param {Object} params
   * @param {string} params.groupId
   * @param {number} [params.limit=30]
   * @param {string|null} [params.beforeTimestamp=null]
   * @returns {Promise<{ messages: Array, hasMore: boolean }>}
   */
  async getGroupMessages({ groupId, limit = 30, beforeTimestamp = null }) {
    if (!groupId) return { messages: [], hasMore: false };

    try {
      let query = supabase
        .from("chat_messages")
        .select(`
          *,
          sender:sender_id (
            id,
            full_name,
            email,
            avatar_url
          )
        `)
        .eq("group_id", groupId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (beforeTimestamp) {
        query = query.lt("created_at", beforeTimestamp);
      }

      let { data, error } = await query;

      // Fallback if sender foreign table join fails
      if (error && error.message && error.message.includes("sender")) {
        let plainQuery = supabase
          .from("chat_messages")
          .select("*")
          .eq("group_id", groupId)
          .order("created_at", { ascending: false })
          .limit(limit);

        if (beforeTimestamp) {
          plainQuery = plainQuery.lt("created_at", beforeTimestamp);
        }

        const res = await plainQuery;
        data = res.data;
        error = res.error;
      }

      if (error) {
        console.error("chatService.getGroupMessages error:", error);
        return { messages: [], hasMore: false };
      }

      const raw = data || [];
      const hasMore = raw.length === limit;
      const messages = [...raw].reverse();

      return { messages, hasMore };
    } catch (err) {
      console.error("chatService.getGroupMessages unexpected error:", err);
      return { messages: [], hasMore: false };
    }
  },

  /**
   * Send a message to a group.
   * @param {Object} params
   * @param {string} params.groupId
   * @param {string} params.senderId
   * @param {string} params.message
   * @returns {Promise<Object>} Created message
   */
  async sendGroupMessage({ groupId, senderId, message }) {
    if (!groupId || !senderId || !message?.trim()) {
      throw new Error("Missing required fields to send group message");
    }

    const trimmedMsg = message.trim();
    const now = new Date().toISOString();

    const { data: newMsg, error } = await supabase
      .from("chat_messages")
      .insert({
        group_id: groupId,
        sender_id: senderId,
        message: trimmedMsg,
        created_at: now,
      })
      .select()
      .single();

    if (error) {
      console.error("chatService.sendGroupMessage error:", error);
      throw error;
    }

    // Direct update to chat_groups in case trigger is delayed
    try {
      await supabase
        .from("chat_groups")
        .update({
          last_message_text: trimmedMsg.substring(0, 200),
          last_message_at: now,
          last_sender_id: senderId,
          updated_at: now,
        })
        .eq("id", groupId);
    } catch (e) {
      console.warn("Could not update chat_groups last_message directly:", e);
    }

    return newMsg;
  },

  /**
   * Edit a group message sent by the current user.
   * @param {Object} params
   * @param {string} params.messageId
   * @param {string} params.newMessage
   * @param {string} params.senderId
   * @param {string} [params.groupId]
   * @returns {Promise<Object>} Updated message
   */
  async editGroupMessage({ messageId, newMessage, senderId, groupId }) {
    if (!messageId || !newMessage?.trim() || !senderId) {
      throw new Error("Missing required fields to edit group message");
    }

    const trimmedMsg = newMessage.trim();
    const now = new Date().toISOString();

    let updatePayload = {
      message: trimmedMsg,
      updated_at: now,
      is_edited: true,
    };

    let { data: updatedMsg, error } = await supabase
      .from("chat_messages")
      .update(updatePayload)
      .eq("id", messageId)
      .eq("sender_id", senderId)
      .select()
      .maybeSingle();

    if (error && error.message && error.message.includes("is_edited")) {
      delete updatePayload.is_edited;
      const res = await supabase
        .from("chat_messages")
        .update(updatePayload)
        .eq("id", messageId)
        .eq("sender_id", senderId)
        .select()
        .maybeSingle();
      updatedMsg = res.data;
      error = res.error;
    }

    if (error) {
      console.error("chatService.editGroupMessage error:", error);
      throw error;
    }

    if (groupId) {
      try {
        const { data: latestMsg } = await supabase
          .from("chat_messages")
          .select("id")
          .eq("group_id", groupId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (latestMsg && latestMsg.id === messageId) {
          await supabase
            .from("chat_groups")
            .update({
              last_message_text: trimmedMsg.substring(0, 200),
              updated_at: now,
            })
            .eq("id", groupId);
        }
      } catch (grpErr) {
        console.warn("Could not update chat_groups last_message preview:", grpErr);
      }
    }

    return updatedMsg;
  },

  /**
   * Mark all unread group messages as read for the current user.
   * @param {Object} params
   * @param {string} params.groupId
   * @param {string} params.userId
   * @returns {Promise<number>}
   */
  async markGroupMessagesAsRead({ groupId, userId }) {
    if (!groupId || !userId) return 0;

    try {
      // 1. Try atomic database RPC
      const { data: rpcCount, error: rpcErr } = await supabase.rpc(
        "mark_chat_group_messages_as_read",
        { p_group_id: groupId }
      );

      if (!rpcErr && typeof rpcCount === "number") {
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("group-messages-read", { detail: { groupId } }));
        }
        return rpcCount;
      }
    } catch (e) {
      // Fallback
    }

    // 2. Direct insert fallback into chat_group_message_reads
    try {
      const { data: unreadMsgs, error: findErr } = await supabase
        .from("chat_messages")
        .select("id")
        .eq("group_id", groupId)
        .neq("sender_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (findErr || !unreadMsgs || unreadMsgs.length === 0) return 0;

      const readsToInsert = unreadMsgs.map((m) => ({
        group_id: groupId,
        message_id: m.id,
        user_id: userId,
        read_at: new Date().toISOString(),
      }));

      const { data: inserted, error: insErr } = await supabase
        .from("chat_group_message_reads")
        .upsert(readsToInsert, { onConflict: "message_id,user_id", ignoreDuplicates: true })
        .select("id");

      if (insErr) {
        console.warn("chatService.markGroupMessagesAsRead fallback upsert error:", insErr);
        return 0;
      }

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("group-messages-read", { detail: { groupId } }));
      }

      return inserted ? inserted.length : 0;
    } catch (err) {
      console.warn("chatService.markGroupMessagesAsRead error:", err);
      return 0;
    }
  },

  /**
   * Fetch unread message counts across all groups for a user.
   * @param {Object} params
   * @param {string} params.userId
   * @param {Array<string>} params.groupIds
   * @returns {Promise<Object>} Map of groupId -> unreadCount
   */
  async getGroupUnreadCounts({ userId, groupIds = [] }) {
    if (!userId || !groupIds.length) return {};

    try {
      // Fetch reads recorded for this user
      const { data: reads } = await supabase
        .from("chat_group_message_reads")
        .select("message_id, group_id")
        .eq("user_id", userId)
        .in("group_id", groupIds);

      const readSet = new Set((reads || []).map((r) => r.message_id));

      // Fetch recent messages across these groups
      const { data: msgs } = await supabase
        .from("chat_messages")
        .select("id, group_id, sender_id")
        .in("group_id", groupIds)
        .neq("sender_id", userId)
        .order("created_at", { ascending: false })
        .limit(300);

      const counts = {};
      (msgs || []).forEach((m) => {
        if (!readSet.has(m.id)) {
          counts[m.group_id] = (counts[m.group_id] || 0) + 1;
        }
      });

      return counts;
    } catch (err) {
      console.warn("chatService.getGroupUnreadCounts error:", err);
      return {};
    }
  },

  /**
   * Add members to an existing group.
   * @param {Object} params
   * @param {string} params.groupId
   * @param {Array<string>} params.userIds
   * @returns {Promise<Object>}
   */
  async addGroupMembers({ groupId, userIds }) {
    if (!groupId || !userIds?.length) {
      throw new Error("Group ID and member user IDs are required");
    }

    try {
      // Try RPC first
      const { data, error } = await supabase.rpc("add_chat_group_members", {
        p_group_id: groupId,
        p_user_ids: userIds,
      });

      if (!error && data) return data;
      if (error) console.warn("add_chat_group_members RPC error:", error);
    } catch (e) {
      console.warn("add_chat_group_members RPC invocation failed, fallback to direct insert:", e);
    }

    // Direct table fallback
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const rows = userIds.map((uid) => ({
      group_id: groupId,
      user_id: uid,
      role: "member",
      added_by: user?.id || null,
      is_active: true,
      joined_at: new Date().toISOString(),
    }));

    const { data: inserted, error } = await supabase
      .from("chat_group_members")
      .upsert(rows, { onConflict: "group_id,user_id" })
      .select();

    if (error) {
      console.error("Failed to add group members directly:", error);
      throw error;
    }

    return { success: true, members: inserted };
  },

  /**
   * Remove a member from a group (or leave group).
   * @param {Object} params
   * @param {string} params.groupId
   * @param {string} params.targetUserId
   * @returns {Promise<Object>}
   */
  async removeGroupMember({ groupId, targetUserId }) {
    if (!groupId || !targetUserId) {
      throw new Error("Group ID and target user ID are required");
    }

    try {
      const { data, error } = await supabase.rpc("remove_chat_group_member", {
        p_group_id: groupId,
        p_target_user_id: targetUserId,
      });

      if (!error && data) return data;
      if (error) {
        // If error contains last-admin message, throw friendly error
        throw new Error(error.message || "Failed to remove group member");
      }
    } catch (e) {
      if (e.message && e.message.includes("last active administrator")) {
        throw e;
      }
      console.warn("remove_chat_group_member RPC error, fallback to table update:", e);
    }

    // Direct update fallback
    const { data, error } = await supabase
      .from("chat_group_members")
      .update({
        is_active: false,
        left_at: new Date().toISOString(),
      })
      .eq("group_id", groupId)
      .eq("user_id", targetUserId)
      .eq("is_active", true)
      .select();

    if (error) {
      console.error("Failed to deactivate group member directly:", error);
      throw error;
    }

    return { success: true, data };
  },

  /**
   * Promote or demote a member's role in a group ('admin' or 'member').
   * @param {Object} params
   * @param {string} params.groupId
   * @param {string} params.targetUserId
   * @param {string} params.newRole ('admin' | 'member')
   * @returns {Promise<Object>}
   */
  async updateMemberRole({ groupId, targetUserId, newRole }) {
    if (!groupId || !targetUserId || !newRole) {
      throw new Error("Group ID, target user ID, and role are required");
    }

    try {
      const { data, error } = await supabase.rpc("update_chat_group_member_role", {
        p_group_id: groupId,
        p_target_user_id: targetUserId,
        p_new_role: newRole,
      });

      if (!error && data) return data;
      if (error) {
        throw new Error(error.message || "Failed to update member role");
      }
    } catch (e) {
      if (e.message && e.message.includes("last remaining")) {
        throw e;
      }
      console.warn("update_chat_group_member_role RPC failed, fallback to direct update:", e);
    }

    const { data, error } = await supabase
      .from("chat_group_members")
      .update({ role: newRole })
      .eq("group_id", groupId)
      .eq("user_id", targetUserId)
      .eq("is_active", true)
      .select();

    if (error) {
      console.error("Failed to update group member role directly:", error);
      throw error;
    }

    return { success: true, role: newRole, data };
  },

  /**
   * Update group name, description, or avatar.
   * @param {Object} params
   * @param {string} params.groupId
   * @param {string} params.name
   * @param {string} [params.description]
   * @param {string|null} [params.groupImage]
   * @returns {Promise<Object>}
   */
  async updateGroupInfo({ groupId, name, description, groupImage }) {
    if (!groupId) throw new Error("Group ID is required");

    const payload = {
      updated_at: new Date().toISOString(),
    };
    if (name !== undefined) payload.name = name.trim();
    if (description !== undefined) payload.description = (description || "").trim();
    if (groupImage !== undefined) payload.group_image = groupImage;

    const { data, error } = await supabase
      .from("chat_groups")
      .update(payload)
      .eq("id", groupId)
      .select()
      .single();

    if (error) {
      console.error("Failed to update group info:", error);
      throw error;
    }

    return data;
  },

  /**
   * Delete a chat group (Admin only).
   * Soft-deletes the group and deactivates memberships, with fallback to hard delete.
   * @param {string} groupId
   * @returns {Promise<Object>}
   */
  async deleteGroup(groupId) {
    if (!groupId) throw new Error("Group ID is required");

    // 1. Try atomic database RPC first (SECURITY DEFINER runs with elevated privileges)
    try {
      const { data, error } = await supabase.rpc("delete_chat_group", {
        p_group_id: groupId,
      });

      if (!error) return { success: true, data };
      if (error) {
        console.warn("delete_chat_group RPC returned error, attempting direct update:", error);
      }
    } catch (e) {
      console.warn("delete_chat_group RPC invocation failed, fallback to direct query:", e);
    }

    // 2. Direct soft-delete update WITHOUT .select()
    // NOTE: Do NOT chain .select() here! Chaining .select() requests PostgREST to return
    // the representation of the updated row. Since chat_groups SELECT RLS requires `is_active = true`,
    // returning a row with `is_active = false` causes PostgREST to reject the update with
    // "new row violates row-level security policy for table chat_groups".
    try {
      const { error: updateErr } = await supabase
        .from("chat_groups")
        .update({
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", groupId);

      if (!updateErr) {
        // Also deactivate members
        try {
          await supabase
            .from("chat_group_members")
            .update({
              is_active: false,
              left_at: new Date().toISOString(),
            })
            .eq("group_id", groupId)
            .eq("is_active", true);
        } catch (_) {}

        return { success: true };
      }
      console.warn("Soft delete failed, trying hard delete:", updateErr);
    } catch (e) {
      console.warn("Direct soft delete failed:", e);
    }

    // 3. Direct hard-delete fallback WITHOUT .select()
    const { error: delErr } = await supabase
      .from("chat_groups")
      .delete()
      .eq("id", groupId);

    if (delErr) {
      console.error("Failed to delete group:", delErr);
      throw delErr;
    }

    return { success: true };
  },

  /**
   * Subscribe to real-time messages for a specific group.
   * @param {string} groupId
   * @param {Function} onNewMessage
   * @param {Function} [onMessageUpdate]
   * @returns {Object} Supabase channel subscription
   */
  subscribeToGroup(groupId, onNewMessage, onMessageUpdate) {
    if (!groupId) return null;

    const channelName = `group_chat_${groupId}_${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `group_id=eq.${groupId}`,
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
          filter: `group_id=eq.${groupId}`,
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
   * Realtime subscription for group updates and messages across all user's groups.
   * @param {string} userId
   * @param {Function} onGroupEvent
   * @returns {Object} Channel subscription
   */
  subscribeToUserGroupUpdates(userId, onGroupEvent) {
    if (!userId) return null;

    const channelName = `user_group_events_${userId}_${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chat_groups",
        },
        (payload) => {
          if (onGroupEvent) {
            onGroupEvent({ type: "GROUP_UPDATED", data: payload.new || payload.old });
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chat_group_members",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (onGroupEvent) {
            onGroupEvent({ type: "MEMBERSHIP_CHANGED", data: payload.new || payload.old });
          }
        }
      )
      .subscribe();

    return channel;
  },

  /**
   * Helper to upload or compress group avatar image.
   * Uses Supabase storage if available, otherwise returns optimized data URL.
   * @param {File} file
   * @returns {Promise<string>} Image URL or data URL
   */
  async uploadGroupImage(file) {
    if (!file) return null;

    try {
      // 1. Try uploading to Supabase Storage bucket 'chat-attachments' or 'avatars'
      const fileExt = file.name ? file.name.split(".").pop() : "jpg";
      const fileName = `group_${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
      const filePath = `group_avatars/${fileName}`;

      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from("chat-attachments")
        .upload(filePath, file, { cacheControl: "3600", upsert: true });

      if (!uploadErr && uploadData) {
        const { data: publicUrlData } = supabase.storage
          .from("chat-attachments")
          .getPublicUrl(filePath);
        if (publicUrlData?.publicUrl) {
          return publicUrlData.publicUrl;
        }
      }
    } catch (e) {
      console.warn("Storage upload not available, falling back to base64 data URL:", e);
    }

    // 2. Base64 fallback (compressed in canvas if image)
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const MAX_SIZE = 256;
          let width = img.width;
          let height = img.height;
          if (width > height) {
            if (width > MAX_SIZE) {
              height *= MAX_SIZE / width;
              width = MAX_SIZE;
            }
          } else {
            if (height > MAX_SIZE) {
              width *= MAX_SIZE / height;
              height = MAX_SIZE;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", 0.85));
        };
        img.onerror = () => resolve(e.target.result);
        img.src = e.target.result;
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
  },
};

export default chatService;
