import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { distance } from '@turf/turf';
import { TimedPoint, Coordinate, toTurfPosition } from '../game/coords';
import { isPlausibleStep } from '../game/anticheat';
import { isLoopClosed, loopAreaSqM, calculatePathLength } from '../game/loop';
import { fetchOnboardingData } from '../game/tiles';

export interface User {
  uid: string;
  displayName: string;
  color: string; // Hex color code
  baseCell: string; // H3 index of home base
  protectedCells: string[]; // List of H3 cell IDs that are protected
  totalArea: number; // Sq meters
  totalDistance?: number; // meters
  walkCount?: number;
  createdAt: number;
}

export interface Tile {
  owner: string; // uid or bot ID
  claimedAt: number;
  isBase: boolean;
  color: string; // cached owner color for rendering
  coords: { latitude: number; longitude: number }[]; // boundary vertices cached in store
}

export interface Walk {
  walkId: string;
  uid: string;
  path: TimedPoint[];
  areaClaimed: number;
  distanceWalked?: number; // meters
  createdAt: number;
}

export interface LeaderboardEntry {
  rank: number;
  displayName: string;
  totalArea: number;
  color: string;
  uid: string;
  isMe?: boolean;
}

interface GameState {
  // Authentication & Onboarding
  user: User | null;
  isOnboarding: boolean;
  
  // Tracking Walk State
  isTracking: boolean;
  path: TimedPoint[];
  trackingStartTime: number | null;
  lastCapturedArea: number;
  
  // Map Data
  tiles: Record<string, Tile>; // key is H3 index
  walkHistory: Walk[];
  leaderboard: LeaderboardEntry[];
  
  // Actions
  onboardUser: (coords: Coordinate) => Promise<void>;
  startWalk: () => void;
  addTrackingPoint: (coords: Coordinate) => { closed: boolean; area: number };
  stopWalk: () => Promise<{ closed: boolean; area: number; claimedCount: number }>;
  claimTiles: (tilesToClaim: { cellId: string; coords: { latitude: number; longitude: number }[] }[], ownerId: string, color: string) => void;
  resetGame: () => void;
  
  // Backend Sync Actions
  syncUserWithBackend: () => Promise<void>;
  fetchTilesInViewport: (minLat: number, minLng: number, maxLat: number, maxLng: number) => Promise<void>;
  fetchUserProfile: () => Promise<void>;
  fetchWalkHistory: () => Promise<void>;
  fetchLeaderboard: () => Promise<void>;
}

// Standard LAN backend API URL fallback
const DEFAULT_BACKEND_URL = 'http://192.168.0.103:3000';

function getBackendUrl(): string {
  return process.env.EXPO_PUBLIC_BACKEND_URL || DEFAULT_BACKEND_URL;
}

// Fixed color palette for new players
const PLAYER_COLORS = [
  '#00b4d8', // Teal
  '#7209b7', // Violet
  '#f72585', // Neon Pink
  '#ffb703', // Vivid Yellow/Orange
  '#38b000', // Lime Green
  '#4361ee', // Electric Blue
];

