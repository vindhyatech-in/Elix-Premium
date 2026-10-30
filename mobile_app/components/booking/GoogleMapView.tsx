import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Platform, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ElixColors, ElixRadii, ElixShadows } from '@/constants/theme';
import { LocationCoords, getCurrentCoordinates } from '@/lib/googleMaps';

const GOOGLE_MAPS_KEY =
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
  'AIzaSyDyYUVMKo-C_bHI1QzVieD8qAmlfvylVrA';

interface GoogleMapViewProps {
  coords: LocationCoords | null;
  onCoordsChange: (coords: LocationCoords) => void;
  height?: number;
}

export function GoogleMapView({ coords, onCoordsChange, height = 220 }: GoogleMapViewProps) {
  const containerRef = useRef<any>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerInstanceRef = useRef<any>(null);

  const [loadingMap, setLoadingMap] = useState(true);
  const [mapError, setMapError] = useState('');
  const [locating, setLocating] = useState(false);

  const currentLat = coords?.lat ?? 22.7196; // default Indore
  const currentLng = coords?.lng ?? 75.8577;

  // Load Google Maps JavaScript SDK dynamically in web
  useEffect(() => {
    if (Platform.OS !== 'web') {
      setLoadingMap(false);
      return;
    }

    let isMounted = true;

    async function initSDK() {
      try {
        if (!(window as any).google?.maps) {
          await new Promise<void>((resolve, reject) => {
            const existingScript = document.getElementById('gmaps-mobile-sdk');
            if (existingScript) {
              existingScript.addEventListener('load', () => resolve());
              // in case already loaded
              if ((window as any).google?.maps) resolve();
              return;
            }
            const script = document.createElement('script');
            script.id = 'gmaps-mobile-sdk';
            script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_KEY}&libraries=places`;
            script.async = true;
            script.defer = true;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('Failed to load Google Maps SDK'));
            document.head.appendChild(script);
          });
        }

        if (!isMounted) return;

        const node = containerRef.current;
        if (!node || !(window as any).google?.maps) {
          setLoadingMap(false);
          return;
        }

        const google = (window as any).google;
        const map = new google.maps.Map(node, {
          center: { lat: currentLat, lng: currentLng },
          zoom: 15,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
          zoomControl: true,
          zoomControlOptions: {
            position: google.maps.ControlPosition.RIGHT_BOTTOM,
          },
        });
        mapInstanceRef.current = map;

        const marker = new google.maps.Marker({
          position: { lat: currentLat, lng: currentLng },
          map,
          draggable: true,
          animation: google.maps.Animation.DROP,
        });
        markerInstanceRef.current = marker;

        // When pin is dragged
        marker.addListener('dragend', (e: any) => {
          const lat = Number(e.latLng.lat().toFixed(6));
          const lng = Number(e.latLng.lng().toFixed(6));
          onCoordsChange({ lat, lng });
        });

        // When user taps on the map
        map.addListener('click', (e: any) => {
          const lat = Number(e.latLng.lat().toFixed(6));
          const lng = Number(e.latLng.lng().toFixed(6));
          marker.setPosition(e.latLng);
          onCoordsChange({ lat, lng });
        });

        setLoadingMap(false);
      } catch (err: any) {
        if (isMounted) {
          setMapError('Google Maps could not be loaded.');
          setLoadingMap(false);
        }
      }
    }

    initSDK();

    return () => {
      isMounted = false;
    };
  }, []);

  // Update map center & marker when coords prop changes externally (e.g. from search or locate me)
  useEffect(() => {
    if (coords && mapInstanceRef.current && markerInstanceRef.current && (window as any).google?.maps) {
      const google = (window as any).google;
      const latlng = new google.maps.LatLng(coords.lat, coords.lng);
      markerInstanceRef.current.setPosition(latlng);
      mapInstanceRef.current.panTo(latlng);
    }
  }, [coords?.lat, coords?.lng]);

  async function handleFlyToCurrentLocation() {
    setLocating(true);
    try {
      const pos = await getCurrentCoordinates();
      onCoordsChange(pos);
      if (mapInstanceRef.current && markerInstanceRef.current && (window as any).google?.maps) {
        const google = (window as any).google;
        const latlng = new google.maps.LatLng(pos.lat, pos.lng);
        markerInstanceRef.current.setPosition(latlng);
        mapInstanceRef.current.panTo(latlng);
        mapInstanceRef.current.setZoom(16);
      }
    } catch {
      // handled by caller
    } finally {
      setLocating(false);
    }
  }

  return (
    <View style={[styles.mapCard, { height }]}>
      {/* The Map Node */}
      <View
        ref={containerRef}
        style={StyleSheet.absoluteFill}
        {...({ id: 'mobile-google-map-container' } as any)}
      />

      {loadingMap && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="small" color={ElixColors.blue} />
          <Text style={styles.loadingText}>Loading Google Map…</Text>
        </View>
      )}

      {mapError ? (
        <View style={styles.errorOverlay}>
          <Ionicons name="alert-circle" size={20} color="#DC2626" />
          <Text style={styles.errorText}>{mapError}</Text>
        </View>
      ) : null}

      {/* Floating GPS button on map */}
      <Pressable
        style={[styles.floatingLocateBtn, locating && { opacity: 0.7 }]}
        onPress={handleFlyToCurrentLocation}
        disabled={locating}
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
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(248, 250, 252, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    zIndex: 10,
  },
  loadingText: {
    fontSize: 12,
    fontWeight: '600',
    color: ElixColors.inkMuted,
  },
  errorOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#FEF2F2',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    gap: 6,
    zIndex: 10,
  },
  errorText: {
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '500',
    textAlign: 'center',
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
