export type TimedPoint = {
  lat: number;
  lng: number;
  t: number; // milliseconds since walk started
};

export type Coordinate = {
  lat: number;
  lng: number;
};

// h3-js v4 uses [lat, lng]
export type H3LatLng = [number, number];

// Turf/GeoJSON uses [lng, lat]
export type TurfPosition = [number, number];

/**
 * Converts a lat/lng coordinate or TimedPoint to Turf's [lng, lat] position.
 */
export function toTurfPosition(point: Coordinate | TimedPoint): TurfPosition {
  return [point.lng, point.lat];
}

/**
 * Converts a lat/lng coordinate or TimedPoint to H3's [lat, lng] format.
 */
export function toH3LatLng(point: Coordinate | TimedPoint): H3LatLng {
  return [point.lat, point.lng];
}

/**
 * Converts a Turf [lng, lat] position to standard Coordinate {lat, lng}.
 */
export function fromTurfPosition(pos: TurfPosition): Coordinate {
  return {
    lat: pos[1],
    lng: pos[0],
  };
}

/**
 * Converts an H3 [lat, lng] coordinate to standard Coordinate {lat, lng}.
 */
export function fromH3LatLng(latLng: H3LatLng): Coordinate {
  return {
    lat: latLng[0],
    lng: latLng[1],
  };
}
