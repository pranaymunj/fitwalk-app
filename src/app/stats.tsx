import React from 'react';
import { StyleSheet, View, Text, ScrollView, Pressable, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useGame } from '../state/useGame';

export default function StatsScreen() {
  const insets = useSafeAreaInsets();
  const { user, walkHistory } = useGame();

  const totalArea = user ? user.totalArea : 0;
  const totalWalks = walkHistory.length;

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
        { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 60 },
      ]}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Your Stats</Text>
        <Text style={styles.subtitle}>Track your territory capture history</Text>
      </View>

      {/* Main Stats Card Grid */}
      <View style={styles.statsGrid}>
        <View style={styles.statsCard}>
          <Text style={styles.statsLabel}>Total Captured Area</Text>
          <Text style={styles.statsValue}>{Math.round(totalArea)} m²</Text>
          <Text style={styles.statsFooter}>Enclosed and claimed tiles</Text>
        </View>

        <View style={styles.statsCard}>
          <Text style={styles.statsLabel}>Walks Recorded</Text>
          <Text style={styles.statsValue}>{totalWalks}</Text>
          <Text style={styles.statsFooter}>Closed loops completed</Text>
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
                    {walk.path.length} points • {formatDuration(walk.path)}
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
    gap: 16,
    marginBottom: 40,
  },
  statsCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderColor: '#efefef',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  statsLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#5e5e5e',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  statsValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 4,
  },
  statsFooter: {
    fontSize: 11,
    color: '#afafaf',
  },
  historySection: {
    gap: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 4,
  },
  emptyStateCard: {
    backgroundColor: '#efefef',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
  },
  emptyStateText: {
    fontSize: 14,
    color: '#5e5e5e',
    textAlign: 'center',
    lineHeight: 20,
  },
  walkList: {
    gap: 12,
  },
  walkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: '#ffffff',
    borderColor: '#efefef',
    borderWidth: 1,
    borderRadius: 12,
  },
  walkDetails: {
    gap: 4,
  },
  walkDate: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000000',
  },
  walkMeta: {
    fontSize: 12,
    color: '#5e5e5e',
  },
  walkRight: {
    alignItems: 'flex-end',
  },
  walkArea: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
  },
});
