import React, { forwardRef } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Polyline, Polygon, Marker, PROVIDER_DEFAULT } from 'react-native-maps';

export interface MapViewProps {
  userLocation: { lat: number; lng: number } | null;
  path: { lat: number; lng: number }[];
  tiles: { cellId: string; color: string; coords: { latitude: number; longitude: number }[] }[];
  initialRegion?: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  };
  onRegionChangeComplete?: (region: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  }) => void;
  ghostLocation?: { latitude: number; longitude: number } | null;
}

export const AppMapView = forwardRef<MapView, MapViewProps>(
  ({ userLocation, path, tiles, initialRegion, onRegionChangeComplete, ghostLocation }, ref) => {
    return (
      <MapView
        ref={ref}
        style={styles.map}
        provider={PROVIDER_DEFAULT}
        showsUserLocation={false} // Custom marker for more precise control
        showsMyLocationButton={false}
        initialRegion={initialRegion}
        onRegionChangeComplete={onRegionChangeComplete}
      >
        {/* Draw Claimed H3 Tiles */}
        {tiles.map((tile) => (
          <Polygon
            key={tile.cellId}
            coordinates={tile.coords}
            fillColor={`${tile.color}4D`} // 30% opacity (4D in hex)
            strokeColor={tile.color}
            strokeWidth={1.5}
          />
        ))}

        {/* Draw Active Trail */}
        {path.length > 1 && (
          <Polyline
            coordinates={path.map((p) => ({
              latitude: p.lat,
              longitude: p.lng,
            }))}
            strokeColor="#000000"
            strokeWidth={3}
            lineDashPattern={[0]} // solid line
          />
        )}

        {/* Custom User Location Marker (minimalist black dot with white border per DESIGN.md) */}
        {userLocation && (
          <Marker
            coordinate={{
              latitude: userLocation.lat,
              longitude: userLocation.lng,
            }}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={styles.userDotOutline}>
              <View style={styles.userDot} />
            </View>
          </Marker>
        )}

        {/* Ghost Marker (Milestone M8 - Ghost You) */}
        {ghostLocation && (
          <Marker
            coordinate={ghostLocation}
            anchor={{ x: 0.5, y: 0.5 }}
            opacity={0.6}
          >
            <View style={styles.ghostDotOutline}>
              <View style={styles.ghostDot} />
            </View>
          </Marker>
        )}
      </MapView>
    );
  }
);

const styles = StyleSheet.create({
  map: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  },
  userDotOutline: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  userDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#000000',
  },
  ghostDotOutline: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  ghostDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#7209b7',
  },
});
