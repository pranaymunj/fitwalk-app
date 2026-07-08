import React, { forwardRef } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { MapViewProps } from './MapView';

export const AppMapView = forwardRef<any, MapViewProps>(
  ({ userLocation, path, tiles, initialRegion }, ref) => {
    return (
      <View style={styles.webMapContainer}>
        <View style={styles.webInfoBox}>
          <Text style={styles.webTitle}>FitWalk Web Map Simulator</Text>
          <Text style={styles.webText}>
            GPS and react-native-maps are active only on iOS and Android devices.
          </Text>
          <Text style={styles.webStats}>
            Tiles claimed: {tiles.length} | Current path length: {path.length} points
          </Text>
          {userLocation && (
            <Text style={styles.webCoords}>
              User coordinate: {userLocation.lat.toFixed(6)}, {userLocation.lng.toFixed(6)}
            </Text>
          )}
        </View>

        {/* Visual representation of grid cells and active trail */}
        <View style={styles.gridCanvas}>
          {/* Simple grid lines background */}
          <View style={styles.gridOverlay} />
          
          {/* Render mock H3 hexagons as small colored dots on screen */}
          <View style={styles.hexList}>
            {tiles.map((tile) => (
              <View
                key={tile.cellId}
                style={[
                  styles.mockHex,
                  { backgroundColor: tile.color },
                ]}
              >
                <Text style={styles.mockHexText}>{tile.cellId.slice(-4)}</Text>
              </View>
            ))}
          </View>

          {/* User Dot */}
          {userLocation && <View style={styles.userDot} />}
        </View>
      </View>
    );
  }
);

const styles = StyleSheet.create({
  webMapContainer: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#f3f3f3',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  webInfoBox: {
    backgroundColor: '#ffffff',
    padding: 20,
    borderRadius: 16,
    maxWidth: 400,
    width: '100%',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 3,
    marginBottom: 20,
    zIndex: 10,
  },
  webTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 10,
    color: '#000000',
    fontFamily: 'system-ui',
  },
  webText: {
    fontSize: 14,
    color: '#5e5e5e',
    marginBottom: 12,
    lineHeight: 20,
    fontFamily: 'system-ui',
  },
  webStats: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
    fontFamily: 'system-ui',
  },
  webCoords: {
    fontSize: 12,
    color: '#afafaf',
    fontFamily: 'monospace',
  },
  gridCanvas: {
    width: '100%',
    height: 300,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: '#efefef',
    borderWidth: 1,
  },
  gridOverlay: {
    ...StyleSheet.absoluteFill,
    opacity: 0.05,
    borderWidth: 1,
    borderColor: '#000000',
    borderStyle: 'dashed',
  },
  hexList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    padding: 10,
    gap: 10,
  },
  mockHex: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.7,
  },
  mockHexText: {
    fontSize: 12,
    color: '#ffffff',
    fontWeight: 'bold',
  },
  userDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#000000',
    borderWidth: 4,
    borderColor: '#ffffff',
    position: 'absolute',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
});
