import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

import { useAuth } from '../context/AuthContext';
import api from '../services/api';

export default function ProfileScreen({ navigation }) {
  const { user, logout } = useAuth();
  const [friends, setFriends] = useState([]);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [outgoingRequests, setOutgoingRequests] = useState([]);
  const [userResults, setUserResults] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoadingFriends, setIsLoadingFriends] = useState(false);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [processingUserId, setProcessingUserId] = useState('');
  const [friendsError, setFriendsError] = useState('');
  const [friendsMessage, setFriendsMessage] = useState('');

  const getErrorMessage = (error, fallback) =>
    error?.response?.data?.message || fallback;

  const loadFriends = useCallback(async () => {
    try {
      setIsLoadingFriends(true);
      setFriendsError('');
      const { data } = await api.get('/friends');
      setFriends(data.friends || []);
      setIncomingRequests(data.friendRequestsReceived || []);
      setOutgoingRequests(data.friendRequestsSent || []);
    } catch (error) {
      setFriendsError(getErrorMessage(error, 'Could not load friends.'));
    } finally {
      setIsLoadingFriends(false);
    }
  }, []);

  const searchUsers = useCallback(async () => {
    try {
      setIsSearchingUsers(true);
      setFriendsError('');
      setFriendsMessage('');
      const { data } = await api.get('/friends/users', {
        params: searchQuery.trim() ? { q: searchQuery.trim() } : {}
      });
      setUserResults(data.users || []);
    } catch (error) {
      setFriendsError(getErrorMessage(error, 'Could not search users.'));
    } finally {
      setIsSearchingUsers(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    loadFriends();
    searchUsers();
  }, [loadFriends, searchUsers]);

  const refreshFriendData = async () => {
    await loadFriends();
    await searchUsers();
  };

  const sendRequest = async (userId) => {
    try {
      setProcessingUserId(userId);
      setFriendsError('');
      setFriendsMessage('');
      const { data } = await api.post(`/friends/request/${userId}`);
      setFriendsMessage(data.message || 'Friend request sent.');
      await refreshFriendData();
    } catch (error) {
      setFriendsError(getErrorMessage(error, 'Could not send friend request.'));
    } finally {
      setProcessingUserId('');
    }
  };

  const acceptRequest = async (userId) => {
    try {
      setProcessingUserId(userId);
      setFriendsError('');
      setFriendsMessage('');
      const { data } = await api.post(`/friends/accept/${userId}`);
      setFriendsMessage(data.message || 'Friend request accepted.');
      await refreshFriendData();
    } catch (error) {
      setFriendsError(getErrorMessage(error, 'Could not accept friend request.'));
    } finally {
      setProcessingUserId('');
    }
  };

  const rejectRequest = async (userId) => {
    try {
      setProcessingUserId(userId);
      setFriendsError('');
      setFriendsMessage('');
      const { data } = await api.post(`/friends/reject/${userId}`);
      setFriendsMessage(data.message || 'Friend request rejected.');
      await refreshFriendData();
    } catch (error) {
      setFriendsError(getErrorMessage(error, 'Could not reject friend request.'));
    } finally {
      setProcessingUserId('');
    }
  };

  const renderUserAction = (result) => {
    const resultId = result._id || result.id;

    if (result.friendshipStatus === 'friends') {
      return <Text style={styles.statusText}>Friends</Text>;
    }

    if (result.friendshipStatus === 'requestSent') {
      return <Text style={styles.statusText}>Request sent</Text>;
    }

    if (result.friendshipStatus === 'requestReceived') {
      return (
        <TouchableOpacity
          style={[styles.smallButton, processingUserId === resultId && styles.disabledButton]}
          disabled={processingUserId === resultId}
          onPress={() => acceptRequest(resultId)}
        >
          <Text style={styles.smallButtonText}>Accept</Text>
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity
        style={[styles.smallButton, processingUserId === resultId && styles.disabledButton]}
        disabled={processingUserId === resultId}
        onPress={() => sendRequest(resultId)}
      >
        <Text style={styles.smallButtonText}>Add Friend</Text>
      </TouchableOpacity>
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.kicker}>Account</Text>
      <Text style={styles.title}>Profile</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Username</Text>
        <Text style={styles.value}>{user?.username}</Text>
        <Text style={styles.label}>Email</Text>
        <Text style={styles.value}>{user?.email}</Text>
        <Text style={styles.label}>Role</Text>
        <Text style={styles.value}>{user?.role}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Friends</Text>
        <Text style={styles.helperText}>
          Find other pet owners, send requests, and keep your feed connected.
        </Text>

        {friendsError ? <Text style={styles.errorText}>{friendsError}</Text> : null}
        {friendsMessage ? <Text style={styles.successText}>{friendsMessage}</Text> : null}

        <View style={styles.searchRow}>
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search by username"
            placeholderTextColor="#7d9187"
            autoCapitalize="none"
          />
          <TouchableOpacity style={styles.searchButton} onPress={searchUsers}>
            <Text style={styles.searchButtonText}>Search</Text>
          </TouchableOpacity>
        </View>

        {isSearchingUsers ? <ActivityIndicator color="#2f8f68" /> : null}

        <Text style={styles.subheading}>People</Text>
        {userResults.length === 0 && !isSearchingUsers ? (
          <Text style={styles.emptyText}>No pet owners found yet.</Text>
        ) : (
          userResults.map((result) => (
            <View key={result._id || result.id} style={styles.friendRow}>
              <View style={styles.friendInfo}>
                <Text style={styles.friendName}>{result.username}</Text>
                <Text style={styles.friendMeta}>{result.role}</Text>
              </View>
              {renderUserAction(result)}
            </View>
          ))
        )}

        <Text style={styles.subheading}>Incoming Requests</Text>
        {isLoadingFriends ? <ActivityIndicator color="#2f8f68" /> : null}
        {incomingRequests.length === 0 && !isLoadingFriends ? (
          <Text style={styles.emptyText}>No pending requests.</Text>
        ) : (
          incomingRequests.map((requestUser) => (
            <View key={requestUser._id} style={styles.friendRow}>
              <View style={styles.friendInfo}>
                <Text style={styles.friendName}>{requestUser.username}</Text>
                <Text style={styles.friendMeta}>Wants to connect</Text>
              </View>
              <View style={styles.requestActions}>
                <TouchableOpacity
                  style={[
                    styles.smallButton,
                    processingUserId === requestUser._id && styles.disabledButton
                  ]}
                  disabled={processingUserId === requestUser._id}
                  onPress={() => acceptRequest(requestUser._id)}
                >
                  <Text style={styles.smallButtonText}>Accept</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.rejectButton,
                    processingUserId === requestUser._id && styles.disabledButton
                  ]}
                  disabled={processingUserId === requestUser._id}
                  onPress={() => rejectRequest(requestUser._id)}
                >
                  <Text style={styles.rejectButtonText}>Reject</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}

        <Text style={styles.subheading}>My Friends</Text>
        {friends.length === 0 ? (
          <Text style={styles.emptyText}>Your friend list is ready when you are.</Text>
        ) : (
          friends.map((friend) => (
            <View key={friend._id} style={styles.friendRow}>
              <View style={styles.friendInfo}>
                <Text style={styles.friendName}>{friend.username}</Text>
                <Text style={styles.friendMeta}>{friend.role}</Text>
              </View>
              <Text style={styles.statusText}>Connected</Text>
            </View>
          ))
        )}

        {outgoingRequests.length > 0 ? (
          <>
            <Text style={styles.subheading}>Sent Requests</Text>
            {outgoingRequests.map((requestUser) => (
              <View key={requestUser._id} style={styles.friendRow}>
                <View style={styles.friendInfo}>
                  <Text style={styles.friendName}>{requestUser.username}</Text>
                  <Text style={styles.friendMeta}>Waiting for reply</Text>
                </View>
                <Text style={styles.statusText}>Pending</Text>
              </View>
            ))}
          </>
        ) : null}
      </View>

      <View style={styles.actionCard}>
        <TouchableOpacity
          style={styles.primaryAction}
          onPress={() => navigation.navigate('Statistics')}
        >
          <Text style={styles.primaryActionText}>View My Activity Dashboard</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryAction}
          onPress={() => navigation.navigate('MediaStudio')}
        >
          <Text style={styles.secondaryActionText}>Open Pet Post Creator</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.logoutButton} onPress={logout}>
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7fbf6'
  },
  content: {
    padding: 20,
    paddingBottom: 36
  },
  kicker: {
    color: '#2f8f68',
    fontWeight: '800',
    marginBottom: 4
  },
  title: {
    color: '#173b2c',
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 14
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 18,
    borderWidth: 1,
    borderColor: '#dcebe1',
    marginBottom: 14
  },
  sectionTitle: {
    color: '#173b2c',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 6
  },
  helperText: {
    color: '#557266',
    lineHeight: 20,
    marginBottom: 12
  },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#cfe3d6',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#173b2c',
    backgroundColor: '#f7fbf6'
  },
  searchButton: {
    backgroundColor: '#2f8f68',
    borderRadius: 8,
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'center'
  },
  searchButtonText: {
    color: '#ffffff',
    fontWeight: '800'
  },
  subheading: {
    color: '#2f8f68',
    fontWeight: '800',
    marginTop: 14,
    marginBottom: 8
  },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#edf4ef',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    backgroundColor: '#fbfdfb',
    gap: 10
  },
  friendInfo: {
    flex: 1
  },
  friendName: {
    color: '#173b2c',
    fontWeight: '800'
  },
  friendMeta: {
    color: '#557266',
    marginTop: 2,
    textTransform: 'capitalize'
  },
  requestActions: {
    flexDirection: 'row',
    gap: 8
  },
  smallButton: {
    backgroundColor: '#2f8f68',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center'
  },
  smallButtonText: {
    color: '#ffffff',
    fontWeight: '800'
  },
  rejectButton: {
    borderWidth: 1,
    borderColor: '#b3261e',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center'
  },
  rejectButtonText: {
    color: '#b3261e',
    fontWeight: '800'
  },
  disabledButton: {
    opacity: 0.6
  },
  statusText: {
    color: '#557266',
    fontWeight: '800'
  },
  emptyText: {
    color: '#557266',
    fontStyle: 'italic'
  },
  errorText: {
    color: '#b3261e',
    fontWeight: '700',
    marginBottom: 10
  },
  successText: {
    color: '#2f8f68',
    fontWeight: '700',
    marginBottom: 10
  },
  label: {
    color: '#2f8f68',
    fontWeight: '800',
    marginTop: 10
  },
  value: {
    color: '#173b2c',
    fontSize: 16,
    marginTop: 4
  },
  actionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 18,
    borderWidth: 1,
    borderColor: '#dcebe1',
    gap: 12
  },
  primaryAction: {
    backgroundColor: '#2f8f68',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center'
  },
  primaryActionText: {
    color: '#ffffff',
    fontWeight: '800'
  },
  secondaryAction: {
    borderWidth: 1,
    borderColor: '#2f8f68',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center'
  },
  secondaryActionText: {
    color: '#2f8f68',
    fontWeight: '800'
  },
  logoutButton: {
    borderWidth: 1,
    borderColor: '#b3261e',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center'
  },
  logoutText: {
    color: '#b3261e',
    fontWeight: '800'
  }
});
