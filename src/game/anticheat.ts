import { distance } from '@turf/turf';
import { TimedPoint, toTurfPosition } from './coords';

// Discard GPS steps faster than 3.5 m/s (~12.6 km/h) per Section 7 constants
export const MAX_SPEED_MPS = 3.5;

/**
 * Validates if the transition from point 'a' to point 'b' is physically plausible.
 * Discards any step where speed >= MAX_SPEED_MPS.
 */
export function isPlausibleStep(a: TimedPoint, b: TimedPoint): boolean {
  // If time hasn't advanced or goes backward, it's not a valid progressive step.
  const timeDiffSec = (b.t - a.t) / 1000;
  if (timeDiffSec <= 0) {
    return false;
  }

  // Turf distance returns kilometers by default, so we specify 'meters' as the unit.
  const meters = distance(toTurfPosition(a), toTurfPosition(b), { units: 'meters' });
  const speed = meters / timeDiffSec; // m/s

  return speed < MAX_SPEED_MPS;
}
