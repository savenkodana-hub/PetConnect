import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const CATEGORIES = ['dogs', 'cats', 'adoption', 'training', 'health', 'general'];
const PRIVACY_OPTIONS = [
  { label: 'Any', value: '' },
  { label: 'Public', value: 'false' },
  { label: 'Private', value: 'true' }
];

const initialForm = {
  name: '',
  description: '',
  category: 'general',
  isPrivate: false
};

const initialSearch = {
  name: '',
  category: '',
  isPrivate: ''
};

const initialManagerSearch = {
  username: '',
  status: '',
  minPosts: '',
  maxPosts: '',
  startDate: '',
  endDate: ''
};

const MAX_POST_FILTER = 1000000;

const getErrorMessage = (error, fallback) =>
  error.response?.data?.message || fallback;

const getId = (value) => {
  if (!value) {
    return '';
  }

  return typeof value === 'string' ? value : value._id;
};

const isValidDateInput = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

export default function GroupsScreen() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('all');
  const [groups, setGroups] = useState([]);
  const [myGroups, setMyGroups] = useState([]);
  const [search, setSearch] = useState(initialSearch);
  const [managerSearch, setManagerSearch] = useState(initialManagerSearch);
  const [managerSearchGroupId, setManagerSearchGroupId] = useState('');
  const [managerSearchResults, setManagerSearchResults] = useState([]);
  const [isManagerSearchLoading, setIsManagerSearchLoading] = useState(false);
  const [managerSearchError, setManagerSearchError] = useState('');
  const [hasManagerSearched, setHasManagerSearched] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [editingGroupId, setEditingGroupId] = useState(null);
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [processingRequestId, setProcessingRequestId] = useState('');
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');

  const enrichAdminGroups = useCallback(
    async (groupsToCheck) => {
      if (!user?._id) {
        return groupsToCheck;
      }

      const adminGroups = groupsToCheck.filter((group) => getId(group.admin) === user._id);

      if (!adminGroups.length) {
        return groupsToCheck;
      }

      const detailResponses = await Promise.all(
        adminGroups.map((group) => api.get(`/groups/${group._id}`))
      );
      const detailedGroups = detailResponses.reduce((detailsById, response) => {
        const detailedGroup = response.data.group;

        if (detailedGroup?._id) {
          detailsById[detailedGroup._id] = detailedGroup;
        }

        return detailsById;
      }, {});

      return groupsToCheck.map((group) => detailedGroups[group._id] || group);
    },
    [user?._id]
  );

  const fetchGroups = useCallback(async ({ refreshing = false } = {}) => {
    try {
      setError('');
      if (refreshing) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      const [allResponse, myResponse] = await Promise.all([
        api.get('/groups'),
        api.get('/groups/my')
      ]);

      const [nextGroups, nextMyGroups] = await Promise.all([
        enrichAdminGroups(allResponse.data.groups || []),
        enrichAdminGroups(myResponse.data.groups || [])
      ]);

      setGroups(nextGroups);
      setMyGroups(nextMyGroups);
    } catch (fetchError) {
      setError(getErrorMessage(fetchError, 'Could not load groups.'));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [enrichAdminGroups]);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  const displayedGroups = useMemo(
    () => (activeTab === 'all' ? groups : myGroups),
    [activeTab, groups, myGroups]
  );

  const updateFormField = (name, value) => {
    setFormError('');
    setForm((current) => ({ ...current, [name]: value }));
  };

  const updateSearchField = (name, value) => {
    setSearch((current) => ({ ...current, [name]: value }));
  };

  const resetForm = () => {
    setForm(initialForm);
    setEditingGroupId(null);
    setFormError('');
  };

  const openCreateForm = () => {
    resetForm();
    setIsFormVisible(true);
  };

  const openEditForm = (group) => {
    setForm({
      name: group.name || '',
      description: group.description || '',
      category: group.category || 'general',
      isPrivate: Boolean(group.isPrivate)
    });
    setEditingGroupId(group._id);
    setIsFormVisible(true);
    setFormError('');
  };

  const validateForm = () => {
    if (!form.name.trim()) {
      return 'Group name is required.';
    }

    if (form.name.trim().length > 100) {
      return 'Group name cannot exceed 100 characters.';
    }

    if (form.description.trim().length > 1000) {
      return 'Group description cannot exceed 1000 characters.';
    }

    if (!form.category.trim()) {
      return 'Category is required.';
    }

    return '';
  };

  const buildPayload = () => ({
    name: form.name.trim(),
    description: form.description.trim(),
    category: form.category,
    isPrivate: form.isPrivate
  });

  const handleSubmit = async () => {
    const validationMessage = validateForm();

    if (validationMessage) {
      setFormError(validationMessage);
      return;
    }

    try {
      setIsSubmitting(true);
      setFormError('');

      if (editingGroupId) {
        await api.put(`/groups/${editingGroupId}`, buildPayload());
      } else {
        await api.post('/groups', buildPayload());
      }

      resetForm();
      setIsFormVisible(false);
      await fetchGroups();
    } catch (submitError) {
      setFormError(
        getErrorMessage(
          submitError,
          editingGroupId ? 'Could not update group.' : 'Could not create group.'
        )
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSearch = async () => {
    if (search.name.trim().length > 100) {
      setError('Group search cannot exceed 100 characters.');
      return;
    }

    try {
      setError('');
      setIsLoading(true);

      const params = {};
      if (search.name.trim()) {
        params.name = search.name.trim();
      }
      if (search.category) {
        params.category = search.category;
      }
      if (search.isPrivate !== '') {
        params.isPrivate = search.isPrivate;
      }

      const { data } = await api.get('/groups/search', { params });
      const enrichedGroups = await enrichAdminGroups(data.groups || []);
      setGroups(enrichedGroups);
      setActiveTab('all');
    } catch (searchError) {
      setError(getErrorMessage(searchError, 'Could not search groups.'));
    } finally {
      setIsLoading(false);
    }
  };

  const clearSearch = async () => {
    setSearch(initialSearch);
    await fetchGroups();
  };

  const resetManagerSearch = () => {
    setManagerSearch(initialManagerSearch);
    setManagerSearchResults([]);
    setManagerSearchError('');
    setHasManagerSearched(false);
  };

  const toggleManagerSearch = (groupId) => {
    if (managerSearchGroupId === groupId) {
      setManagerSearchGroupId('');
      resetManagerSearch();
      return;
    }

    setManagerSearchGroupId(groupId);
    resetManagerSearch();
  };

  const updateManagerSearchField = (name, value) => {
    setManagerSearchError('');
    setManagerSearch((current) => ({ ...current, [name]: value }));
  };

  const validateManagerSearch = () => {
    if (managerSearch.username.trim().length > 100) {
      return 'Username cannot exceed 100 characters.';
    }

    for (const [field, label] of [['minPosts', 'Minimum posts'], ['maxPosts', 'Maximum posts']]) {
      const value = managerSearch[field].trim();
      if (value && (!/^\d+$/.test(value) || Number(value) > MAX_POST_FILTER)) {
        return `${label} must be an integer between 0 and ${MAX_POST_FILTER}.`;
      }
    }

    if (
      managerSearch.minPosts &&
      managerSearch.maxPosts &&
      Number(managerSearch.maxPosts) < Number(managerSearch.minPosts)
    ) {
      return 'Maximum posts must be greater than or equal to minimum posts.';
    }

    if (managerSearch.startDate && !isValidDateInput(managerSearch.startDate)) {
      return 'Start date must use YYYY-MM-DD.';
    }

    if (managerSearch.endDate && !isValidDateInput(managerSearch.endDate)) {
      return 'End date must use YYYY-MM-DD.';
    }

    if (
      managerSearch.startDate &&
      managerSearch.endDate &&
      managerSearch.endDate < managerSearch.startDate
    ) {
      return 'End date must be greater than or equal to start date.';
    }

    return '';
  };

  const searchManagedGroupMembers = async (groupId) => {
    const validationMessage = validateManagerSearch();
    if (validationMessage) {
      setManagerSearchError(validationMessage);
      return;
    }

    try {
      setIsManagerSearchLoading(true);
      setManagerSearchError('');
      setHasManagerSearched(true);

      const params = {};
      Object.entries(managerSearch).forEach(([field, value]) => {
        const normalizedValue = value.trim();
        if (normalizedValue) {
          params[field] = normalizedValue;
        }
      });

      const { data } = await api.get(`/groups/${groupId}/members/search`, { params });
      setManagerSearchResults(data.members || []);
    } catch (searchError) {
      setManagerSearchResults([]);
      setManagerSearchError(
        getErrorMessage(searchError, 'Could not search this group’s members.')
      );
    } finally {
      setIsManagerSearchLoading(false);
    }
  };

  const confirmDelete = (group) => {
    Alert.alert(
      'Delete group',
      `Are you sure you want to delete ${group.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteGroup(group._id)
        }
      ]
    );
  };

  const deleteGroup = async (groupId) => {
    try {
      setError('');
      await api.delete(`/groups/${groupId}`);

      if (editingGroupId === groupId) {
        resetForm();
        setIsFormVisible(false);
      }

      await fetchGroups();
    } catch (deleteError) {
      setError(getErrorMessage(deleteError, 'Could not delete group.'));
    }
  };

  const joinGroup = async (groupId) => {
    try {
      setError('');
      await api.post(`/groups/${groupId}/join`);
      await fetchGroups();
    } catch (joinError) {
      setError(getErrorMessage(joinError, 'Could not join group.'));
    }
  };

  const approveRequest = async (groupId, userId) => {
    const requestKey = `${groupId}:${userId}:approve`;

    try {
      setError('');
      setProcessingRequestId(requestKey);
      await api.post(`/groups/${groupId}/approve/${userId}`);
      await fetchGroups();
    } catch (approveError) {
      setError(getErrorMessage(approveError, 'Could not approve join request.'));
    } finally {
      setProcessingRequestId('');
    }
  };

  const rejectRequest = async (groupId, userId) => {
    const requestKey = `${groupId}:${userId}:reject`;

    try {
      setError('');
      setProcessingRequestId(requestKey);
      await api.post(`/groups/${groupId}/reject/${userId}`);
      await fetchGroups();
    } catch (rejectError) {
      setError(getErrorMessage(rejectError, 'Could not reject join request.'));
    } finally {
      setProcessingRequestId('');
    }
  };

  const removeMember = async (groupId, userId) => {
    const requestKey = `${groupId}:${userId}:remove`;
    try {
      setProcessingRequestId(requestKey);
      setError('');
      await api.delete(`/groups/${groupId}/members/${userId}`);
      await fetchGroups();
    } catch (removeError) {
      setError(getErrorMessage(removeError, 'Could not remove member.'));
    } finally {
      setProcessingRequestId('');
    }
  };

  const isAdmin = (group) => getId(group.admin) === user?._id;
  const isMember = (group) =>
    (group.members || []).some((member) => getId(member) === user?._id);
  const isPending = (group) =>
    (group.pendingRequests || []).some((member) => getId(member) === user?._id);

  const getRequestUserName = (requestUser) => {
    if (typeof requestUser === 'object') {
      return requestUser.username || requestUser.email || requestUser._id || 'PetConnect user';
    }

    return requestUser || 'PetConnect user';
  };

  const renderManagerSearch = (group) => (
    <View style={styles.managerSearchPanel}>
      <View style={styles.managerSearchHeader}>
        <View style={styles.managerSearchHeading}>
          <Text style={styles.requestsTitle}>Manager Member Search</Text>
          <Text style={styles.requestMeta}>
            Search accepted and pending users by activity in this group.
          </Text>
        </View>
        <TouchableOpacity onPress={() => toggleManagerSearch(group._id)}>
          <Text style={styles.cancelText}>Close</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.label}>Username</Text>
      <TextInput
        value={managerSearch.username}
        onChangeText={(value) => updateManagerSearchField('username', value)}
        placeholder="Search by username"
        placeholderTextColor="#8a9b91"
        style={styles.input}
      />

      <Text style={styles.label}>Membership status</Text>
      <View style={styles.chipGrid}>
        {[
          { label: 'Any', value: '' },
          { label: 'Member', value: 'member' },
          { label: 'Pending', value: 'pending' }
        ].map((option) => (
          <TouchableOpacity
            key={option.label}
            style={[
              styles.chip,
              managerSearch.status === option.value && styles.chipActive
            ]}
            onPress={() => updateManagerSearchField('status', option.value)}
          >
            <Text
              style={[
                styles.chipText,
                managerSearch.status === option.value && styles.chipTextActive
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.managerFieldRow}>
        <View style={styles.managerField}>
          <Text style={styles.label}>Minimum posts</Text>
          <TextInput
            value={managerSearch.minPosts}
            onChangeText={(value) => updateManagerSearchField('minPosts', value)}
            placeholder="0"
            placeholderTextColor="#8a9b91"
            keyboardType="number-pad"
            style={styles.input}
          />
        </View>
        <View style={styles.managerField}>
          <Text style={styles.label}>Maximum posts</Text>
          <TextInput
            value={managerSearch.maxPosts}
            onChangeText={(value) => updateManagerSearchField('maxPosts', value)}
            placeholder="Any"
            placeholderTextColor="#8a9b91"
            keyboardType="number-pad"
            style={styles.input}
          />
        </View>
      </View>

      <View style={styles.managerFieldRow}>
        <View style={styles.managerField}>
          <Text style={styles.label}>Start date</Text>
          <TextInput
            value={managerSearch.startDate}
            onChangeText={(value) => updateManagerSearchField('startDate', value)}
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#8a9b91"
            autoCapitalize="none"
            style={styles.input}
          />
        </View>
        <View style={styles.managerField}>
          <Text style={styles.label}>End date</Text>
          <TextInput
            value={managerSearch.endDate}
            onChangeText={(value) => updateManagerSearchField('endDate', value)}
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#8a9b91"
            autoCapitalize="none"
            style={styles.input}
          />
        </View>
      </View>

      {managerSearchError ? <Text style={styles.managerError}>{managerSearchError}</Text> : null}

      <View style={styles.searchActions}>
        <TouchableOpacity
          style={[styles.searchButton, isManagerSearchLoading && styles.disabledButton]}
          onPress={() => searchManagedGroupMembers(group._id)}
          disabled={isManagerSearchLoading}
        >
          <Text style={styles.searchButtonText}>
            {isManagerSearchLoading ? 'Searching...' : 'Search Members'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.clearButton}
          onPress={resetManagerSearch}
          disabled={isManagerSearchLoading}
        >
          <Text style={styles.clearButtonText}>Clear</Text>
        </TouchableOpacity>
      </View>

      {isManagerSearchLoading ? (
        <View style={styles.managerLoadingRow}>
          <ActivityIndicator color="#2f8f68" />
          <Text style={styles.requestMeta}>Calculating group activity...</Text>
        </View>
      ) : hasManagerSearched && managerSearchResults.length === 0 && !managerSearchError ? (
        <Text style={styles.managerEmptyText}>No users match these filters.</Text>
      ) : (
        managerSearchResults.map((result) => (
          <View key={result._id} style={styles.managerResultRow}>
            <View>
              <Text style={styles.requestName}>{result.username}</Text>
              <Text style={styles.requestMeta}>{result.status}</Text>
            </View>
            <Text style={styles.managerPostCount}>
              {result.postCount} post{result.postCount === 1 ? '' : 's'}
            </Text>
          </View>
        ))
      )}
    </View>
  );

  const renderGroupCard = (group) => {
    const adminName = group.admin?.username || 'Unknown admin';
    const membersCount = group.members?.length || 0;
    const pendingRequests = group.pendingRequests || [];
    const currentUserIsAdmin = isAdmin(group);
    const currentUserIsMember = isMember(group);
    const currentUserIsPending = isPending(group);
    const hasFullDetails = !group.isPrivate || currentUserIsAdmin || currentUserIsMember;

    return (
      <View key={group._id} style={styles.groupCard}>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleWrap}>
            <Text style={styles.groupName}>{group.name}</Text>
            <View style={styles.metaRow}>
              <Text style={styles.category}>{group.category}</Text>
              <Text style={styles.privacy}>
                {group.isPrivate ? 'Private' : 'Public'}
              </Text>
            </View>
          </View>

          {currentUserIsAdmin ? (
            <View style={styles.actions}>
              <TouchableOpacity onPress={() => toggleManagerSearch(group._id)}>
                <Text style={styles.managerSearchText}>Member Search</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => openEditForm(group)}>
                <Text style={styles.editText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => confirmDelete(group)}>
                <Text style={styles.deleteText}>Delete</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>

        {group.description ? (
          <Text style={styles.description}>{group.description}</Text>
        ) : null}

        {hasFullDetails ? (
          <View style={styles.details}>
            <Text style={styles.detailText}>Admin: {adminName}</Text>
            <Text style={styles.detailText}>Members: {membersCount}</Text>
          </View>
        ) : (
          <Text style={styles.detailText}>Private details are visible after approval.</Text>
        )}

        {currentUserIsAdmin ? (
          <View style={styles.requestsPanel}>
            <Text style={styles.requestsTitle}>Pending Join Requests</Text>
            {pendingRequests.length ? (
              pendingRequests.map((requestUser) => {
                const requestUserId = getId(requestUser);
                const approvingKey = `${group._id}:${requestUserId}:approve`;
                const rejectingKey = `${group._id}:${requestUserId}:reject`;
                const isProcessing =
                  processingRequestId === approvingKey ||
                  processingRequestId === rejectingKey;

                return (
                  <View key={requestUserId} style={styles.requestRow}>
                    <View style={styles.requestInfo}>
                      <Text style={styles.requestName}>
                        {getRequestUserName(requestUser)}
                      </Text>
                      <Text style={styles.requestMeta}>Wants to join this group</Text>
                    </View>
                    <View style={styles.requestActions}>
                      <TouchableOpacity
                        style={[
                          styles.approveButton,
                          isProcessing && styles.disabledButton
                        ]}
                        onPress={() => approveRequest(group._id, requestUserId)}
                        disabled={isProcessing}
                      >
                        <Text style={styles.approveButtonText}>
                          {processingRequestId === approvingKey ? 'Approving...' : 'Approve'}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.rejectButton,
                          isProcessing && styles.disabledButton
                        ]}
                        onPress={() => rejectRequest(group._id, requestUserId)}
                        disabled={isProcessing}
                      >
                        <Text style={styles.rejectButtonText}>
                          {processingRequestId === rejectingKey ? 'Rejecting...' : 'Reject'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            ) : (
              <Text style={styles.noRequestsText}>No pending requests.</Text>
            )}
          </View>
        ) : null}

        {currentUserIsAdmin && (group.members || []).length > 1 ? (
          <View style={styles.requestsPanel}>
            <Text style={styles.requestsTitle}>Manage Members</Text>
            {(group.members || []).filter((member) => getId(member) !== user?._id).map((member) => {
              const memberId = getId(member);
              const requestKey = `${group._id}:${memberId}:remove`;
              return (
                <View key={memberId} style={styles.requestRow}>
                  <Text style={styles.requestName}>{getRequestUserName(member)}</Text>
                  <TouchableOpacity
                    style={[styles.rejectButton, processingRequestId === requestKey && styles.disabledButton]}
                    onPress={() => removeMember(group._id, memberId)}
                    disabled={processingRequestId === requestKey}
                  >
                    <Text style={styles.rejectButtonText}>
                      {processingRequestId === requestKey ? 'Removing...' : 'Remove'}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        ) : null}

        {currentUserIsAdmin && managerSearchGroupId === group._id
          ? renderManagerSearch(group)
          : null}

        {!currentUserIsAdmin && !currentUserIsMember && !currentUserIsPending ? (
          <TouchableOpacity
            style={styles.joinButton}
            onPress={() => joinGroup(group._id)}
          >
            <Text style={styles.joinButtonText}>
              {group.isPrivate ? 'Request to Join' : 'Join Group'}
            </Text>
          </TouchableOpacity>
        ) : (
          <Text style={styles.statusText}>
            {currentUserIsAdmin
              ? 'You are the admin'
              : currentUserIsMember
                ? 'You are a member'
                : 'Request pending'}
          </Text>
        )}
      </View>
    );
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={() => fetchGroups({ refreshing: true })}
          tintColor="#2f8f68"
        />
      }
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.kicker}>Community spaces</Text>
          <Text style={styles.title}>Groups</Text>
        </View>
        <TouchableOpacity style={styles.createButton} onPress={openCreateForm}>
          <Text style={styles.createButtonText}>Create Group</Text>
        </TouchableOpacity>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'all' && styles.tabActive]}
          onPress={() => setActiveTab('all')}
        >
          <Text style={[styles.tabText, activeTab === 'all' && styles.tabTextActive]}>
            All Groups
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'my' && styles.tabActive]}
          onPress={() => setActiveTab('my')}
        >
          <Text style={[styles.tabText, activeTab === 'my' && styles.tabTextActive]}>
            My Groups
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchCard}>
        <Text style={styles.sectionTitle}>Search groups</Text>
        <TextInput
          value={search.name}
          onChangeText={(value) => updateSearchField('name', value)}
          placeholder="Search by name"
          placeholderTextColor="#8a9b91"
          style={styles.input}
        />

        <Text style={styles.label}>Category</Text>
        <View style={styles.chipGrid}>
          <TouchableOpacity
            style={[styles.chip, search.category === '' && styles.chipActive]}
            onPress={() => updateSearchField('category', '')}
          >
            <Text style={[styles.chipText, search.category === '' && styles.chipTextActive]}>
              any
            </Text>
          </TouchableOpacity>
          {CATEGORIES.map((category) => (
            <TouchableOpacity
              key={category}
              style={[styles.chip, search.category === category && styles.chipActive]}
              onPress={() => updateSearchField('category', category)}
            >
              <Text
                style={[
                  styles.chipText,
                  search.category === category && styles.chipTextActive
                ]}
              >
                {category}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Privacy</Text>
        <View style={styles.chipGrid}>
          {PRIVACY_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option.label}
              style={[styles.chip, search.isPrivate === option.value && styles.chipActive]}
              onPress={() => updateSearchField('isPrivate', option.value)}
            >
              <Text
                style={[
                  styles.chipText,
                  search.isPrivate === option.value && styles.chipTextActive
                ]}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.searchActions}>
          <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
            <Text style={styles.searchButtonText}>Search</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.clearButton} onPress={clearSearch}>
            <Text style={styles.clearButtonText}>Clear</Text>
          </TouchableOpacity>
        </View>
      </View>

      {isFormVisible ? (
        <View style={styles.formCard}>
          <View style={styles.formHeader}>
            <Text style={styles.formTitle}>
              {editingGroupId ? 'Edit Group' : 'Create Group'}
            </Text>
            <TouchableOpacity
              onPress={() => {
                resetForm();
                setIsFormVisible(false);
              }}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Name</Text>
          <TextInput
            value={form.name}
            onChangeText={(value) => updateFormField('name', value)}
            placeholder="Tel Aviv Dog Walkers"
            placeholderTextColor="#8a9b91"
            style={styles.input}
          />

          <Text style={styles.label}>Description</Text>
          <TextInput
            value={form.description}
            onChangeText={(value) => updateFormField('description', value)}
            placeholder="Daily walks, tips, and local pet events."
            placeholderTextColor="#8a9b91"
            style={[styles.input, styles.textArea]}
            multiline
          />

          <Text style={styles.label}>Category</Text>
          <View style={styles.chipGrid}>
            {CATEGORIES.map((category) => (
              <TouchableOpacity
                key={category}
                style={[styles.chip, form.category === category && styles.chipActive]}
                onPress={() => updateFormField('category', category)}
              >
                <Text
                  style={[
                    styles.chipText,
                    form.category === category && styles.chipTextActive
                  ]}
                >
                  {category}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Privacy</Text>
          <View style={styles.privacyToggle}>
            <TouchableOpacity
              style={[styles.privacyChoice, !form.isPrivate && styles.privacyChoiceActive]}
              onPress={() => updateFormField('isPrivate', false)}
            >
              <Text
                style={[
                  styles.privacyChoiceText,
                  !form.isPrivate && styles.privacyChoiceTextActive
                ]}
              >
                Public
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.privacyChoice, form.isPrivate && styles.privacyChoiceActive]}
              onPress={() => updateFormField('isPrivate', true)}
            >
              <Text
                style={[
                  styles.privacyChoiceText,
                  form.isPrivate && styles.privacyChoiceTextActive
                ]}
              >
                Private
              </Text>
            </TouchableOpacity>
          </View>

          {formError ? <Text style={styles.error}>{formError}</Text> : null}

          <TouchableOpacity
            style={[styles.submitButton, isSubmitting && styles.disabledButton]}
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            <Text style={styles.submitButtonText}>
              {isSubmitting
                ? 'Saving...'
                : editingGroupId
                  ? 'Save Changes'
                  : 'Create Group'}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {isLoading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color="#2f8f68" />
          <Text style={styles.loadingText}>Loading groups...</Text>
        </View>
      ) : displayedGroups.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No groups found</Text>
          <Text style={styles.emptyText}>
            Create a group or adjust your filters to discover more pet communities.
          </Text>
        </View>
      ) : (
        <View style={styles.groupList}>{displayedGroups.map(renderGroupCard)}</View>
      )}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
    marginBottom: 16
  },
  kicker: {
    color: '#2f8f68',
    fontWeight: '800',
    marginBottom: 4
  },
  title: {
    color: '#173b2c',
    fontSize: 28,
    fontWeight: '800'
  },
  createButton: {
    backgroundColor: '#2f8f68',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 11
  },
  createButtonText: {
    color: '#ffffff',
    fontWeight: '800'
  },
  error: {
    color: '#b3261e',
    lineHeight: 20,
    marginBottom: 12
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: '#e6f2ea',
    borderRadius: 8,
    padding: 4,
    marginBottom: 14
  },
  tab: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center'
  },
  tabActive: {
    backgroundColor: '#ffffff'
  },
  tabText: {
    color: '#5f7569',
    fontWeight: '800'
  },
  tabTextActive: {
    color: '#173b2c'
  },
  searchCard: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 18,
    borderWidth: 1,
    borderColor: '#dcebe1',
    marginBottom: 16
  },
  sectionTitle: {
    color: '#173b2c',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 12
  },
  label: {
    color: '#244536',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 6,
    marginTop: 10
  },
  input: {
    borderWidth: 1,
    borderColor: '#d7e5dc',
    borderRadius: 8,
    color: '#173b2c',
    backgroundColor: '#fbfdfb',
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 11
  },
  textArea: {
    minHeight: 86,
    textAlignVertical: 'top'
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  chip: {
    borderWidth: 1,
    borderColor: '#cfe2d6',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: '#fbfdfb'
  },
  chipActive: {
    backgroundColor: '#2f8f68',
    borderColor: '#2f8f68'
  },
  chipText: {
    color: '#244536',
    fontWeight: '700',
    textTransform: 'capitalize'
  },
  chipTextActive: {
    color: '#ffffff'
  },
  searchActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14
  },
  searchButton: {
    flex: 1,
    backgroundColor: '#2f8f68',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center'
  },
  searchButtonText: {
    color: '#ffffff',
    fontWeight: '800'
  },
  clearButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#2f8f68',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center'
  },
  clearButtonText: {
    color: '#2f8f68',
    fontWeight: '800'
  },
  formCard: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 18,
    borderWidth: 1,
    borderColor: '#dcebe1',
    marginBottom: 18
  },
  formHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14
  },
  formTitle: {
    color: '#173b2c',
    fontSize: 20,
    fontWeight: '800'
  },
  cancelText: {
    color: '#2f8f68',
    fontWeight: '800'
  },
  privacyToggle: {
    flexDirection: 'row',
    backgroundColor: '#e6f2ea',
    borderRadius: 8,
    padding: 4
  },
  privacyChoice: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center'
  },
  privacyChoiceActive: {
    backgroundColor: '#2f8f68'
  },
  privacyChoiceText: {
    color: '#244536',
    fontWeight: '800'
  },
  privacyChoiceTextActive: {
    color: '#ffffff'
  },
  submitButton: {
    backgroundColor: '#2f8f68',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 14
  },
  disabledButton: {
    opacity: 0.7
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800'
  },
  loadingBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40
  },
  loadingText: {
    color: '#5f7569',
    marginTop: 12
  },
  emptyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 22,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#dcebe1'
  },
  emptyTitle: {
    color: '#173b2c',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 8
  },
  emptyText: {
    color: '#5f7569',
    textAlign: 'center',
    lineHeight: 22
  },
  groupList: {
    gap: 12
  },
  groupCard: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 18,
    borderWidth: 1,
    borderColor: '#dcebe1'
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 10
  },
  cardTitleWrap: {
    flex: 1
  },
  groupName: {
    color: '#173b2c',
    fontSize: 21,
    fontWeight: '800',
    marginBottom: 6
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  category: {
    color: '#2f8f68',
    fontWeight: '800',
    textTransform: 'capitalize'
  },
  privacy: {
    color: '#5f7569',
    fontWeight: '700'
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start'
  },
  editText: {
    color: '#2f8f68',
    fontWeight: '800'
  },
  managerSearchText: {
    color: '#2f8f68',
    fontWeight: '800'
  },
  deleteText: {
    color: '#b3261e',
    fontWeight: '800'
  },
  description: {
    color: '#244536',
    lineHeight: 21,
    marginBottom: 12
  },
  details: {
    gap: 4,
    marginBottom: 12
  },
  detailText: {
    color: '#5f7569'
  },
  requestsPanel: {
    backgroundColor: '#fbfdfb',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dcebe1',
    padding: 12,
    marginBottom: 12
  },
  requestsTitle: {
    color: '#173b2c',
    fontWeight: '800',
    marginBottom: 10
  },
  requestRow: {
    borderTopWidth: 1,
    borderTopColor: '#edf4ef',
    paddingTop: 10,
    marginTop: 10
  },
  requestInfo: {
    marginBottom: 10
  },
  requestName: {
    color: '#244536',
    fontWeight: '800',
    marginBottom: 3
  },
  requestMeta: {
    color: '#5f7569'
  },
  requestActions: {
    flexDirection: 'row',
    gap: 8
  },
  approveButton: {
    flex: 1,
    backgroundColor: '#2f8f68',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center'
  },
  approveButtonText: {
    color: '#ffffff',
    fontWeight: '800'
  },
  rejectButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#b3261e',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center'
  },
  rejectButtonText: {
    color: '#b3261e',
    fontWeight: '800'
  },
  noRequestsText: {
    color: '#5f7569',
    lineHeight: 20
  },
  managerSearchPanel: {
    backgroundColor: '#f4faf6',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cfe2d6',
    padding: 12,
    marginBottom: 12
  },
  managerSearchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12
  },
  managerSearchHeading: {
    flex: 1
  },
  managerFieldRow: {
    flexDirection: 'row',
    gap: 10
  },
  managerField: {
    flex: 1
  },
  managerError: {
    color: '#b3261e',
    lineHeight: 20,
    marginTop: 12
  },
  managerLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14
  },
  managerEmptyText: {
    color: '#5f7569',
    lineHeight: 20,
    marginTop: 14
  },
  managerResultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#dcebe1',
    paddingTop: 10,
    marginTop: 10
  },
  managerPostCount: {
    color: '#2f8f68',
    fontWeight: '800'
  },
  joinButton: {
    backgroundColor: '#2f8f68',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center'
  },
  joinButtonText: {
    color: '#ffffff',
    fontWeight: '800'
  },
  statusText: {
    color: '#2f8f68',
    fontWeight: '800'
  }
});
