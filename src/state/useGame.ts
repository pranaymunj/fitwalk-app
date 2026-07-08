import { create } from 'zustand';
import { TimedPoint, Coordinate } from '../game/coords';
import { isPlausibleStep } from '../game/anticheat';
import { isLoopClosed, loopAreaSqM } from '../game/loop';
import { fetchOnboardingData, tilesInsideLoop } from '../game/tiles';

export interface User {
  uid: string;
  displayName: string;
  color: string; // Hex color code
  baseCell: string; // H3 index of home base
  protectedCells: string[]; // List of H3 cell IDs that are protected
  totalArea: number; // Sq meters
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
  createdAt: number;
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
  
  // Actions
  onboardUser: (coords: Coordinate) => Promise<void>;
  startWalk: () => void;
  addTrackingPoint: (coords: Coordinate) => { closed: boolean; area: number };
  stopWalk: () => Promise<{ closed: boolean; area: number; claimedCount: number }>;
  claimTiles: (tilesToClaim: { cellId: string; coords: { latitude: number; longitude: number }[] }[], ownerId: string, color: string) => void;
  resetGame: () => void;
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

export const useGame = create<GameState>((set, get) => ({
  user: null,
  isOnboarding: false,
  isTracking: false,
  path: [],
  trackingStartTime: null,
  lastCapturedArea: 0,
  tiles: {},
  walkHistory: [],

  onboardUser: async (coords: Coordinate) => {
    // If user already exists or is in the middle of onboarding, skip
    if (get().user || get().isOnboarding) return;

    set({ isOnboarding: true });

    // Fetch H3 base cell and protected cells from backend (Option A)
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

    // Auto-claim the base cell on onboarding
    const updatedTiles = { ...get().tiles };
    if (baseCell) {
      updatedTiles[baseCell] = {
        owner: uid,
        claimedAt: Date.now(),
        isBase: true,
        color,
        coords: baseCoords,
      };
    }

    set({
      user: newUser,
      tiles: updatedTiles,
      isOnboarding: false,
    });
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
      // Anti-cheat verification
      if (!isPlausibleStep(lastPoint, newPoint)) {
        // Discard fast GPS jumps
        return { closed: false, area: 0 };
      }
    }

    newPath.push(newPoint);
    set({ path: newPath });

    // Check if loop has closed
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
      // Calculate H3 cells inside the loop via backend fetch (Option A)
      const claimedTilesList = await tilesInsideLoop(path);
      
      // Claim them in the store
      get().claimTiles(claimedTilesList, user.uid, user.color);
      claimedCount = claimedTilesList.length;

      // Add walk to history
      const newWalk: Walk = {
        walkId: 'walk_' + Math.random().toString(36).substring(2, 11),
        uid: user.uid,
        path,
        areaClaimed: area,
        createdAt: Date.now(),
      };

      set(state => ({
        walkHistory: [newWalk, ...state.walkHistory],
        user: state.user ? {
          ...state.user,
          totalArea: state.user.totalArea + area,
        } : null,
        lastCapturedArea: area,
      }));
    }

    set({
      isTracking: false,
      path: [],
      trackingStartTime: null,
    });

    return { closed, area, claimedCount };
  },

  claimTiles: (tilesToClaim: { cellId: string; coords: { latitude: number; longitude: number }[] }[], ownerId: string, color: string) => {
    set(state => {
      const updatedTiles = { ...state.tiles };
      
      for (const tileData of tilesToClaim) {
        const { cellId, coords } = tileData;

        // Stealing rules: verify if target tile is rooted (within 2 rings of base cell)
        const targetTile = updatedTiles[cellId];
        if (targetTile && targetTile.isBase) {
          // Can never steal base cells directly
          continue;
        }

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
    });
  },
}));
