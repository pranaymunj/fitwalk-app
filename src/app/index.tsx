import React, { useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  Alert,
  ActivityIndicator,
  Linking,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import MapView from 'react-native-maps';

import { AppMapView } from '../components/MapView';
import { useGame } from '../state/useGame';
import { watchLocation } from '../game/tracking';
import { CLOSE_METERS, MIN_POINTS, MIN_LOOP_AREA_SQM, calculatePathLength, hasMovedAwayFromStart } from '../game/loop';
import { distance } from '@turf/turf';
import { toTurfPosition } from '../game/coords';

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);

  // Zustand Store values
  const {
    user,
    isTracking,
    path,
    tiles,
    onboardUser,
    startWalk,
    addTrackingPoint,
    stopWalk,
    resetGame,
    fetchTilesInViewport,
    walkHistory,
  } = useGame();

  // Local state
  const [permissionStatus, setPermissionStatus] = useState<'checking' | 'granted' | 'denied'>('checking');
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [simulateWalk, setSimulateWalk] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [loopDetails, setLoopDetails] = useState({ closed: false, area: 0 });
  const [rawPointCount, setRawPointCount] = useState(0);
  const [lastAccuracy, setLastAccuracy] = useState<number | null>(null);
  const [lastRejected, setLastRejected] = useState(false);
  const [ghostLocation, setGhostLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  // Update ghost location based on active elapsed time (M8 - Ghost You)
  const latestWalk = walkHistory[0];
  useEffect(() => {
    if (!isTracking || !latestWalk) {
      setGhostLocation(null);
      return;
    }

    const elapsedMs = elapsedTime * 1000;
    const walkPath = latestWalk.path;

    if (walkPath.length === 0) {
      setGhostLocation(null);
      return;
    }

    if (elapsedMs <= walkPath[0].t) {
      setGhostLocation({ latitude: walkPath[0].lat, longitude: walkPath[0].lng });
      return;
    }

    if (elapsedMs >= walkPath[walkPath.length - 1].t) {
      setGhostLocation({
        latitude: walkPath[walkPath.length - 1].lat,
        longitude: walkPath[walkPath.length - 1].lng,
      });
      return;
    }

    // Interpolate between path points
    for (let i = 0; i < walkPath.length - 1; i++) {
      const p1 = walkPath[i];
      const p2 = walkPath[i + 1];
      if (elapsedMs >= p1.t && elapsedMs <= p2.t) {
        const duration = p2.t - p1.t;
        const ratio = duration === 0 ? 0 : (elapsedMs - p1.t) / duration;
        setGhostLocation({
          latitude: p1.lat + ratio * (p2.lat - p1.lat),
          longitude: p1.lng + ratio * (p2.lng - p1.lng),
        });
        break;
      }
    }
  }, [isTracking, elapsedTime, latestWalk]);

  // Watch for elapsed time when tracking
  useEffect(() => {
    let timerId: any;
    if (isTracking) {
      setElapsedTime(0);
      timerId = setInterval(() => {
        setElapsedTime((prev) => prev + 1);
      }, 1000);
    } else {
      setElapsedTime(0);
    }
    return () => clearInterval(timerId);
  }, [isTracking]);

  // Refs to prevent location subscription teardown on state changes
  const isTrackingRef = useRef(isTracking);
  const userRef = useRef(user);
  const addTrackingPointRef = useRef(addTrackingPoint);
  const onboardUserRef = useRef(onboardUser);

  useEffect(() => {
    isTrackingRef.current = isTracking;
    userRef.current = user;
    addTrackingPointRef.current = addTrackingPoint;
    onboardUserRef.current = onboardUser;
  });

  // Handle GPS location watch subscription
  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    const startWatching = () => {
      setPermissionStatus('checking');
      unsubscribe = watchLocation(
        (coords, accuracy) => {
          setPermissionStatus('granted');
          setCurrentLocation(coords);
          setLastAccuracy(accuracy !== undefined ? accuracy : null);

          // Onboard user with the first GPS fix
          if (!userRef.current) {
            onboardUserRef.current(coords);
          }

          // If tracking, add points and check loop status
          if (isTrackingRef.current) {
            setRawPointCount((prev) => prev + 1);
            const { closed, area, added } = addTrackingPointRef.current(coords, accuracy);
            setLoopDetails({ closed, area });
            setLastRejected(!added);
          }
        },
        (error) => {
          console.error('Location watch error:', error);
          setPermissionStatus('denied');
        },
        { simulate: simulateWalk }
      );
    };

    startWatching();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [simulateWalk]);

  // Recenter map on user location
  const handleRecenter = () => {
    if (currentLocation && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: currentLocation.lat,
        longitude: currentLocation.lng,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      });
    }
  };

  // Handle Map Viewport changes to load tiles from backend (Option A)
  const handleRegionChangeComplete = (region: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  }) => {
    const minLat = region.latitude - region.latitudeDelta / 2;
    const maxLat = region.latitude + region.latitudeDelta / 2;
    const minLng = region.longitude - region.longitudeDelta / 2;
    const maxLng = region.longitude + region.longitudeDelta / 2;

    fetchTilesInViewport(minLat, minLng, maxLat, maxLng);
  };

  // Auto-center map on first GPS fix
  useEffect(() => {
    if (currentLocation && !isTracking) {
      handleRecenter();
    }
  }, [currentLocation === null]);

  // Start Walk Trigger
  const handleStartWalk = () => {
    setLoopDetails({ closed: false, area: 0 });
    setRawPointCount(0);
    setLastAccuracy(null);
    setLastRejected(false);
    startWalk();
  };

  // Stop Walk Trigger
  const handleStopWalk = async () => {
    const { closed, area, claimedCount } = await stopWalk();
    
    if (closed) {
      if (area >= MIN_LOOP_AREA_SQM) {
        Alert.alert(
          '🔲 Loop Closed!',
          `Successfully captured territory of ${Math.round(area)} m² and claimed ${claimedCount} grid tiles.`,
          [{ text: 'Great!' }]
        );
      } else {
        Alert.alert(
          '⚠️ Loop Too Small',
          `Captured area was ${Math.round(area)} m². Minimum required is ${MIN_LOOP_AREA_SQM} m². Nothing captured.`,
          [{ text: 'OK' }]
        );
      }
    } else {
      Alert.alert(
        'Walk Finished',
        `No closed loop detected. (Needs to be within ${CLOSE_METERS}m of start, with at least ${MIN_POINTS} GPS points).`,
        [{ text: 'OK' }]
      );
    }
    
    setLoopDetails({ closed: false, area: 0 });
  };

  // Convert tiles record from store to renderable array
  const renderableTiles = Object.entries(tiles).map(([cellId, tile]) => ({
    cellId,
    color: tile.color,
    coords: tile.coords,
  }));

  // Format Elapsed Time (MM:SS)
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remainingSecs.toString().padStart(2, '0')}`;
  };

  // Loading state
  if (permissionStatus === 'checking') {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#000000" />
        <Text style={styles.loadingText}>Initializing GPS locator...</Text>
      </View>
    );
  }

  // Permission Denied UI
  if (permissionStatus === 'denied') {
    return (
      <View style={[styles.deniedContainer, { paddingTop: insets.top }]}>
        <Ionicons name="location-outline" size={64} color="#000000" style={styles.deniedIcon} />
        <Text style={styles.deniedTitle}>Location Access Required</Text>
        <Text style={styles.deniedText}>
          FitWalk maps and records walking loops to capture territory. To play, please grant location permissions.
        </Text>
        <Pressable
          style={styles.primaryButton}
          onPress={() => {
            if (Platform.OS === 'ios' || Platform.OS === 'android') {
              Linking.openSettings();
            } else {
              Alert.alert('Settings', 'Please enable location in your browser settings.');
            }
          }}
        >
          <Text style={styles.primaryButtonText}>Open Settings</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Map Element */}
      <AppMapView
        ref={mapRef}
        userLocation={currentLocation}
        path={path}
        tiles={renderableTiles}
        onRegionChangeComplete={handleRegionChangeComplete}
        ghostLocation={ghostLocation}
        initialRegion={
          currentLocation
            ? {
                latitude: currentLocation.lat,
                longitude: currentLocation.lng,
                latitudeDelta: 0.005,
                longitudeDelta: 0.005,
              }
            : undefined
        }
      />

      {/* Weak GPS / Waiting for signal Banner */}
      {!currentLocation && (
        <View style={[styles.banner, { top: insets.top + 10, backgroundColor: '#ffe3e3', borderColor: '#ffb3b3' }]}>
          <Ionicons name="warning-outline" size={16} color="#d93838" />
          <Text style={[styles.bannerText, { color: '#d93838' }]}>Waiting for GPS signal...</Text>
        </View>
      )}

      {/* Weak GPS / Simulating Alert Banner */}
      {simulateWalk && (
        <View style={[styles.banner, { top: insets.top + 10 }]}>
          <Ionicons name="bug-outline" size={16} color="#000000" />
          <Text style={styles.bannerText}>SIMULATE_WALK Active</Text>
        </View>
      )}

      {/* Debug Panel HUD */}
      {isTracking && (
        <View style={[styles.debugPanel, { top: insets.top + 70 }]}>
          <Text style={styles.debugTitle}>DEBUG HUD</Text>
          <Text style={styles.debugText}>Raw Points: {rawPointCount}</Text>
          <Text style={styles.debugText}>Accepted Points: {path.length}</Text>
          <Text style={styles.debugText}>Last Accuracy: {lastAccuracy !== null ? `${Math.round(lastAccuracy)} m` : 'N/A'}</Text>
          <Text style={styles.debugText}>Last Point: {lastRejected ? 'REJECTED 🔴' : 'ACCEPTED 🟢'}</Text>
          <Text style={styles.debugText}>Path Len: {Math.round(calculatePathLength(path))} m</Text>
          <Text style={styles.debugText}>
            From Start:{' '}
            {path.length > 0 && currentLocation
              ? Math.round(distance(toTurfPosition(path[0]), toTurfPosition(currentLocation), { units: 'meters' }))
              : 0}{' '}
            m
          </Text>
          <Text style={styles.debugText}>Moved Away: {hasMovedAwayFromStart(path) ? 'YES' : 'NO'}</Text>
          <Text style={styles.debugText}>Closed: {loopDetails.closed ? 'YES' : 'NO'}</Text>
          <Text style={styles.debugText}>Area: {Math.round(loopDetails.area)} m²</Text>
        </View>
      )}

      {/* Floating Action Buttons */}
      <View style={[styles.floatingControls, { top: insets.top + 10 }]}>
        {/* Recenter Button */}
        <Pressable style={styles.circleButton} onPress={handleRecenter}>
          <Ionicons name="navigate-outline" size={24} color="#000000" />
        </Pressable>

        {/* Simulate Loop Toggle Button */}
        <Pressable
          style={[styles.circleButton, simulateWalk && styles.circleButtonActive]}
          onPress={() => {
            if (isTracking) {
              Alert.alert('Cannot toggle simulation while walk is in progress.');
              return;
            }
            setSimulateWalk(!simulateWalk);
          }}
        >
          <Ionicons
            name={simulateWalk ? 'walk' : 'walk-outline'}
            size={24}
            color={simulateWalk ? '#ffffff' : '#000000'}
          />
        </Pressable>

        {/* Reset Store (For Testing) */}
        <Pressable
          style={styles.circleButton}
          onPress={() => {
            Alert.alert('Reset Game', 'Clear all claimed tiles, user account, and stats?', [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Reset',
                style: 'destructive',
                onPress: () => {
                  resetGame();
                  setCurrentLocation(null);
                },
              },
            ]);
          }}
        >
          <Ionicons name="trash-outline" size={22} color="#cc0000" />
        </Pressable>
      </View>

      {/* Main Bottom HUD Sheet (Minimalist Card per DESIGN.md) */}
      <View style={[styles.hudSheet, { paddingBottom: insets.bottom + 16 }]}>
        {isTracking ? (
          <View style={styles.trackingHud}>
            {/* Live Stats */}
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>TIME</Text>
                <Text style={styles.statValue}>{formatTime(elapsedTime)}</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>DISTANCE</Text>
                <Text style={styles.statValue}>{Math.round(calculatePathLength(path))} m</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>POINTS</Text>
                <Text style={styles.statValue}>{path.length}</Text>
              </View>
            </View>

            {/* Loop Status Indicator */}
            <View
              style={[
                styles.loopIndicator,
                loopDetails.closed ? styles.loopClosedBg : styles.loopOpenBg,
              ]}
            >
              <Ionicons
                name={loopDetails.closed ? 'checkmark-circle-outline' : 'ellipse-outline'}
                size={18}
                color={loopDetails.closed ? '#1f7a5c' : '#4b4b4b'}
              />
              <Text
                style={[
                  styles.loopIndicatorText,
                  loopDetails.closed ? styles.loopClosedText : styles.loopOpenText,
                ]}
              >
                {loopDetails.closed
                  ? `Loop Closed (${Math.round(loopDetails.area)} m²)`
                  : `Loop Open (Meters to start: ${
                      path.length > 0 && currentLocation
                        ? Math.round(
                            distance(toTurfPosition(path[0]), toTurfPosition(currentLocation), {
                              units: 'meters',
                            })
                          )
                        : 0
                    }m)`}
              </Text>
            </View>

            {/* Stop CTA */}
            <Pressable style={styles.primaryButton} onPress={handleStopWalk}>
              <Text style={styles.primaryButtonText}>Stop Walk</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.onboardHud}>
            {user ? (
              <View style={styles.userInfoRow}>
                <View style={[styles.userBadge, { backgroundColor: user.color }]}>
                  <Text style={styles.userBadgeText}>Me</Text>
                </View>
                <View>
                  <Text style={styles.userNameText}>{user.displayName}</Text>
                  <Text style={styles.userStatsText}>
                    Territory Area: {Math.round(user.totalArea)} m²
                  </Text>
                </View>
              </View>
            ) : (
              <Text style={styles.welcomeText}>Searching GPS position...</Text>
            )}

            {/* Start CTA */}
            <Pressable style={styles.primaryButton} onPress={handleStartWalk}>
              <Text style={styles.primaryButtonText}>Start Walk</Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: '#4b4b4b',
    fontWeight: '500',
  },
  deniedContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 32,
    gap: 16,
  },
  deniedIcon: {
    marginBottom: 8,
  },
  deniedTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#000000',
  },
  deniedText: {
    fontSize: 16,
    color: '#4b4b4b',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 8,
  },
  primaryButton: {
    backgroundColor: '#000000',
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 200,
    alignSelf: 'stretch',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  banner: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#efefef',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderColor: '#e2e2e2',
    borderWidth: 1,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  bannerText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#000000',
  },
  floatingControls: {
    position: 'absolute',
    right: 16,
    gap: 12,
  },
  circleButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  circleButtonActive: {
    backgroundColor: '#000000',
  },
  hudSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingHorizontal: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 10,
  },
  onboardHud: {
    gap: 16,
  },
  welcomeText: {
    fontSize: 15,
    color: '#4b4b4b',
    textAlign: 'center',
  },
  userInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 4,
  },
  userBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userBadgeText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  userNameText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
  },
  userStatsText: {
    fontSize: 13,
    color: '#5e5e5e',
  },
  trackingHud: {
    gap: 16,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderColor: '#efefef',
    borderBottomWidth: 1,
    paddingBottom: 16,
  },
  statBox: {
    alignItems: 'center',
    flex: 1,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#afafaf',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000000',
  },
  loopIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  loopOpenBg: {
    backgroundColor: '#f3f3f3',
    borderColor: '#e2e2e2',
  },
  loopOpenText: {
    color: '#4b4b4b',
  },
  loopClosedBg: {
    backgroundColor: '#e6f5f0',
    borderColor: '#cce6dd',
  },
  loopClosedText: {
    color: '#1f7a5c',
    fontWeight: '600',
  },
  loopIndicatorText: {
    fontSize: 13,
  },
  debugPanel: {
    position: 'absolute',
    left: 16,
    backgroundColor: 'rgba(0,0,0,0.85)',
    padding: 12,
    borderRadius: 8,
    width: 170,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 5,
    zIndex: 100,
  },
  debugTitle: {
    color: '#afafaf',
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 6,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  debugText: {
    color: '#ffffff',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    lineHeight: 16,
  },
});