export const useGame = create<GameState>()(
  persist(
    (set, get) => ({
      user: null,
      isOnboarding: false,
      isTracking: false,
      path: [],
      trackingStartTime: null,
      lastCapturedArea: 0,
      tiles: {},
      walkHistory: [],
      leaderboard: [],

      onboardUser: async (coords: Coordinate) => {
        if (get().user || get().isOnboarding) return;

        set({ isOnboarding: true });

        // Fetch onboarding H3 indices from backend (Option A)
        const onboardingResult = await fetchOnboardingData(coords);

        if (!onboardingResult) {
          set({ isOnboarding: false });
          return;
        }

        const { baseCell, baseCoords, protectedCells } = onboardingResult;
        const uid = 'user_' + Math.random().toString(36).substring(2, 11);
        const color = PLAYER_COLORS[Math.floor(Math.random() * PLAYER_COLORS.length)];

        const newUser: User = {
          uid,
          displayName: `Player_${uid.slice(-4)}`,
          color,
          baseCell,
          protectedCells,
          totalArea: 0,
          createdAt: Date.now(),
        };

        set({
          user: newUser,
          isOnboarding: false,
        });

        // Sync with backend immediately
        await get().syncUserWithBackend();
      },

      startWalk: () => {
        set({
          isTracking: true,
          path: [],
          trackingStartTime: Date.now(),
          lastCapturedArea: 0,
        });
      },

      addTrackingPoint: (coords: Coordinate) => {
        const { isTracking, path, trackingStartTime } = get();
        if (!isTracking || !trackingStartTime) return { closed: false, area: 0 };

        const newPoint: TimedPoint = {
          lat: coords.lat,
          lng: coords.lng,
          t: Date.now() - trackingStartTime,
        };

        const newPath = [...path];

        if (newPath.length > 0) {
          const lastPoint = newPath[newPath.length - 1];
          
          // 1. GPS Jitter: discard if < 5m from previous point
          const dist = distance(toTurfPosition(lastPoint), toTurfPosition(newPoint), { units: 'meters' });
          if (dist < 5) {
            const closed = isLoopClosed(newPath);
            const area = closed ? loopAreaSqM(newPath) : 0;
            return { closed, area };
          }

          // 2. Anti-cheat check: discard if speed is implausible (> 3.5 m/s)
          if (!isPlausibleStep(lastPoint, newPoint)) {
            const closed = isLoopClosed(newPath);
            const area = closed ? loopAreaSqM(newPath) : 0;
            return { closed, area };
          }
        }

        newPath.push(newPoint);
        set({ path: newPath });

        const closed = isLoopClosed(newPath);
        const area = closed ? loopAreaSqM(newPath) : 0;

        return { closed, area };
      },

      stopWalk: async () => {
        const { isTracking, path, user } = get();
        if (!isTracking || !user) return { closed: false, area: 0, claimedCount: 0 };

        const closed = isLoopClosed(path);
        const area = closed ? loopAreaSqM(path) : 0;
        let claimedCount = 0;

        if (closed && area >= 300) { // MIN_LOOP_AREA_SQM = 300
          try {
            // Claim loop on the backend database
            const response = await fetch(`${getBackendUrl()}/api/tiles/claim-loop`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                path,
                uid: user.uid,
                color: user.color,
                area,
              }),
            });

            if (response.ok) {
              const data = await response.json();
              const claimedTilesList = data.tiles || [];
              
              get().claimTiles(claimedTilesList, user.uid, user.color);
              claimedCount = claimedTilesList.length;
            }
          } catch (err) {
            console.error('Failed to claim loop on backend:', err);
          }

          // Add walk to history locally
          const distanceWalked = calculatePathLength(path);
          const newWalk: Walk = {
            walkId: 'walk_' + Math.random().toString(36).substring(2, 11),
            uid: user.uid,
            path,
            areaClaimed: area,
            distanceWalked,
            createdAt: Date.now(),
          };

          set(state => ({
            walkHistory: [newWalk, ...state.walkHistory],
            user: state.user ? {
              ...state.user,
              totalArea: state.user.totalArea + area,
              totalDistance: (state.user.totalDistance || 0) + distanceWalked,
              walkCount: (state.user.walkCount || 0) + 1,
            } : null,
            lastCapturedArea: area,
          }));

          // Sync user stats & leaderboard
          await get().syncUserWithBackend();
          await get().fetchLeaderboard();
        }

        set({
          isTracking: false,
          path: [],
          trackingStartTime: null,
        });

        return { closed, area, claimedCount };
      },

      claimTiles: (tilesToClaim, ownerId, color) => {
        set(state => {
          const updatedTiles = { ...state.tiles };
          for (const tileData of tilesToClaim) {
            const { cellId, coords } = tileData;
            updatedTiles[cellId] = {
              owner: ownerId,
              claimedAt: Date.now(),
              isBase: false,
              color,
              coords,
            };
          }
          return { tiles: updatedTiles };
        });
      },

      resetGame: () => {
        set({
          user: null,
          isOnboarding: false,
          isTracking: false,
          path: [],
          trackingStartTime: null,
          lastCapturedArea: 0,
          tiles: {},
          walkHistory: [],
          leaderboard: [],
        });
      },

      syncUserWithBackend: async () => {
        const { user } = get();
        if (!user) return;

        try {
          await fetch(`${getBackendUrl()}/api/users/sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(user),
          });
        } catch (err) {
          console.error('Failed to sync user profile with backend:', err);
        }
      },

      fetchTilesInViewport: async (minLat, minLng, maxLat, maxLng) => {
        try {
          const response = await fetch(`${getBackendUrl()}/api/tiles/query-viewport`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ minLat, minLng, maxLat, maxLng }),
          });

          if (response.ok) {
            const data = await response.json();
            const returnedTiles = data.tiles || {};
            
            // Merge into local tiles state (Option A viewport querying)
            set(state => ({
              tiles: {
                ...state.tiles,
                ...returnedTiles,
              },
            }));
          }
        } catch (err) {
          console.error('Failed to fetch viewport tiles:', err);
        }
      },

      fetchUserProfile: async () => {
        const { user } = get();
        if (!user) return;

        try {
          const response = await fetch(`${getBackendUrl()}/api/users/${user.uid}`);
          if (response.ok) {
            const data = await response.json();
            if (data.user) {
              set({ user: data.user });
            }
          }
        } catch (err) {
          console.error('Failed to fetch user profile:', err);
        }
      },

      fetchWalkHistory: async () => {
        const { user } = get();
        if (!user) return;

        try {
          const response = await fetch(`${getBackendUrl()}/api/users/${user.uid}/walks`);
          if (response.ok) {
            const data = await response.json();
            set({ walkHistory: data.walks || [] });
          }
        } catch (err) {
          console.error('Failed to fetch walk history:', err);
        }
      },

      fetchLeaderboard: async () => {
        try {
          const response = await fetch(`${getBackendUrl()}/api/leaderboard`);
          if (response.ok) {
            const data = await response.json();
            const entries = data.leaderboard || [];
            
            // Mark which entry is current user client side
            const currentUser = get().user;
            const processed = entries.map((e: any) => ({
              ...e,
              isMe: currentUser ? e.uid === currentUser.uid : false,
            }));

            set({ leaderboard: processed });
          }
        } catch (err) {
          console.error('Failed to fetch leaderboard:', err);
        }
      },
    }),
    {
      name: 'fitwalk-game-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        user: state.user,
        walkHistory: state.walkHistory,
      }),
    }
  )
);
