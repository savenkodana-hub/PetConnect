import { ResizeMode, Video } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import Svg, { Polyline } from 'react-native-svg';

import api from '../services/api';

const COLORS = ['#2f8f68', '#173b2c', '#f2a65a', '#b3261e', '#4d78cc'];
const CANVAS_WIDTH = Dimensions.get('window').width - 40;
const CANVAS_HEIGHT = 320;
const MAX_STROKES = 30;
const MAX_POINTS_PER_STROKE = 500;
const MAX_DRAWING_BYTES = 50000;

const normalizePoint = (event) => {
  const { locationX, locationY } = event.nativeEvent;

  return {
    x: Math.max(0, Math.min(CANVAS_WIDTH, locationX)),
    y: Math.max(0, Math.min(CANVAS_HEIGHT, locationY))
  };
};

export default function MediaStudioScreen({ navigation }) {
  const videoRef = useRef(null);
  const drawingEnabledRef = useRef(false);
  const [pets, setPets] = useState([]);
  const [selectedPetId, setSelectedPetId] = useState('');
  const [caption, setCaption] = useState('');
  const [videoAsset, setVideoAsset] = useState(null);
  const [videoError, setVideoError] = useState('');
  const [publishError, setPublishError] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);
  const [petsError, setPetsError] = useState('');
  const [isPetsLoading, setIsPetsLoading] = useState(true);
  const [isVideoLoading, setIsVideoLoading] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [strokes, setStrokes] = useState([]);
  const [activeColor, setActiveColor] = useState(COLORS[0]);

  const fetchPets = useCallback(async () => {
    try {
      setPetsError('');
      setIsPetsLoading(true);
      const { data } = await api.get('/pets/my');
      const nextPets = data.pets || [];
      setPets(nextPets);

      setSelectedPetId((currentPetId) => currentPetId || nextPets[0]?._id || '');
    } catch (error) {
      setPetsError(error.response?.data?.message || 'Could not load your pets.');
    } finally {
      setIsPetsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPets();
  }, [fetchPets]);

  const selectedPet = pets.find((pet) => pet._id === selectedPetId);
  const selectedPetPhoto = selectedPet?.imageUrl;

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponderCapture: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (event) => {
          if (strokes.length >= MAX_STROKES) {
            drawingEnabledRef.current = false;
            setPublishError(`Drawing is limited to ${MAX_STROKES} strokes.`);
            return;
          }
          drawingEnabledRef.current = true;
          setIsDrawing(true);
          const point = normalizePoint(event);
          setStrokes((current) => [
            ...current,
            {
              color: activeColor,
              points: [point]
            }
          ]);
        },
        onPanResponderMove: (event) => {
          if (!drawingEnabledRef.current) return;
          const point = normalizePoint(event);
          setStrokes((current) => {
            if (!current.length) {
              return current;
            }

            const next = [...current];
            const lastStroke = next[next.length - 1];
            if (lastStroke.points.length >= MAX_POINTS_PER_STROKE) {
              return current;
            }
            next[next.length - 1] = {
              ...lastStroke,
              points: [...lastStroke.points, point]
            };

            return next;
          });
        },
        onPanResponderRelease: () => {
          drawingEnabledRef.current = false;
          setIsDrawing(false);
        },
        onPanResponderTerminate: () => {
          drawingEnabledRef.current = false;
          setIsDrawing(false);
        }
      }),
    [activeColor, strokes.length]
  );

  const handleChooseVideo = async () => {
    try {
      setVideoError('');
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        setVideoError('Gallery permission is required to choose a pet post video.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: false,
        quality: 1
      });

      if (result.canceled) {
        return;
      }

      const asset = result.assets?.[0];
      if (asset?.fileSize && asset.fileSize > 25 * 1024 * 1024) {
        setVideoError('Videos must be 25 MB or smaller.');
        return;
      }
      if (asset?.mimeType && !['video/mp4', 'video/quicktime', 'video/webm'].includes(asset.mimeType)) {
        setVideoError('Choose an MP4, MOV, or WebM video.');
        return;
      }
      setVideoAsset(asset || null);
    } catch (error) {
      setVideoError('Could not open your video library.');
    }
  };

  const handlePublish = async () => {
    const trimmedCaption = caption.trim();

    if (!selectedPetId) {
      setPublishError('Select a pet before publishing.');
      return;
    }

    if (!trimmedCaption) {
      setPublishError('Write a caption before publishing.');
      return;
    }

    if (!videoAsset?.uri) {
      setPublishError('Choose a video from your phone before publishing.');
      return;
    }


    if (strokes.length > MAX_STROKES || strokes.some((stroke) => stroke.points.length > MAX_POINTS_PER_STROKE)) {
      setPublishError('Drawing exceeds the allowed stroke or point limit.');
      return;
    }

    if (JSON.stringify(strokes).length > MAX_DRAWING_BYTES) {
      setPublishError('Drawing is too detailed. Clear it and try a simpler drawing.');
      return;
    }

    try {
      setPublishError('');
      setIsPublishing(true);

      const payload = new FormData();
      payload.append('content', trimmedCaption);
      payload.append('pet', selectedPetId);
      if (strokes.length) payload.append('stickerData', JSON.stringify(strokes));
      payload.append('media', {
        uri: videoAsset.uri,
        name: videoAsset.fileName || `pet-video-${Date.now()}.mp4`,
        type: videoAsset.mimeType || 'video/mp4'
      });

      await api.post('/posts', payload, { headers: { 'Content-Type': 'multipart/form-data' } });

      Alert.alert('Post published', 'Your pet post was shared on PetConnect.', [
        {
          text: 'View Feed',
          onPress: () => navigation.navigate('MainTabs', { screen: 'Feed' })
        }
      ]);
    } catch (error) {
      setPublishError(error.response?.data?.message || 'Could not publish your pet post.');
    } finally {
      setIsPublishing(false);
    }
  };

  const clearCanvas = () => {
    setStrokes([]);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      scrollEnabled={!isDrawing}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <Text style={styles.kicker}>Enhanced pet content</Text>
        <Text style={styles.title}>Pet Post Creator</Text>
        <Text style={styles.subtitle}>
          Create a richer PetConnect post: choose a pet, add a caption,
          preview a video, draw a custom sticker, and publish it to your feed.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>1. Select a Pet</Text>
        <Text style={styles.helperText}>
          Pick which pet this post is about. This helps the draft feel personal
          before you publish it as a real post.
        </Text>

        {petsError ? <Text style={styles.error}>{petsError}</Text> : null}

        {isPetsLoading ? (
          <View style={styles.inlineLoading}>
            <ActivityIndicator size="small" color="#2f8f68" />
            <Text style={styles.loadingText}>Loading pets...</Text>
          </View>
        ) : pets.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>No pets yet</Text>
            <Text style={styles.emptyText}>
              Add a pet in the Pets tab, then come back to create their post.
            </Text>
          </View>
        ) : (
          <View style={styles.petPicker}>
            {pets.map((pet) => (
              <TouchableOpacity
                key={pet._id}
                style={[
                  styles.petChip,
                  selectedPetId === pet._id && styles.petChipActive
                ]}
                onPress={() => setSelectedPetId(pet._id)}
              >
                <Text
                  style={[
                    styles.petChipText,
                    selectedPetId === pet._id && styles.petChipTextActive
                  ]}
                >
                  {pet.name}
                </Text>
                <Text
                  style={[
                    styles.petChipMeta,
                    selectedPetId === pet._id && styles.petChipTextActive
                  ]}
                >
                  {pet.type}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>2. Add a Video Preview</Text>
        <Text style={styles.helperText}>
          Choose a video from your phone gallery. For the Expo Go demo, the
          selected phone video is saved with the post.
        </Text>

        <TouchableOpacity style={styles.primaryButton} onPress={handleChooseVideo}>
          <Text style={styles.primaryButtonText}>
            {videoAsset ? 'Choose Different Video' : 'Choose Video From Phone'}
          </Text>
        </TouchableOpacity>

        {videoError ? <Text style={styles.error}>{videoError}</Text> : null}

        {videoAsset?.uri ? (
          <View style={styles.videoFrame}>
            {isVideoLoading ? (
              <View style={styles.videoLoading}>
                <ActivityIndicator size="large" color="#2f8f68" />
                <Text style={styles.loadingText}>Loading video...</Text>
              </View>
            ) : null}
            <Video
              ref={videoRef}
              source={{ uri: videoAsset.uri }}
              style={styles.video}
              useNativeControls
              resizeMode={ResizeMode.CONTAIN}
              onLoadStart={() => {
                setVideoError('');
                setIsVideoLoading(true);
              }}
              onLoad={() => setIsVideoLoading(false)}
              onError={() => {
                setIsVideoLoading(false);
                setVideoError('Could not preview this selected video.');
              }}
            />
          </View>
        ) : (
          <View style={styles.videoPlaceholder}>
            <Text style={styles.videoPlaceholderTitle}>Video preview</Text>
            <Text style={styles.videoPlaceholderText}>
              Choose a clip from your phone to preview the post here.
            </Text>
          </View>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>3. Draw a Custom Sticker</Text>
        <Text style={styles.helperText}>
          Draw with your finger to create a playful sticker idea for the post.
        </Text>

        <View style={styles.colorRow}>
          {COLORS.map((color) => (
            <TouchableOpacity
              key={color}
              style={[
                styles.colorChoice,
                { backgroundColor: color },
                activeColor === color && styles.colorChoiceActive
              ]}
              onPress={() => setActiveColor(color)}
            />
          ))}
        </View>

        <View
          style={styles.canvas}
          pointerEvents="box-only"
          {...panResponder.panHandlers}
        >
          <Svg width={CANVAS_WIDTH} height={CANVAS_HEIGHT}>
            {strokes.map((stroke, index) => (
              <Polyline
                key={`${stroke.color}-${index}`}
                points={stroke.points.map((point) => `${point.x},${point.y}`).join(' ')}
                fill="none"
                stroke={stroke.color}
                strokeWidth="5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
          </Svg>
          {strokes.length === 0 ? (
            <View pointerEvents="none" style={styles.canvasHint}>
              <Text style={styles.canvasHintText}>Draw here</Text>
            </View>
          ) : null}
        </View>

        <TouchableOpacity style={styles.clearButton} onPress={clearCanvas}>
          <Text style={styles.clearButtonText}>Clear Canvas</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>4. Add a Caption</Text>
        <Text style={styles.helperText}>
          Keep it short and social. This becomes the content of your published post.
        </Text>
        <TextInput
          value={caption}
          onChangeText={setCaption}
          placeholder="Today Bamba learned a new trick at the park!"
          placeholderTextColor="#8a9b91"
          style={[styles.input, styles.captionInput]}
          multiline
          maxLength={160}
        />
        <Text style={styles.captionCount}>{caption.length}/160</Text>
      </View>

      <View style={styles.previewCard}>
        <Text style={styles.sectionTitle}>5. Preview and Publish</Text>
        <Text style={styles.helperText}>
          Review how your pet post will feel before it becomes a real post.
        </Text>

        <View style={styles.draftHeader}>
          {selectedPetPhoto ? (
            <Image source={{ uri: selectedPetPhoto }} style={styles.draftPetPhoto} />
          ) : (
            <View style={styles.draftAvatar}>
              <Text style={styles.draftAvatarText}>
                {selectedPet?.name ? selectedPet.name.charAt(0).toUpperCase() : 'P'}
              </Text>
            </View>
          )}
          <View>
            <Text style={styles.draftPetName}>{selectedPet?.name || 'Select a pet'}</Text>
            <Text style={styles.draftMeta}>
              {selectedPet ? `${selectedPet.type} post draft` : 'Pet post draft'}
            </Text>
          </View>
        </View>

        <Text style={styles.draftCaption}>
          {caption || 'Your caption will appear here.'}
        </Text>

        <View style={styles.draftStickerPreview}>
          <Text style={styles.draftStickerTitle}>Sticker preview</Text>
          {strokes.length ? (
            <Svg width="100%" height={120} viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}>
              {strokes.map((stroke, index) => (
                <Polyline
                  key={`preview-${stroke.color}-${index}`}
                  points={stroke.points.map((point) => `${point.x},${point.y}`).join(' ')}
                  fill="none"
                  stroke={stroke.color}
                  strokeWidth="7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ))}
            </Svg>
          ) : (
            <Text style={styles.draftStickerEmpty}>Draw a sticker to preview it here.</Text>
          )}
        </View>

        <View style={styles.draftSummary}>
          <Text style={styles.draftSummaryText}>
            Video: {videoAsset ? 'selected from phone' : 'not added'}
          </Text>
          <Text style={styles.draftSummaryText}>
            Sticker: {strokes.length ? `${strokes.length} stroke(s)` : 'not drawn yet'}
          </Text>
        </View>

        {publishError ? <Text style={styles.publishError}>{publishError}</Text> : null}

        <TouchableOpacity
          style={[styles.publishButton, isPublishing && styles.disabledButton]}
          onPress={handlePublish}
          disabled={isPublishing}
        >
          {isPublishing ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text style={styles.publishButtonText}>Publish Pet Post</Text>
          )}
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
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 18,
    borderWidth: 1,
    borderColor: '#dcebe1',
    marginBottom: 16
  },
  sectionTitle: {
    color: '#173b2c',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 6
  },
  helperText: {
    color: '#5f7569',
    lineHeight: 22,
    marginBottom: 14
  },
  input: {
    borderWidth: 1,
    borderColor: '#d7e5dc',
    borderRadius: 8,
    color: '#173b2c',
    backgroundColor: '#fbfdfb',
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginBottom: 12
  },
  primaryButton: {
    backgroundColor: '#2f8f68',
    borderRadius: 8,
    paddingVertical: 13,
    alignItems: 'center',
    marginBottom: 12
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: '800'
  },
  error: {
    color: '#b3261e',
    lineHeight: 20,
    marginBottom: 12
  },
  inlineLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  emptyBox: {
    backgroundColor: '#eef8f0',
    borderRadius: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: '#dcebe1'
  },
  emptyTitle: {
    color: '#173b2c',
    fontWeight: '800',
    marginBottom: 4
  },
  emptyText: {
    color: '#5f7569',
    lineHeight: 21
  },
  petPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10
  },
  petChip: {
    minWidth: '30%',
    backgroundColor: '#fbfdfb',
    borderWidth: 1,
    borderColor: '#d7e5dc',
    borderRadius: 8,
    padding: 12
  },
  petChipActive: {
    backgroundColor: '#2f8f68',
    borderColor: '#2f8f68'
  },
  petChipText: {
    color: '#173b2c',
    fontWeight: '800'
  },
  petChipMeta: {
    color: '#5f7569',
    marginTop: 3,
    textTransform: 'capitalize'
  },
  petChipTextActive: {
    color: '#ffffff'
  },
  videoFrame: {
    height: 220,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#173b2c',
    position: 'relative'
  },
  video: {
    width: '100%',
    height: '100%'
  },
  videoPlaceholder: {
    backgroundColor: '#eef8f0',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dcebe1',
    padding: 18,
    alignItems: 'center'
  },
  videoPlaceholderTitle: {
    color: '#173b2c',
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 6
  },
  videoPlaceholderText: {
    color: '#5f7569',
    lineHeight: 21,
    textAlign: 'center'
  },
  videoLoading: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.84)'
  },
  loadingText: {
    color: '#5f7569',
    marginTop: 10
  },
  colorRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14
  },
  colorChoice: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    borderColor: '#ffffff'
  },
  colorChoiceActive: {
    borderColor: '#173b2c'
  },
  canvas: {
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
    backgroundColor: '#fbfdfb',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d7e5dc',
    overflow: 'hidden',
    marginBottom: 14
  },
  canvasHint: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center'
  },
  canvasHintText: {
    color: '#8a9b91',
    fontWeight: '800'
  },
  clearButton: {
    borderWidth: 1,
    borderColor: '#2f8f68',
    borderRadius: 8,
    paddingVertical: 13,
    alignItems: 'center'
  },
  clearButtonText: {
    color: '#2f8f68',
    fontWeight: '800'
  },
  captionInput: {
    minHeight: 92,
    textAlignVertical: 'top'
  },
  captionCount: {
    color: '#5f7569',
    alignSelf: 'flex-end',
    fontWeight: '700'
  },
  previewCard: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 18,
    borderWidth: 1,
    borderColor: '#2f8f68',
    marginBottom: 16
  },
  draftHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14
  },
  draftAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#2f8f68',
    alignItems: 'center',
    justifyContent: 'center'
  },
  draftAvatarText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 18
  },
  draftPetPhoto: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#eef8f0'
  },
  draftPetName: {
    color: '#173b2c',
    fontWeight: '800',
    fontSize: 18
  },
  draftMeta: {
    color: '#5f7569',
    marginTop: 3,
    textTransform: 'capitalize'
  },
  draftCaption: {
    color: '#244536',
    fontSize: 16,
    lineHeight: 23,
    marginBottom: 14
  },
  draftStickerPreview: {
    backgroundColor: '#fbfdfb',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d7e5dc',
    padding: 12,
    marginBottom: 14
  },
  draftStickerTitle: {
    color: '#173b2c',
    fontWeight: '800',
    marginBottom: 8
  },
  draftStickerEmpty: {
    color: '#8a9b91',
    fontWeight: '700',
    paddingVertical: 28,
    textAlign: 'center'
  },
  draftSummary: {
    backgroundColor: '#eef8f0',
    borderRadius: 8,
    padding: 12,
    gap: 6,
    marginBottom: 14
  },
  draftSummaryText: {
    color: '#244536',
    fontWeight: '700'
  },
  publishError: {
    color: '#b3261e',
    lineHeight: 20,
    marginBottom: 12
  },
  publishButton: {
    backgroundColor: '#2f8f68',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center'
  },
  disabledButton: {
    opacity: 0.7
  },
  publishButtonText: {
    color: '#ffffff',
    fontWeight: '800'
  }
});
