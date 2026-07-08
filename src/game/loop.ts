import { distance, area, polygon } from '@turf/turf';
import { TimedPoint, toTurfPosition } from './coords';

// Section 7 Constants
export const CLOSE_METERS = 30;          // Loop counts as closed within this of start
export const MIN_POINTS = 20;             // Minimum GPS points before checking closure
export const MIN_LOOP_AREA_SQM = 300;     // Reject loops smaller than this
export const MIN_PATH_LENGTH_METERS = 50;  // Minimum total path length before loop can close
export const LOOP_TIME_LIMIT_MS = 1200000; // 20 minutes in milliseconds

/**
 * Calculates the cumulative path length in meters.
 */
export function calculatePathLength(path: TimedPoint[]): number {
  let len = 0;
  for (let i = 1; i < path.length; i++) {
    len += distance(toTurfPosition(path[i - 1]), toTurfPosition(path[i]), { units: 'meters' });
  }
  return len;
}

/**
 * Checks if the user has moved far enough from the starting point.
 * Ensures we don't close the loop immediately upon starting.
 */
export function hasMovedAwayFromStart(path: TimedPoint[]): boolean {
  if (path.length === 0) return false;
  const start = path[0];
  
  // Find if any point in the path is further than CLOSE_METERS from the start
  return path.some(p => {
    const d = distance(toTurfPosition(start), toTurfPosition(p), { units: 'meters' });
    return d > CLOSE_METERS;
  });
}

/**
 * Checks if the tracking path forms a closed loop.
 * Requirements:
 * 1. At least MIN_POINTS points
 * 2. Total path length >= MIN_PATH_LENGTH_METERS (50m)
 * 3. Has moved away from the start by > CLOSE_METERS (30m)
 * 4. Current distance to start is < CLOSE_METERS (30m)
 */
export function isLoopClosed(path: TimedPoint[]): boolean {
  if (path.length < MIN_POINTS) {
    return false;
  }

  // 1. Check path length
  const totalLength = calculatePathLength(path);
  if (totalLength < MIN_PATH_LENGTH_METERS) {
    return false;
  }

  // 2. Check if we first moved away from the start
  if (!hasMovedAwayFromStart(path)) {
    return false;
  }

  // 3. Check if current position is close to starting position
  const start = path[0];
  const end = path[path.length - 1];

  // 4. M9: Loop time limit guard (20 minutes max)
  const durationMs = end.t;
  if (durationMs > LOOP_TIME_LIMIT_MS) {
    return false;
  }

  const d = distance(toTurfPosition(start), toTurfPosition(end), { units: 'meters' });

  return d < CLOSE_METERS;
}

/**
 * Calculates the area of the closed loop in square meters.
 * Automatically closes the polygon ring by appending the first coordinate to the end.
 * Verifies coordinate order (Turf/GeoJSON needs [lng, lat]).
 */
export function loopAreaSqM(path: TimedPoint[]): number {
  if (path.length < 3) {
    return 0;
  }

  // Create a closed ring where first and last positions are identical
  // toTurfPosition maps {lat, lng} to [lng, lat] (correct GeoJSON format)
  const ring = path.map(toTurfPosition);
  ring.push(toTurfPosition(path[0]));

  try {
    const poly = polygon([ring]);
    return area(poly);
  } catch (err) {
    console.error('Error calculating area:', err);
    return 0;
  }
}
