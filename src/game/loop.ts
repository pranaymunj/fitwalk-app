import { distance, area, polygon } from '@turf/turf';
import { TimedPoint, toTurfPosition } from './coords';

// Section 7 Constants
export const CLOSE_METERS = 30;          // Loop counts as closed within this of start
export const MIN_POINTS = 20;             // Minimum GPS points before checking closure
export const MIN_LOOP_AREA_SQM = 300;     // Reject loops smaller than this
export const LOOP_TIME_LIMIT_MS = 1200000; // 20 minutes in milliseconds

/**
 * Checks if the tracking path forms a closed loop.
 * A loop is closed if the distance between the starting point and the latest point
 * is less than CLOSE_METERS, and there are at least MIN_POINTS.
 */
export function isLoopClosed(path: TimedPoint[]): boolean {
  if (path.length < MIN_POINTS) {
    return false;
  }

  const start = path[0];
  const end = path[path.length - 1];

  // Calculate distance in meters
  const d = distance(toTurfPosition(start), toTurfPosition(end), { units: 'meters' });
  return d < CLOSE_METERS;
}

/**
 * Calculates the area of the closed loop in square meters.
 * Automatically closes the polygon ring by appending the first coordinate to the end.
 */
export function loopAreaSqM(path: TimedPoint[]): number {
  if (path.length < 3) {
    return 0;
  }

  // Create a closed ring where first and last positions are identical
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
