import React, { useRef, useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { ElixColors, ElixRadii, ElixShadows } from '@/constants/theme';
import { LocationCoords, getCurrentCoordinates } from '@/lib/googleMaps';

interface GoogleMapViewProps {
  coords: LocationCoords | null;
  onCoordsChange: (coords: LocationCoords) => void;
  height?: number;
}

export function GoogleMapView({ coords, onCoordsChange, height = 220 }: GoogleMapViewProps) {
  const mapRef = useRef<MapView | null>(null);
  const [locating, setLocating] = useState(false);

  const currentLat = coords?.lat ?? 22.7196; // default Indore
  const currentLng = coords?.lng ?? 75.8577;

  useEffect(() => {
    if (coords && mapRef.current) {
      mapRef.current.animateToRegion(
        {
          latitude: coords.lat,
          longitude: coords.lng,
          latitudeDelta: 0.015,
          longitudeDelta: 0.015,
        },
        500
      );
    }
  }, [coords?.lat, coords?.lng]);

  async function handleFlyToCurrentLocation() {
    setLocating(true);
    try {
      const pos = await getCurrentCoordinates();
      onCoordsChange(pos);
      if (mapRef.current) {
        mapRef.current.animateToRegion(
          {
            latitude: pos.lat,
            longitude: pos.lng,
            latitudeDelta: 0.015,
            longitudeDelta: 0.015,
          },
          500
        );
      }
    } catch {
      // handled by parent
    } finally {
      setLocating(false);
    }
  }

  return (
    <View style={[styles.mapCard, { height }]}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={{
          latitude: currentLat,
          longitude: currentLng,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        }}
        onPress={(e) => {
          const { latitude, longitude } = e.nativeEvent.coordinate;
          onCoordsChange({
            lat: Number(latitude.toFixed(6)),
            lng: Number(longitude.toFixed(6)),
          });
        }}
      >
        <Marker
          coordinate={{ latitude: currentLat, longitude: currentLng }}
          draggable
          onDragEnd={(e) => {
            const { latitude, longitude } = e.nativeEvent.coordinate;
            onCoordsChange({
              lat: Number(latitude.toFixed(6)),
              lng: Number(longitude.toFixed(6)),
            });
          }}
        />
      </MapView>

      {/* Floating GPS button on map */}
      <Pressable
        style={[styles.floatingLocateBtn, locating && { opacity: 0.7 }]}
        onPress={handleFlyToCurrentLocation}
        disabled={locating}
        accessibilityLabel="Locate my position on map"
      >
        {locating ? (
          <ActivityIndicator size="small" color={ElixColors.blue} />
        ) : (
          <Ionicons name="locate" size={18} color={ElixColors.blue} />
        )}
      </Pressable>

      {/* Pin instruction pill */}
      <View style={styles.instructionPill}>
        <Ionicons name="location" size={12} color="#DC2626" />
        <Text style={styles.instructionText}>
          {coords ? `Pin: ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}` : 'Tap or drag pin to select spot'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  mapCard: {
    width: '100%',
    borderRadius: ElixRadii.md,
    overflow: 'hidden',
    backgroundColor: '#E2E8F0',
    position: 'relative',
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    ...ElixShadows.sm,
  },
  floatingLocateBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    ...ElixShadows.md,
    zIndex: 5,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  instructionPill: {
    position: 'absolute',
    bottom: 8,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 5,
  },
  instructionText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
});
