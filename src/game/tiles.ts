import * as h3 from 'h3-js';
import { TimedPoint, Coordinate } from './coords';

// Section 7 Constants
export const H3_RES = 10; // Tile resolution (approx. tens of meters)

/**
 * Returns all H3 cell indexes contained within the closed loop path.
 * Coordinate order for H3 is [lat, lng].
 */
export function tilesInsideLoop(path: TimedPoint[]): string[] {
  if (path.length < 3) {
    return [];
  }

  // Convert to array of [lat, lng] for H3
  const loopCoords = path.map(p => [p.lat, p.lng]);

  try {
    // polygonToCells(coordinates, resolution)
    return h3.polygonToCells(loopCoords, H3_RES);
  } catch (err) {
    console.error('Error generating cells inside loop:', err);
    return [];
  }
}

/**
 * Converts a lat/lng coordinate to an H3 cell index.
 */
export function coordinateToCell(coord: Coordinate | { lat: number, lng: number }): string {
  try {
    return h3.latLngToCell(coord.lat, coord.lng, H3_RES);
  } catch (err) {
    console.error('Error converting coordinate to cell:', err);
    return '';
  }
}

/**
 * Returns the boundary vertices of an H3 cell in {latitude, longitude} shape for react-native-maps.
 */
export function renderCell(cell: string): { latitude: number; longitude: number }[] {
  try {
    // cellToBoundary(cell, isGeoJson = false) -> returns [lat, lng] pairs
    const boundary = h3.cellToBoundary(cell);
    return boundary.map(([lat, lng]) => ({
      latitude: lat,
      longitude: lng,
    }));
  } catch (err) {
    console.error(`Error rendering boundary for cell ${cell}:`, err);
    return [];
  }
}

/**
 * Returns grid disks (rings) of H3 cells around an origin.
 * Used for claim/steal/roots check.
 */
export function getGridDisk(cell: string, ringRadius: number): string[] {
  try {
    return h3.gridDisk(cell, ringRadius);
  } catch (err) {
    console.error(`Error getting grid disk for cell ${cell} with radius ${ringRadius}:`, err);
    return [];
  }
}
