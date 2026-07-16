import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { io } from 'socket.io-client';

import { useAuth } from '../context/AuthContext';
import api, { SOCKET_URL } from '../services/api';

const getErrorMessage = (error, fallback) =>
  error.response?.data?.message || error.message || fallback;

const getId = (value) => {
  if (!value) {
    return '';
  }

  return typeof value === 'string' ? value : value._id;
};

const formatTime = (dateValue) => {
  if (!dateValue) {
    return '';
  }

  return new Date(dateValue).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit'
  });
};

export default function ChatScreen() {
  const { user, token } = useAuth();
  const socketRef = useRef(null);
  const selectedUserIdRef = useRef(null);
  const [conversations, setConversations] = useState([]);
  const [friends, setFriends] = useState([]);
  const [friendSearch, setFriendSearch] = useState('');
  const [isChoosingFriend, setIsChoosingFriend] = useState(false);
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');

  const selectedUserId = selectedUser?._id;

  useEffect(() => {
    selectedUserIdRef.current = selectedUserId;
  }, [selectedUserId]);

  const fetchConversations = useCallback(async ({ refreshing = false } = {}) => {
    try {
      setError('');
      if (refreshing) {
        setIsRefreshing(true);
      } else {
        setIsLoadingConversations(true);
      }

      const { data } = await api.get('/messages/conversations');
      setConversations(data.conversations || []);
    } catch (conversationError) {
      setError(getErrorMessage(conversationError, 'Could not load conversations.'));
    } finally {
      setIsLoadingConversations(false);
      setIsRefreshing(false);
    }
  }, []);

  const fetchFriends = useCallback(async () => {
    try {
      const { data } = await api.get('/friends');
      setFriends(data.friends || []);
    } catch (friendsError) {
      setError(getErrorMessage(friendsError, 'Could not load friends.'));
    }
  }, []);

  const fetchConversation = useCallback(async (userId) => {
    if (!userId) {
      setMessages([]);
      return;
    }

    try {
      setError('');
      setIsLoadingMessages(true);
      const { data } = await api.get(`/messages/conversation/${userId}`);
      setMessages(data.messages || []);
    } catch (conversationError) {
      setError(getErrorMessage(conversationError, 'Could not load messages.'));
    } finally {
      setIsLoadingMessages(false);
    }
  }, []);

  useEffect(() => {
    fetchConversations();
    fetchFriends();
  }, [fetchConversations, fetchFriends]);

  useEffect(() => {
    if (!token) {
      return undefined;
    }

    const socket = io(SOCKET_URL, {
      auth: { token }
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsSocketConnected(true);
      fetchConversations();
      if (selectedUserIdRef.current) fetchConversation(selectedUserIdRef.current);
    });

    socket.on('disconnect', () => setIsSocketConnected(false));

    socket.on('connect_error', (socketError) => {
      setError(socketError.message || 'Socket connection failed.');
    });

    socket.on('receiveMessage', (message) => {
      if (message.error) {
        setError(message.error);
        return;
      }

      const senderId = getId(message.sender);
      const receiverId = getId(message.receiver);
      const currentUserId = user?._id;
      const activeConversationId = selectedUserIdRef.current;

      if (
        activeConversationId &&
        (senderId === activeConversationId || receiverId === activeConversationId)
      ) {
        setMessages((current) => {
          if (current.some((item) => item._id === message._id)) {
            return current;
          }

          return [...current, message];
        });
      }

      if (senderId === currentUserId || receiverId === currentUserId) {
        fetchConversations();
      }
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [fetchConversation, fetchConversations, token, user?._id]);

  const sortedMessages = useMemo(
    () =>
      [...messages].sort(
        (first, second) => new Date(first.createdAt) - new Date(second.createdAt)
      ),
    [messages]
  );

  const selectConversation = (conversation) => {
    setSelectedUser(conversation.user);
    setIsChoosingFriend(false);
    fetchConversation(conversation.user._id);
  };

  const selectFriend = (friend) => {
    setSelectedUser(friend);
    setIsChoosingFriend(false);
    fetchConversation(friend._id);
  };

  const sendMessage = async () => {
    const text = messageText.trim();

    if (!selectedUserId) {
      setError('Select a conversation first.');
      return;
    }

    if (!text) {
      setError('Message text is required.');
      return;
    }

    if (text.length > 2000) {
      setError('Messages cannot exceed 2000 characters.');
      return;
    }

    try {
      setError('');
      setIsSending(true);
      const socket = socketRef.current;
      if (!socket?.connected) throw new Error('Chat is reconnecting. Please try again.');

      const result = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Message delivery timed out.')), 10000);
        socket.emit('sendMessage', { receiver: selectedUserId, text }, (acknowledgement) => {
          clearTimeout(timeout);
          if (!acknowledgement?.ok) {
            reject(new Error(acknowledgement?.error || 'Could not send message.'));
            return;
          }
          resolve(acknowledgement.message);
        });
      });
      setMessages((current) => current.some((item) => item._id === result._id)
        ? current
        : [...current, result]);
      setMessageText('');
      await fetchConversations();
    } catch (sendError) {
      setError(getErrorMessage(sendError, 'Could not send message.'));
    } finally {
      setIsSending(false);
    }
  };

  const filteredFriends = friends.filter((friend) =>
    friend.username?.toLowerCase().includes(friendSearch.trim().toLowerCase())
  );

  const renderConversation = (conversation) => {
    const isActive = selectedUserId === conversation.user._id;

    return (
      <TouchableOpacity
        key={conversation.user._id}
        style={[styles.conversationCard, isActive && styles.conversationCardActive]}
        onPress={() => selectConversation(conversation)}
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {conversation.user.username?.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.conversationTextWrap}>
          <Text style={styles.conversationName}>{conversation.user.username}</Text>
          <Text style={styles.conversationPreview} numberOfLines={1}>
            {conversation.lastMessage?.text || 'No messages yet'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderMessage = (message) => {
    const isMine = getId(message.sender) === user?._id;

    return (
      <View
        key={message._id}
        style={[
          styles.messageBubble,
          isMine ? styles.myMessageBubble : styles.theirMessageBubble
        ]}
      >
        <Text style={[styles.messageText, isMine && styles.myMessageText]}>
          {message.text}
        </Text>
        <Text style={[styles.messageTime, isMine && styles.myMessageTime]}>
          {formatTime(message.createdAt)}
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => fetchConversations({ refreshing: true })}
            tintColor="#2f8f68"
          />
        }
      >
        <View style={styles.header}>
          <Text style={styles.kicker}>Realtime messages</Text>
          <Text style={styles.title}>Chat</Text>
          <Text style={styles.subtitle}>
            Talk with other pet owners and keep adoption, meetup, and care plans moving.
          </Text>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.section}>
          <View style={styles.sectionHeadingRow}>
            <Text style={styles.sectionTitle}>Conversations</Text>
            <TouchableOpacity style={styles.sendButton} onPress={() => setIsChoosingFriend((value) => !value)}>
              <Text style={styles.sendButtonText}>New Conversation</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.connectionText}>
            {isSocketConnected ? 'Realtime connected' : 'Realtime reconnecting...'}
          </Text>
          {isChoosingFriend ? (
            <View style={styles.emptyCard}>
              <TextInput
                value={friendSearch}
                onChangeText={setFriendSearch}
                placeholder="Search accepted friends"
                placeholderTextColor="#8a9b91"
                style={styles.messageInput}
              />
              <View style={styles.conversationList}>
                {filteredFriends.length ? filteredFriends.map((friend) => (
                  <TouchableOpacity key={friend._id} style={styles.conversationCard} onPress={() => selectFriend(friend)}>
                    <Text style={styles.conversationName}>{friend.username}</Text>
                  </TouchableOpacity>
                )) : <Text style={styles.emptyText}>No accepted friends found.</Text>}
              </View>
            </View>
          ) : null}
          {isLoadingConversations ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color="#2f8f68" />
              <Text style={styles.loadingText}>Loading conversations...</Text>
            </View>
          ) : conversations.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No conversations yet</Text>
              <Text style={styles.emptyText}>
                Send a message through a user profile later, or use seeded users to test chat.
              </Text>
            </View>
          ) : (
            <View style={styles.conversationList}>
              {conversations.map(renderConversation)}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {selectedUser ? `Chat with ${selectedUser.username}` : 'Messages'}
          </Text>

          {!selectedUser ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>Select a conversation</Text>
              <Text style={styles.emptyText}>
                Choose someone above to view your message history.
              </Text>
            </View>
          ) : isLoadingMessages ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color="#2f8f68" />
              <Text style={styles.loadingText}>Loading messages...</Text>
            </View>
          ) : sortedMessages.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No messages here yet</Text>
              <Text style={styles.emptyText}>Start the conversation below.</Text>
            </View>
          ) : (
            <View style={styles.messageList}>{sortedMessages.map(renderMessage)}</View>
          )}
        </View>
      </ScrollView>

      <View style={styles.inputBar}>
        <TextInput
          value={messageText}
          onChangeText={setMessageText}
          placeholder={selectedUser ? 'Type a message' : 'Select a conversation first'}
          placeholderTextColor="#8a9b91"
          style={styles.messageInput}
          editable={Boolean(selectedUser) && !isSending}
        />
        <TouchableOpacity
          style={[
            styles.sendButton,
            (!selectedUser || isSending) && styles.sendButtonDisabled
          ]}
          onPress={sendMessage}
          disabled={!selectedUser || isSending}
        >
          <Text style={styles.sendButtonText}>{isSending ? '...' : 'Send'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7fbf6'
  },
  content: {
    flex: 1
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 100
  },
  header: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 20,
    borderWidth: 1,
    borderColor: '#dcebe1',
    marginBottom: 16
  },
  kicker: {
    color: '#2f8f68',
    fontWeight: '800',
    marginBottom: 6
  },
  title: {
    color: '#173b2c',
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 8
  },
  subtitle: {
    color: '#5f7569',
    lineHeight: 22
  },
  error: {
    color: '#b3261e',
    lineHeight: 20,
    marginBottom: 12
  },
  section: {
    marginBottom: 16
  },
  sectionTitle: {
    color: '#173b2c',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 10
  },
  sectionHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12
  },
  connectionText: {
    color: '#5f7569',
    fontSize: 12,
    marginBottom: 10
  },
  loadingBox: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dcebe1',
    paddingVertical: 28
  },
  loadingText: {
    color: '#5f7569',
    marginTop: 10
  },
  emptyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dcebe1',
    padding: 18
  },
  emptyTitle: {
    color: '#173b2c',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 6
  },
  emptyText: {
    color: '#5f7569',
    lineHeight: 22
  },
  conversationList: {
    gap: 10
  },
  conversationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dcebe1',
    padding: 14
  },
  conversationCardActive: {
    borderColor: '#2f8f68',
    backgroundColor: '#eef8f0'
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#2f8f68',
    alignItems: 'center',
    justifyContent: 'center'
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800'
  },
  conversationTextWrap: {
    flex: 1
  },
  conversationName: {
    color: '#173b2c',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4
  },
  conversationPreview: {
    color: '#5f7569'
  },
  messageList: {
    gap: 10
  },
  messageBubble: {
    maxWidth: '84%',
    borderRadius: 8,
    padding: 12
  },
  myMessageBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#2f8f68'
  },
  theirMessageBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dcebe1'
  },
  messageText: {
    color: '#173b2c',
    lineHeight: 20
  },
  myMessageText: {
    color: '#ffffff'
  },
  messageTime: {
    color: '#5f7569',
    fontSize: 12,
    marginTop: 6,
    alignSelf: 'flex-end'
  },
  myMessageTime: {
    color: '#ddf4e7'
  },
  inputBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: 10,
    padding: 14,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#dcebe1'
  },
  messageInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d7e5dc',
    borderRadius: 8,
    color: '#173b2c',
    backgroundColor: '#fbfdfb',
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 11
  },
  sendButton: {
    backgroundColor: '#2f8f68',
    borderRadius: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'center'
  },
  sendButtonDisabled: {
    opacity: 0.6
  },
  sendButtonText: {
    color: '#ffffff',
    fontWeight: '800'
  }
});
