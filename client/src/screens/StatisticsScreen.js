import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';

import ActivityMixChart from '../components/charts/ActivityMixChart';
import PostsPerMonthChart from '../components/charts/PostsPerMonthChart';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const defaultStats = {
  petsCount: 0,
  postsCount: 0,
  groupsCount: 0,
  totalLikesReceived: 0,
  postsPerMonth: [],
  mostActivePet: null,
  recentActivitySummary: [],
  recentPosts: []
};

const getErrorMessage = (error, fallback) =>
  error.response?.data?.message || fallback;

const formatDate = (date) =>
  new Date(date).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

const hasPositiveValue = (values) => values.some((value) => Number(value) > 0);

export default function StatisticsScreen() {
  const { user } = useAuth();
  const [stats, setStats] = useState(defaultStats);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');

  const fetchDashboard = useCallback(async ({ refreshing = false } = {}) => {
    try {
      setError('');
      if (refreshing) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      const { data } = await api.get('/stats/my-activity');
      setStats({ ...defaultStats, ...(data.stats || {}) });
    } catch (dashboardError) {
      setError(getErrorMessage(dashboardError, 'Could not load your activity dashboard.'));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const postsPerMonthChart = useMemo(
    () => (Array.isArray(stats.postsPerMonth) ? stats.postsPerMonth : []),
    [stats.postsPerMonth]
  );

  const activityMixChart = useMemo(
    () => [
      { label: 'Pets', value: stats.petsCount },
      { label: 'Posts', value: stats.postsCount },
      { label: 'Groups', value: stats.groupsCount },
      { label: 'Likes', value: stats.totalLikesReceived }
    ],
    [stats.groupsCount, stats.petsCount, stats.postsCount, stats.totalLikesReceived]
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={() => fetchDashboard({ refreshing: true })}
          tintColor="#2f8f68"
        />
      }
    >
      <View style={styles.header}>
        <Text style={styles.kicker}>My PetConnect activity</Text>
        <Text style={styles.title}>My Activity Dashboard</Text>
        <Text style={styles.subtitle}>
          A personal snapshot of your pets, posts, groups, likes, and recent social
          activity.
        </Text>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {isLoading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color="#2f8f68" />
          <Text style={styles.loadingText}>Loading your dashboard...</Text>
        </View>
      ) : (
        <>
          <View style={styles.welcomeCard}>
            <Text style={styles.welcomeTitle}>
              Welcome back{user?.username ? `, ${user.username}` : ''}
            </Text>
            <Text style={styles.welcomeText}>
              This dashboard only counts activity connected to your account.
            </Text>
          </View>

          <View style={styles.summaryGrid}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryValue}>{stats.petsCount}</Text>
              <Text style={styles.summaryLabel}>My Pets</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryValue}>{stats.postsCount}</Text>
              <Text style={styles.summaryLabel}>My Posts</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryValue}>{stats.groupsCount}</Text>
              <Text style={styles.summaryLabel}>My Groups</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryValue}>{stats.totalLikesReceived}</Text>
              <Text style={styles.summaryLabel}>Likes Received</Text>
            </View>
          </View>

          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>Posts Created Per Month</Text>
            {hasPositiveValue(postsPerMonthChart.map((item) => item?.count)) ? (
              <PostsPerMonthChart data={postsPerMonthChart} />
            ) : (
              <Text style={styles.emptyText}>
                No monthly post activity yet. Create your first post to start the chart.
              </Text>
            )}
          </View>

          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>My Activity Mix</Text>
            {hasPositiveValue(activityMixChart.map((item) => item.value)) ? (
              <ActivityMixChart data={activityMixChart} />
            ) : (
              <Text style={styles.emptyText}>
                Your pets, posts, groups, and likes chart will appear once you start
                using PetConnect.
              </Text>
            )}
          </View>

          <View style={styles.featureCard}>
            <Text style={styles.chartTitle}>Most Active Pet</Text>
            {stats.mostActivePet ? (
              <View style={styles.petHighlight}>
                <View style={styles.petBadge}>
                  <Text style={styles.petBadgeText}>
                    {stats.mostActivePet.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.petDetails}>
                  <Text style={styles.petName}>{stats.mostActivePet.name}</Text>
                  <Text style={styles.petMeta}>
                    Mentioned in {stats.mostActivePet.count} post
                    {stats.mostActivePet.count === 1 ? '' : 's'}
                  </Text>
                  <Text style={styles.petType}>{stats.mostActivePet.type}</Text>
                </View>
              </View>
            ) : (
              <Text style={styles.emptyText}>
                No active pet yet. Mention one of your pet names in a post to make it
                appear here.
              </Text>
            )}
          </View>

          <View style={styles.listCard}>
            <Text style={styles.chartTitle}>Recent Activity Summary</Text>
            {stats.recentActivitySummary.length ? (
              stats.recentActivitySummary.map((item) => (
                <View key={item} style={styles.summaryRow}>
                  <View style={styles.dot} />
                  <Text style={styles.summaryText}>{item}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.emptyText}>Your recent activity will appear here.</Text>
            )}
          </View>

          <View style={styles.listCard}>
            <Text style={styles.chartTitle}>Recent Posts</Text>
            {stats.recentPosts.length ? (
              stats.recentPosts.map((post) => (
                <View key={post._id} style={styles.postRow}>
                  <Text style={styles.postContent}>{post.content}</Text>
                  <Text style={styles.postMeta}>
                    {formatDate(post.createdAt)}
                    {post.group?.name ? ` in ${post.group.name}` : ''}
                  </Text>
                </View>
              ))
            ) : (
              <Text style={styles.emptyText}>No recent posts yet.</Text>
            )}
          </View>
        </>
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
  loadingBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48
  },
  loadingText: {
    color: '#5f7569',
    marginTop: 12
  },
  welcomeCard: {
    backgroundColor: '#eef8f0',
    borderRadius: 8,
    padding: 18,
    borderWidth: 1,
    borderColor: '#dcebe1',
    marginBottom: 16
  },
  welcomeTitle: {
    color: '#173b2c',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 6
  },
  welcomeText: {
    color: '#5f7569',
    lineHeight: 22
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16
  },
  summaryCard: {
    width: '48%',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#dcebe1'
  },
  summaryValue: {
    color: '#2f8f68',
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 4
  },
  summaryLabel: {
    color: '#5f7569',
    fontWeight: '700'
  },
  chartCard: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    paddingVertical: 18,
    borderWidth: 1,
    borderColor: '#dcebe1',
    marginBottom: 16,
    overflow: 'hidden'
  },
  chartTitle: {
    color: '#173b2c',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 12,
    paddingHorizontal: 18
  },
  emptyText: {
    color: '#5f7569',
    lineHeight: 22,
    paddingHorizontal: 18
  },
  featureCard: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    paddingVertical: 18,
    borderWidth: 1,
    borderColor: '#dcebe1',
    marginBottom: 16
  },
  petHighlight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 18
  },
  petBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2f8f68',
    alignItems: 'center',
    justifyContent: 'center'
  },
  petBadgeText: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '800'
  },
  petDetails: {
    flex: 1
  },
  petName: {
    color: '#173b2c',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 3
  },
  petMeta: {
    color: '#5f7569',
    lineHeight: 20
  },
  petType: {
    color: '#2f8f68',
    fontWeight: '800',
    marginTop: 5,
    textTransform: 'capitalize'
  },
  listCard: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    paddingVertical: 18,
    borderWidth: 1,
    borderColor: '#dcebe1',
    marginBottom: 16
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderTopWidth: 1,
    borderTopColor: '#edf4ef'
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2f8f68',
    marginTop: 7
  },
  summaryText: {
    flex: 1,
    color: '#244536',
    lineHeight: 22
  },
  postRow: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#edf4ef'
  },
  postContent: {
    color: '#244536',
    fontWeight: '700',
    lineHeight: 22,
    marginBottom: 5
  },
  postMeta: {
    color: '#5f7569',
    fontSize: 13
  }
});
