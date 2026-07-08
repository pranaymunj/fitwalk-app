import React from 'react';
import { StyleSheet, View, Text, ScrollView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useGame } from '../state/useGame';

interface LeaderboardEntry {
  uid: string;
  name: string;
  area: number;
  color: string;
  isSelf: boolean;
}

export default function LeaderboardScreen() {
  const insets = useSafeAreaInsets();
  const { user, leaderboard, fetchLeaderboard } = useGame();

  React.useEffect(() => {
    fetchLeaderboard();
  }, []);

  // Find user's rank
  const selfEntry = leaderboard.find((e) => e.isMe);
  const selfRank = selfEntry ? selfEntry.rank : '-';

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.contentContainer,
          { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 120 },
        ]}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Leaderboard</Text>
          <Text style={styles.subtitle}>Ranked by captured territory area</Text>
        </View>

        {/* Self Card (Overview HUD) */}
        {selfEntry && (
          <View style={styles.selfCard}>
            <View style={styles.selfCardLeft}>
              <View style={styles.rankBadge}>
                <Text style={styles.rankBadgeText}>{selfRank}</Text>
              </View>
              <View>
                <Text style={styles.selfCardName}>Your Ranking</Text>
                <Text style={styles.selfCardSub}>{selfEntry.displayName} (You)</Text>
              </View>
            </View>
            <Text style={styles.selfCardArea}>{Math.round(selfEntry.totalArea)} m²</Text>
          </View>
        )}

        {/* Leaderboard List */}
        <View style={styles.listSection}>
          {leaderboard.map((entry) => {
            const rank = entry.rank;
            
            let rankIcon = null;
            if (rank === 1) rankIcon = <Ionicons name="trophy" size={18} color="#ffd700" />;
            else if (rank === 2) rankIcon = <Ionicons name="trophy" size={18} color="#c0c0c0" />;
            else if (rank === 3) rankIcon = <Ionicons name="trophy" size={18} color="#cd7f32" />;

            return (
              <View
                key={entry.uid}
                style={[
                  styles.rankRow,
                  entry.isMe && styles.rankRowSelf,
                ]}
              >
                {/* Rank & Icon */}
                <View style={styles.rankIndexContainer}>
                  {rankIcon ? (
                    rankIcon
                  ) : (
                    <Text style={styles.rankIndexText}>{rank}</Text>
                  )}
                </View>

                {/* User Color Indicator */}
                <View style={[styles.colorIndicator, { backgroundColor: entry.color }]} />

                {/* User Name */}
                <Text
                  style={[
                    styles.rankName,
                    entry.isMe && styles.rankNameSelf,
                  ]}
                  numberOfLines={1}
                >
                  {entry.displayName}{entry.isMe ? ' (You)' : ''}
                </Text>

                {/* Captured Area */}
                <Text
                  style={[
                    styles.rankArea,
                    entry.isMe && styles.rankAreaSelf,
                  ]}
                >
                  {Math.round(entry.totalArea)} m²
                </Text>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 24,
  },
  header: {
    marginBottom: 24,
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
  selfCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#000000',
    borderRadius: 16,
    padding: 20,
    marginBottom: 32,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 4,
  },
  selfCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  rankBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankBadgeText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000000',
  },
  selfCardName: {
    fontSize: 12,
    color: '#afafaf',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  selfCardSub: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
  selfCardArea: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  listSection: {
    borderColor: '#efefef',
    borderWidth: 1,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#ffffff',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f3f3',
  },
  rankRowSelf: {
    backgroundColor: '#f3f3f3',
  },
  rankIndexContainer: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankIndexText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#5e5e5e',
  },
  colorIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginLeft: 12,
    marginRight: 16,
  },
  rankName: {
    flex: 1,
    fontSize: 15,
    color: '#4b4b4b',
    fontWeight: '500',
  },
  rankNameSelf: {
    color: '#000000',
    fontWeight: '700',
  },
  rankArea: {
    fontSize: 14,
    fontWeight: '600',
    color: '#5e5e5e',
  },
  rankAreaSelf: {
    color: '#000000',
    fontWeight: '700',
  },
});
