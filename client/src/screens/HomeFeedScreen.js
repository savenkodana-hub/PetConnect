import { useFocusEffect } from '@react-navigation/native';
import { ResizeMode, Video } from 'expo-av';
import { useCallback, useMemo, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import {
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import Svg, { Polyline } from 'react-native-svg';

import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const initialForm = {
  content: '',
  imageAsset: null,
  imageUrl: '',
  removeImage: false,
  videoUrl: '',
  group: '',
  pet: ''
};

const initialSearch = {
  keyword: '',
  group: '',
  startDate: '',
  endDate: ''
};

const STICKER_VIEWBOX_WIDTH = 360;
const STICKER_VIEWBOX_HEIGHT = 320;
const MAX_STICKER_STROKES = 30;
const MAX_STICKER_POINTS = 500;

const getErrorMessage = (error, fallback) =>
  error.response?.data?.message || fallback;

const getId = (value) => {
  if (!value) {
    return '';
  }

  return typeof value === 'string' ? value : value._id;
};

const formatDate = (dateValue) => {
  if (!dateValue) {
    return '';
  }

  return new Date(dateValue).toLocaleDateString();
};

const getStickerStrokes = (stickerData) => {
  if (!Array.isArray(stickerData)) {
    return [];
  }

  return stickerData.slice(0, MAX_STICKER_STROKES).reduce((safeStrokes, stroke) => {
    if (!stroke || !Array.isArray(stroke.points) || typeof stroke.color !== 'string') {
      return safeStrokes;
    }
    const points = stroke.points.slice(0, MAX_STICKER_POINTS).filter(
      (point) => Number.isFinite(point?.x) && Number.isFinite(point?.y)
    ).map((point) => ({
      x: Math.max(0, Math.min(STICKER_VIEWBOX_WIDTH, point.x)),
      y: Math.max(0, Math.min(STICKER_VIEWBOX_HEIGHT, point.y))
    }));
    if (points.length) safeStrokes.push({ color: stroke.color.slice(0, 32), points });
    return safeStrokes;
  }, []);
};

export default function HomeFeedScreen() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('combined');
  const [feedPosts, setFeedPosts] = useState([]);
  const [myPosts, setMyPosts] = useState([]);
  const [friendsPosts, setFriendsPosts] = useState([]);
  const [groupPosts, setGroupPosts] = useState([]);
  const [groups, setGroups] = useState([]);
  const [pets, setPets] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [search, setSearch] = useState(initialSearch);
  const [comments, setComments] = useState({});
  const [expandedComments, setExpandedComments] = useState({});
  const [videoLoading, setVideoLoading] = useState({});
  const [videoErrors, setVideoErrors] = useState({});
  const [editingPostId, setEditingPostId] = useState(null);
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');

  const fetchPosts = useCallback(async ({ refreshing = false } = {}) => {
    try {
      setError('');
      if (refreshing) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      const [feedResponse, myResponse, friendsResponse, groupPostsResponse, groupsResponse, petsResponse] = await Promise.all([
        api.get('/posts/feed'),
        api.get('/posts/my'),
        api.get('/posts/feed/friends'),
        api.get('/posts/feed/groups'),
        api.get('/groups/my'),
        api.get('/pets/my')
      ]);

      setFeedPosts(feedResponse.data.posts || []);
      setMyPosts(myResponse.data.posts || []);
      setFriendsPosts(friendsResponse.data.posts || []);
      setGroupPosts(groupPostsResponse.data.posts || []);
      setGroups(groupsResponse.data.groups || []);
      setPets(petsResponse.data.pets || []);
    } catch (fetchError) {
      setError(getErrorMessage(fetchError, 'Could not load posts.'));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchPosts();
    }, [fetchPosts])
  );

  const displayedPosts = useMemo(
    () => ({ combined: feedPosts, my: myPosts, friends: friendsPosts, groups: groupPosts }[activeTab] || []),
    [activeTab, feedPosts, friendsPosts, groupPosts, myPosts]
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
    setEditingPostId(null);
    setFormError('');
  };

  const openCreateForm = () => {
    resetForm();
    setIsFormVisible(true);
  };

  const openEditForm = (post) => {
    setForm({
      content: post.content || '',
      imageAsset: null,
      imageUrl: post.imageUrl || '',
      removeImage: false,
      videoUrl: post.videoUrl || '',
      group: getId(post.group),
      pet: getId(post.pet)
    });
    setEditingPostId(post._id);
    setIsFormVisible(true);
    setFormError('');
  };

  const validateForm = () => {
    if (!form.content.trim()) {
      return 'Post content is required.';
    }

    if (form.content.trim().length > 5000) {
      return 'Post content cannot exceed 5000 characters.';
    }

    if (form.videoUrl.trim()) {
      try {
        const url = new URL(form.videoUrl.trim());
        if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
      } catch (error) {
        return 'Video URL must be a valid HTTP or HTTPS URL.';
      }
    }

    return '';
  };

  const buildPayload = () => {
    const payload = new FormData();
    payload.append('content', form.content.trim());
    payload.append('group', form.group);
    payload.append('pet', form.pet);
    if (form.videoUrl.trim()) payload.append('videoUrl', form.videoUrl.trim());
    if (editingPostId && !form.videoUrl.trim()) payload.append('removeVideo', 'true');
    if (form.removeImage) payload.append('removeImage', 'true');
    if (form.imageAsset) {
      payload.append('media', {
        uri: form.imageAsset.uri,
        name: form.imageAsset.fileName || `post-${Date.now()}.jpg`,
        type: form.imageAsset.mimeType || 'image/jpeg'
      });
    }
    return payload;
  };

  const choosePhoto = async () => {
    try {
      setFormError('');
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        setFormError('Photo library permission is required to choose a post photo.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8
      });

      if (!result.canceled && result.assets?.length) {
        const asset = result.assets[0];
        if (asset.fileSize && asset.fileSize > 10 * 1024 * 1024) {
          setFormError('Post images must be 10 MB or smaller.');
          return;
        }
        if (asset.mimeType && !['image/jpeg', 'image/png', 'image/webp'].includes(asset.mimeType)) {
          setFormError('Choose a JPEG, PNG, or WebP image.');
          return;
        }
        setForm((current) => ({ ...current, imageAsset: asset, removeImage: false }));
      }
    } catch (pickerError) {
      setFormError('Could not open the photo library.');
    }
  };

  const handleSubmit = async () => {
    const validationMessage = validateForm();

    if (validationMessage) {
      setFormError(validationMessage);
      return;
    }

    try {
      setIsSubmitting(true);
      setFormError('');

      if (editingPostId) {
        await api.put(`/posts/${editingPostId}`, buildPayload(), { headers: { 'Content-Type': 'multipart/form-data' } });
      } else {
        await api.post('/posts', buildPayload(), { headers: { 'Content-Type': 'multipart/form-data' } });
      }

      resetForm();
      setIsFormVisible(false);
      await fetchPosts();
    } catch (submitError) {
      setFormError(
        getErrorMessage(
          submitError,
          editingPostId ? 'Could not update post.' : 'Could not create post.'
        )
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDelete = (post) => {
    Alert.alert(
      'Delete post',
      'Are you sure you want to delete this post?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deletePost(post._id)
        }
      ]
    );
  };

  const deletePost = async (postId) => {
    try {
      setError('');
      await api.delete(`/posts/${postId}`);

      if (editingPostId === postId) {
        resetForm();
        setIsFormVisible(false);
      }

      await fetchPosts();
    } catch (deleteError) {
      setError(getErrorMessage(deleteError, 'Could not delete post.'));
    }
  };

  const likePost = async (postId) => {
    try {
      setError('');
      await api.post(`/posts/${postId}/like`);
      await fetchPosts();
    } catch (likeError) {
      setError(getErrorMessage(likeError, 'Could not like post.'));
    }
  };

  const addComment = async (postId) => {
    const text = comments[postId]?.trim();

    if (!text) {
      setError('Comment text is required.');
      return;
    }

    if (text.length > 2000) {
      setError('Comments cannot exceed 2000 characters.');
      return;
    }

    try {
      setError('');
      await api.post(`/posts/${postId}/comment`, { text });
      setComments((current) => ({ ...current, [postId]: '' }));
      setExpandedComments((current) => ({ ...current, [postId]: true }));
      await fetchPosts();
    } catch (commentError) {
      setError(getErrorMessage(commentError, 'Could not add comment.'));
    }
  };

  const handleSearch = async () => {
    const keyword = search.keyword.trim();
    const startDate = search.startDate.trim();
    const endDate = search.endDate.trim();

    if (keyword.length > 100) {
      setError('Search keyword cannot exceed 100 characters.');
      return;
    }

    if (startDate && Number.isNaN(Date.parse(startDate))) {
      setError('Start date must be valid.');
      return;
    }

    if (endDate && Number.isNaN(Date.parse(endDate))) {
      setError('End date must be valid.');
      return;
    }

    if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
      setError('End date must be on or after start date.');
      return;
    }

    try {
      setError('');
      setIsLoading(true);

      const params = {};
      if (keyword) {
        params.keyword = keyword;
      }
      if (search.group) {
        params.group = search.group;
      }
      if (startDate) {
        params.startDate = startDate;
      }
      if (endDate) {
        params.endDate = endDate;
      }

      const { data } = await api.get('/posts/search', { params });
      setFeedPosts(data.posts || []);
      setActiveTab('combined');
    } catch (searchError) {
      setError(getErrorMessage(searchError, 'Could not search posts.'));
    } finally {
      setIsLoading(false);
    }
  };

  const clearSearch = async () => {
    setSearch(initialSearch);
    await fetchPosts();
  };

  const isAuthor = (post) => getId(post.author) === user?._id;

  const toggleComments = (postId) => {
    setExpandedComments((current) => ({
      ...current,
      [postId]: !current[postId]
    }));
  };

  const renderGroupPicker = (selectedValue, onSelect, includeAny = true) => (
    <View style={styles.chipGrid}>
      {includeAny ? (
        <TouchableOpacity
          style={[styles.chip, selectedValue === '' && styles.chipActive]}
          onPress={() => onSelect('')}
        >
          <Text style={[styles.chipText, selectedValue === '' && styles.chipTextActive]}>
            none
          </Text>
        </TouchableOpacity>
      ) : null}
      {groups.map((group) => (
        <TouchableOpacity
          key={group._id}
          style={[styles.chip, selectedValue === group._id && styles.chipActive]}
          onPress={() => onSelect(group._id)}
        >
          <Text
            style={[
              styles.chipText,
              selectedValue === group._id && styles.chipTextActive
            ]}
          >
            {group.name}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderPetPicker = (selectedValue, onSelect) => (
    <View style={styles.chipGrid}>
      <TouchableOpacity style={[styles.chip, selectedValue === '' && styles.chipActive]} onPress={() => onSelect('')}>
        <Text style={[styles.chipText, selectedValue === '' && styles.chipTextActive]}>none</Text>
      </TouchableOpacity>
      {pets.map((pet) => (
        <TouchableOpacity key={pet._id} style={[styles.chip, selectedValue === pet._id && styles.chipActive]} onPress={() => onSelect(pet._id)}>
          <Text style={[styles.chipText, selectedValue === pet._id && styles.chipTextActive]}>{pet.name}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderPostCard = (post) => {
    const authorName = post.author?.username || 'Unknown author';
    const groupName = post.group?.name || '';
    const petName = post.pet?.name || '';
    const currentUserIsAuthor = isAuthor(post);
    const currentUserIsGroupAdmin = getId(post.group?.admin) === user?._id;
    const postComments = post.comments || [];
    const commentsAreOpen = !!expandedComments[post._id];
    const stickerStrokes = getStickerStrokes(post.stickerData);

    return (
      <View key={post._id} style={styles.postCard}>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleWrap}>
            <Text style={styles.author}>{authorName}</Text>
            <Text style={styles.meta}>
              {groupName ? `${groupName} - ` : ''}
              {formatDate(post.createdAt)}
            </Text>
          </View>

          {currentUserIsAuthor || currentUserIsGroupAdmin ? (
            <View style={styles.actions}>
              {currentUserIsAuthor ? (
                <TouchableOpacity onPress={() => openEditForm(post)}>
                  <Text style={styles.editText}>Edit</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity onPress={() => confirmDelete(post)}>
                <Text style={styles.deleteText}>Delete</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>

        <Text style={styles.contentText}>{post.content}</Text>

        {petName ? (
          <View style={styles.petStoryTag}>
            <Text style={styles.petStoryTagText}>Story with {petName}</Text>
          </View>
        ) : null}

        {post.imageUrl ? (
          <Image source={{ uri: post.imageUrl }} style={styles.postImage} />
        ) : null}

        {post.videoUrl ? (
          <View style={styles.postVideoFrame}>
            {videoLoading[post._id] ? (
              <View style={styles.videoStatusOverlay}><ActivityIndicator color="#ffffff" /></View>
            ) : null}
            <Video
              source={{ uri: post.videoUrl }}
              style={styles.postVideo}
              useNativeControls
              resizeMode={ResizeMode.CONTAIN}
              onLoadStart={() => {
                setVideoErrors((current) => ({ ...current, [post._id]: '' }));
                setVideoLoading((current) => ({ ...current, [post._id]: true }));
              }}
              onLoad={() => setVideoLoading((current) => ({ ...current, [post._id]: false }))}
              onError={() => {
                setVideoLoading((current) => ({ ...current, [post._id]: false }));
                setVideoErrors((current) => ({ ...current, [post._id]: 'Video could not be loaded.' }));
              }}
            />
            {videoErrors[post._id] ? (
              <View style={styles.videoStatusOverlay}><Text style={styles.videoErrorText}>{videoErrors[post._id]}</Text></View>
            ) : null}
          </View>
        ) : null}


        {stickerStrokes.length ? (
          <View style={styles.stickerPreview}>
            <Text style={styles.stickerTitle}>Pet Sticker</Text>
            <Svg
              width="100%"
              height={130}
              viewBox={`0 0 ${STICKER_VIEWBOX_WIDTH} ${STICKER_VIEWBOX_HEIGHT}`}
            >
              {stickerStrokes.map((stroke, index) => (
                <Polyline
                  key={`${post._id}-sticker-${index}`}
                  points={stroke.points.map((point) => `${point.x},${point.y}`).join(' ')}
                  fill="none"
                  stroke={stroke.color}
                  strokeWidth="7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ))}
            </Svg>
          </View>
        ) : null}

        <View style={styles.statsRow}>
          <Text style={styles.statText}>{post.likes?.length || 0} likes</Text>
          <TouchableOpacity onPress={() => toggleComments(post._id)}>
            <Text style={styles.commentToggleText}>
              {commentsAreOpen ? 'Hide' : 'View'} {postComments.length} comment
              {postComments.length === 1 ? '' : 's'}
            </Text>
          </TouchableOpacity>
        </View>

        {commentsAreOpen ? (
          <View style={styles.commentsPanel}>
            {postComments.length ? (
              postComments.map((comment) => {
                const commenterName = comment.user?.username || 'PetConnect user';

                return (
                  <View key={comment._id} style={styles.commentItem}>
                    <Text style={styles.commentAuthor}>{commenterName}</Text>
                    <Text style={styles.commentText}>{comment.text}</Text>
                    <Text style={styles.commentDate}>{formatDate(comment.createdAt)}</Text>
                  </View>
                );
              })
            ) : (
              <Text style={styles.noCommentsText}>No comments yet. Be the first to reply.</Text>
            )}
          </View>
        ) : null}

        <View style={styles.postActions}>
          <TouchableOpacity style={styles.lightButton} onPress={() => likePost(post._id)}>
            <Text style={styles.lightButtonText}>Like</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.commentBox}>
          <TextInput
            value={comments[post._id] || ''}
            onChangeText={(value) =>
              setComments((current) => ({ ...current, [post._id]: value }))
            }
            placeholder="Add a comment"
            placeholderTextColor="#8a9b91"
            style={styles.commentInput}
          />
          <TouchableOpacity style={styles.commentButton} onPress={() => addComment(post._id)}>
            <Text style={styles.commentButtonText}>Post</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={() => fetchPosts({ refreshing: true })}
          tintColor="#2f8f68"
        />
      }
    >
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.kicker}>Hello, {user?.username}</Text>
          <Text style={styles.title}>PetConnect Feed</Text>
          <Text style={styles.subtitle}>Share updates, follow group posts, and cheer each other on.</Text>
        </View>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.toolbar}>
        <TouchableOpacity style={styles.primaryButton} onPress={openCreateForm}>
          <Text style={styles.primaryButtonText}>Create Post</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => setIsSearchVisible((visible) => !visible)}
        >
          <Text style={styles.secondaryButtonText}>
            {isSearchVisible ? 'Hide Search' : 'Search'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tabRow}>
        {[
          ['combined', 'Combined'],
          ['my', 'My Posts'],
          ['friends', 'Friends Feed'],
          ['groups', 'Groups Feed']
        ].map(([value, label]) => (
          <TouchableOpacity key={value} style={[styles.tab, activeTab === value && styles.tabActive]} onPress={() => setActiveTab(value)}>
            <Text style={[styles.tabText, activeTab === value && styles.tabTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {isSearchVisible ? (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Search posts</Text>
          <TextInput
            value={search.keyword}
            onChangeText={(value) => updateSearchField('keyword', value)}
            placeholder="Keyword"
            placeholderTextColor="#8a9b91"
            style={styles.input}
          />
          <Text style={styles.label}>Group</Text>
          {renderGroupPicker(search.group, (value) => updateSearchField('group', value))}
          <View style={styles.row}>
            <View style={styles.rowItem}>
              <Text style={styles.label}>Start date</Text>
              <TextInput
                value={search.startDate}
                onChangeText={(value) => updateSearchField('startDate', value)}
                placeholder="2026-01-01"
                placeholderTextColor="#8a9b91"
                style={styles.input}
              />
            </View>
            <View style={styles.rowItem}>
              <Text style={styles.label}>End date</Text>
              <TextInput
                value={search.endDate}
                onChangeText={(value) => updateSearchField('endDate', value)}
                placeholder="2026-12-31"
                placeholderTextColor="#8a9b91"
                style={styles.input}
              />
            </View>
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
      ) : null}

      {isFormVisible ? (
        <View style={styles.panel}>
          <View style={styles.formHeader}>
            <Text style={styles.panelTitle}>
              {editingPostId ? 'Edit Post' : 'Create Post'}
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

          <Text style={styles.label}>Content</Text>
          <TextInput
            value={form.content}
            onChangeText={(value) => updateFormField('content', value)}
            placeholder="What did your pet do today?"
            placeholderTextColor="#8a9b91"
            style={[styles.input, styles.textArea]}
            multiline
          />
          <Text style={styles.label}>Photo</Text>
          {form.imageAsset?.uri || form.imageUrl ? (
            <Image source={{ uri: form.imageAsset?.uri || form.imageUrl }} style={styles.formImagePreview} />
          ) : (
            <View style={styles.formImagePlaceholder}>
              <Text style={styles.formImagePlaceholderText}>No photo selected</Text>
            </View>
          )}
          <View style={styles.photoActions}>
            <TouchableOpacity style={styles.photoButton} onPress={choosePhoto}>
              <Text style={styles.photoButtonText}>Choose Photo</Text>
            </TouchableOpacity>
            {form.imageAsset?.uri || form.imageUrl ? (
              <TouchableOpacity
                style={styles.removePhotoButton}
                onPress={() => setForm((current) => ({ ...current, imageAsset: null, imageUrl: '', removeImage: true }))}
              >
                <Text style={styles.removePhotoButtonText}>Remove</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          <Text style={styles.label}>Video URL</Text>
          <TextInput
            value={form.videoUrl}
            onChangeText={(value) => updateFormField('videoUrl', value)}
            placeholder="https://example.com/video.mp4"
            placeholderTextColor="#8a9b91"
            style={styles.input}
            autoCapitalize="none"
          />
          <Text style={styles.label}>Group</Text>
          {renderGroupPicker(form.group, (value) => updateFormField('group', value))}
          <Text style={styles.label}>Pet</Text>
          {renderPetPicker(form.pet, (value) => updateFormField('pet', value))}

          {formError ? <Text style={styles.error}>{formError}</Text> : null}

          <TouchableOpacity
            style={[styles.submitButton, isSubmitting && styles.disabledButton]}
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            <Text style={styles.submitButtonText}>
              {isSubmitting
                ? 'Saving...'
                : editingPostId
                  ? 'Save Changes'
                  : 'Publish Post'}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {isLoading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color="#2f8f68" />
          <Text style={styles.loadingText}>Loading posts...</Text>
        </View>
      ) : displayedPosts.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>
            {{ my: 'No posts from you yet', friends: 'No friend posts yet', groups: 'No group posts yet' }[activeTab] || 'No posts yet'}
          </Text>
          <Text style={styles.emptyText}>
            {{
              my: 'Create your first post to see it here.',
              friends: 'Add accepted friends or wait for them to share a post.',
              groups: 'Join a group with posts to build this feed.'
            }[activeTab] || 'Join groups, add friends, or publish a post to fill your combined feed.'}
          </Text>
        </View>
      ) : (
        <View style={styles.postList}>{displayedPosts.map(renderPostCard)}</View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7fbf6'
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 36
  },
  header: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#dcebe1'
  },
  headerText: {
    marginBottom: 14
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
  toolbar: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12
  },
  primaryButton: {
    flex: 1,
    backgroundColor: '#2f8f68',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center'
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: '800'
  },
  secondaryButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#2f8f68',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center'
  },
  secondaryButtonText: {
    color: '#2f8f68',
    fontWeight: '800'
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
  panel: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 18,
    borderWidth: 1,
    borderColor: '#dcebe1',
    marginBottom: 16
  },
  panelTitle: {
    color: '#173b2c',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 12
  },
  formHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  cancelText: {
    color: '#2f8f68',
    fontWeight: '800'
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
    minHeight: 94,
    textAlignVertical: 'top'
  },
  formImagePreview: {
    width: '100%',
    height: 190,
    borderRadius: 8,
    backgroundColor: '#e6f2ea',
    marginBottom: 10
  },
  formImagePlaceholder: {
    height: 128,
    borderRadius: 8,
    backgroundColor: '#eef8f0',
    borderWidth: 1,
    borderColor: '#dcebe1',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10
  },
  formImagePlaceholderText: {
    color: '#5f7569',
    fontWeight: '800'
  },
  photoActions: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 4
  },
  photoButton: {
    flex: 1,
    backgroundColor: '#2f8f68',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center'
  },
  photoButtonText: {
    color: '#ffffff',
    fontWeight: '800'
  },
  removePhotoButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#b3261e',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center'
  },
  removePhotoButtonText: {
    color: '#b3261e',
    fontWeight: '800'
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
    fontWeight: '700'
  },
  chipTextActive: {
    color: '#ffffff'
  },
  row: {
    flexDirection: 'row',
    gap: 10
  },
  rowItem: {
    flex: 1
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
  postList: {
    gap: 12
  },
  postCard: {
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
  author: {
    color: '#173b2c',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 3
  },
  meta: {
    color: '#5f7569',
    fontSize: 13
  },
  actions: {
    flexDirection: 'row',
    gap: 12
  },
  editText: {
    color: '#2f8f68',
    fontWeight: '800'
  },
  deleteText: {
    color: '#b3261e',
    fontWeight: '800'
  },
  contentText: {
    color: '#244536',
    fontSize: 16,
    lineHeight: 23,
    marginBottom: 12
  },
  petStoryTag: {
    alignSelf: 'flex-start',
    backgroundColor: '#eef8f0',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dcebe1',
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 10
  },
  petStoryTagText: {
    color: '#2f8f68',
    fontWeight: '800'
  },
  postImage: {
    width: '100%',
    height: 190,
    borderRadius: 8,
    backgroundColor: '#e6f2ea',
    marginBottom: 12
  },
  postVideoFrame: {
    height: 220,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#173b2c',
    marginBottom: 12
  },
  postVideo: {
    width: '100%',
    height: '100%'
  },
  videoErrorText: {
    color: '#ffffff',
    padding: 10,
    textAlign: 'center'
  },
  videoStatusOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(23, 59, 44, 0.72)'
  },
  stickerPreview: {
    backgroundColor: '#fbfdfb',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dcebe1',
    padding: 12,
    marginBottom: 12
  },
  stickerTitle: {
    color: '#2f8f68',
    fontWeight: '800',
    marginBottom: 8
  },
  statsRow: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 10
  },
  statText: {
    color: '#5f7569',
    fontWeight: '700'
  },
  commentToggleText: {
    color: '#2f8f68',
    fontWeight: '800'
  },
  commentsPanel: {
    backgroundColor: '#fbfdfb',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dcebe1',
    padding: 12,
    marginBottom: 12,
    gap: 10
  },
  commentItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#edf4ef',
    paddingBottom: 10
  },
  commentAuthor: {
    color: '#173b2c',
    fontWeight: '800',
    marginBottom: 3
  },
  commentText: {
    color: '#244536',
    lineHeight: 21
  },
  commentDate: {
    color: '#8a9b91',
    fontSize: 12,
    marginTop: 5
  },
  noCommentsText: {
    color: '#5f7569',
    lineHeight: 21
  },
  postActions: {
    flexDirection: 'row',
    marginBottom: 12
  },
  lightButton: {
    borderWidth: 1,
    borderColor: '#2f8f68',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 9
  },
  lightButtonText: {
    color: '#2f8f68',
    fontWeight: '800'
  },
  commentBox: {
    flexDirection: 'row',
    gap: 8
  },
  commentInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d7e5dc',
    borderRadius: 8,
    color: '#173b2c',
    backgroundColor: '#fbfdfb',
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  commentButton: {
    backgroundColor: '#2f8f68',
    borderRadius: 8,
    paddingHorizontal: 14,
    justifyContent: 'center'
  },
  commentButtonText: {
    color: '#ffffff',
    fontWeight: '800'
  }
});
