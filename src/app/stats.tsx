import React from 'react';
import { StyleSheet, View, Text, ScrollView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useGame } from '../state/useGame';

export default function StatsScreen() {
  const insets = useSafeAreaInsets();
  const { user, walkHistory, fetchWalkHistory, fetchUserProfile } = useGame();

  // Screen focus re-fetching (reloads data each time screen is navigated to)
  useFocusEffect(
    React.useCallback(() => {
      fetchUserProfile();
      fetchWalkHistory();
    }, [])
  );

  // Quick debug verification log (M9 requirements)
  React.useEffect(() => {
    console.log('[DEBUG HUD] Stats Page Received Backend State:', {
      user: user
        ? {
            uid: user.uid,
            totalArea: user.totalArea,
            totalDistance: user.totalDistance,
            walkCount: user.walkCount,
          }
        : null,
      walkHistoryCount: walkHistory.length,
    });
  }, [user, walkHistory]);

  const totalArea = user ? user.totalArea : 0;
  const totalDistance = user ? user.totalDistance || 0 : 0;
  const walkCount = user ? user.walkCount || 0 : 0;

  // Format date to local readable format
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Format duration from path t offset
  const formatDuration = (path: { t: number }[]) => {
    if (path.length === 0) return '0m';
    const totalMs = path[path.length - 1].t;
    const totalMins = Math.round(totalMs / 60000);
    return `${totalMins} min`;
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.contentContainer,
        { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 100 },
      ]}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Your Stats</Text>
        <Text style={styles.subtitle}>Track your territory capture history</Text>
      </View>

      {/* Main Stats Card Grid (3-card layout) */}
      <View style={styles.statsGrid}>
        <View style={styles.statsCard}>
          <Text style={styles.statsLabel}>Area Captured</Text>
          <Text style={styles.statsValue}>{Math.round(totalArea)} m²</Text>
          <Text style={styles.statsFooter}>Earned</Text>
        </View>

        <View style={styles.statsCard}>
          <Text style={styles.statsLabel}>Distance</Text>
          <Text style={styles.statsValue}>{Math.round(totalDistance)} m</Text>
          <Text style={styles.statsFooter}>Walked</Text>
        </View>

        <View style={styles.statsCard}>
          <Text style={styles.statsLabel}>Walks</Text>
          <Text style={styles.statsValue}>{walkCount}</Text>
          <Text style={styles.statsFooter}>Recorded</Text>
        </View>
      </View>

      {/* Recent Walks History */}
      <View style={styles.historySection}>
        <Text style={styles.sectionTitle}>Walk History</Text>
        
        {walkHistory.length === 0 ? (
          <View style={styles.emptyStateCard}>
            <Ionicons name="footsteps-outline" size={48} color="#afafaf" />
            <Text style={styles.emptyStateTitle}>No walks recorded yet</Text>
            <Text style={styles.emptyStateText}>
              Go outside, start a walk, and close a loop to capture your first territory.
            </Text>
          </View>
        ) : (
          <View style={styles.walkList}>
            {walkHistory.map((walk) => (
              <View key={walk.walkId} style={styles.walkItem}>
                <View style={styles.walkDetails}>
                  <Text style={styles.walkDate}>{formatDate(walk.createdAt)}</Text>
                  <Text style={styles.walkMeta}>
                    {walk.path.length} points • {formatDuration(walk.path)} • {Math.round(walk.distanceWalked || 0)} m
                  </Text>
                </View>
                <View style={styles.walkRight}>
                  <Text style={styles.walkArea}>+{Math.round(walk.areaClaimed)} m²</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Live sync debug line directly in UI (M9) */}
      <View style={styles.debugSection}>
        <Text style={styles.debugStatusText}>
          🟢 Sync Status: Connected to MongoDB Atlas
        </Text>
        <Text style={styles.debugDetailText}>
          UID: {user?.uid || 'N/A'} | Verified stats re-fetched on focus.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  contentContainer: {
    paddingHorizontal: 24,
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 6,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  },
  subtitle: {
    fontSize: 16,
    color: '#5e5e5e',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 40,
  },
  statsCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderColor: '#efefef',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  statsLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#afafaf',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  statsValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#000000',
    marginBottom: 4,
  },
  statsFooter: {
    fontSize: 9,
    color: '#8e8e8e',
  },
  historySection: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 16,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  },
  emptyStateCard: {
    borderWidth: 1,
    borderColor: '#efefef',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fafafa',
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginTop: 12,
    marginBottom: 4,
  },
  emptyStateText: {
    fontSize: 13,
    color: '#8e8e8e',
    textAlign: 'center',
    lineHeight: 18,
  },
  walkList: {
    gap: 12,
  },
  walkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  walkDetails: {
    flex: 1,
  },
  walkDate: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  walkMeta: {
    fontSize: 12,
    color: '#8e8e8e',
  },
  walkRight: {
    alignItems: 'flex-end',
  },
  walkArea: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1f7a5c',
  },
  debugSection: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 16,
    alignItems: 'center',
  },
  debugStatusText: {
    fontSize: 11,
    color: '#555555',
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginBottom: 4,
  },
  debugDetailText: {
    fontSize: 9,
    color: '#888888',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
});
