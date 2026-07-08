import { TimedPoint, Coordinate } from './coords';

// Standard LAN backend API URL fallback (using machine IP so physical phone can connect)
const DEFAULT_BACKEND_URL = 'http://192.168.0.103:3000';

function getBackendUrl(): string {
  // Expo loads environment variables prefixed with EXPO_PUBLIC_ automatically
  return process.env.EXPO_PUBLIC_BACKEND_URL || DEFAULT_BACKEND_URL;
}

/**
 * Fetches cells inside a closed loop and their boundaries from the backend.
 * App communicates with the backend only over fetch (Option A).
 */
export async function tilesInsideLoop(
  path: TimedPoint[]
): Promise<{ cellId: string; coords: { latitude: number; longitude: number }[] }[]> {
  try {
    const response = await fetch(`${getBackendUrl()}/api/tiles/claim-loop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    });

    if (!response.ok) {
      throw new Error(`Failed to claim loop tiles: ${response.statusText}`);
    }

    const data = await response.json();
    return data.tiles || [];
  } catch (err) {
    console.error('Error fetching tiles inside loop:', err);
    return [];
  }
}

/**
 * Fetches onboarding cell calculations from the backend.
 * Returns the baseCell ID, its boundary coordinates, and its protection disk cell list.
 */
export async function fetchOnboardingData(
  coords: Coordinate
): Promise<{
  baseCell: string;
  baseCoords: { latitude: number; longitude: number }[];
  protectedCells: string[];
} | null> {
  try {
    const response = await fetch(`${getBackendUrl()}/api/tiles/onboard`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat: coords.lat, lng: coords.lng }),
    });

    if (!response.ok) {
      throw new Error(`Failed onboarding tile calculation: ${response.statusText}`);
    }

    return await response.json();
  } catch (err) {
    console.error('Error fetching onboarding tile data:', err);
    return null;
  }
}
