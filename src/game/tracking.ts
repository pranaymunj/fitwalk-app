import * as Location from 'expo-location';
import { Coordinate } from './coords';

/**
 * Requests location permissions from the user.
 */
export async function requestLocationPermissions(): Promise<boolean> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === 'granted';
  } catch (err) {
    console.error('Error requesting location permissions:', err);
    return false;
  }
}

/**
 * Generates a pre-calculated circular loop path of Coordinates around a center point.
 * Ensures the loop is closed (ends near the start) and has enough points (N >= 20) and area.
 */
export function generateSimulatedLoop(center: Coordinate, radiusMeters = 35, numPoints = 24): Coordinate[] {
  const points: Coordinate[] = [];
  const latMeters = 111111; // 1 degree latitude in meters
  const lngMeters = 111111 * Math.cos((center.lat * Math.PI) / 180); // 1 degree longitude in meters

  for (let i = 0; i < numPoints; i++) {
    // Make angle go from 0 to 2*PI
    // To make sure it closes, we can make the last point very close to the first point
    const angle = (i / (numPoints - 1)) * 2 * Math.PI * 0.98; // 98% of full circle (within 30m)
    
    const latOffset = (radiusMeters * Math.cos(angle)) / latMeters;
    const lngOffset = (radiusMeters * Math.sin(angle)) / lngMeters;

    points.push({
      lat: center.lat + latOffset,
      lng: center.lng + lngOffset,
    });
  }

  return points;
}

/**
 * Watches the user's location.
 * Supports standard device GPS tracking and dev-only Simulated Walk Mode.
 * Returns an unsubscribe/cleanup function.
 */
export function watchLocation(
  onLocation: (coords: Coordinate) => void,
  onError: (error: any) => void,
  options: { simulate: boolean }
): () => void {
  let isSubscribed = true;
  let locationSubscription: Location.LocationSubscription | null = null;
  let simulationIntervalId: any = null;

  const startTracking = async () => {
    try {
      // 1. Check/request permission
      const hasPermission = await requestLocationPermissions();
      if (!hasPermission) {
        if (isSubscribed) {
          onError(new Error('Location permission denied'));
        }
        return;
      }

      if (options.simulate) {
        // 2a. Simulated Walk Mode
        // Get initial fix to center the simulation around the user's location
        let center: Coordinate = { lat: 37.7749, lng: -122.4194 }; // SF default
        try {
          const currentLoc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Lowest,
          });
          center = {
            lat: currentLoc.coords.latitude,
            lng: currentLoc.coords.longitude,
          };
        } catch (e) {
          console.warn('Could not get current location for simulation center, using default.', e);
        }

        // Generate circular loop coordinates
        const simulatedPath = generateSimulatedLoop(center);
        let currentIndex = 0;

        // Emit first point immediately
        if (isSubscribed) {
          onLocation(simulatedPath[currentIndex]);
          currentIndex++;
        }

        // Emit subsequent points every 2000ms (to match GPS interval)
        simulationIntervalId = setInterval(() => {
          if (!isSubscribed) return;
          
          if (currentIndex < simulatedPath.length) {
            onLocation(simulatedPath[currentIndex]);
            currentIndex++;
          } else {
            // Loop completed, clean up
            if (simulationIntervalId) {
              clearInterval(simulationIntervalId);
            }
          }
        }, 2000);

      } else {
        // 2b. Real Device GPS tracking
        locationSubscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.BestForNavigation,
            distanceInterval: 1, // 1 meter
            timeInterval: 1000,  // 1000 ms
          },
          (location) => {
            if (!isSubscribed) return;
            onLocation({
              lat: location.coords.latitude,
              lng: location.coords.longitude,
            });
          }
        );
      }
    } catch (err) {
      if (isSubscribed) {
        onError(err);
      }
    }
  };

  startTracking();

  // Return cleanup function
  return () => {
    isSubscribed = false;
    if (locationSubscription) {
      locationSubscription.remove();
    }
    if (simulationIntervalId) {
      clearInterval(simulationIntervalId);
    }
  };
}
