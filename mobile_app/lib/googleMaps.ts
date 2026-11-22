import { Platform } from 'react-native';
import * as Location from 'expo-location';
import { apiClient } from './apiClient';

export interface LocationCoords {
  lat: number;
  lng: number;
}

export interface GeocodeResult {
  ok: boolean;
  address?: string;
  pincode?: string;
  locality?: string;
  lat: number;
  lng: number;
  error?: string;
}

export interface PlacePrediction {
  place_id: string;
  description: string;
  main_text: string;
  secondary_text: string;
}

/**
 * Gets high-accuracy GPS coordinates from the device.
 */
export async function getCurrentCoordinates(): Promise<LocationCoords> {
  // 1. If running on native Android or iOS, use expo-location
  if (Platform.OS !== 'web') {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('Location permission denied. Please allow location access in your device settings.');
      }
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      return {
        lat: Number(loc.coords.latitude.toFixed(6)),
        lng: Number(loc.coords.longitude.toFixed(6)),
      };
    } catch (err: any) {
      throw new Error(err?.message || 'Could not fetch device GPS location.');
    }
  }

  // 2. Fallback for Web browser
  return new Promise((resolve, reject) => {
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          resolve({
            lat: Number(pos.coords.latitude.toFixed(6)),
            lng: Number(pos.coords.longitude.toFixed(6)),
          });
        },
        (err) => {
          reject(new Error(err.message || 'Unable to retrieve your current location.'));
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 10000 }
      );
    } else {
      reject(new Error('Geolocation is not supported on this device.'));
    }
  });
}

/**
 * Reverse-geocodes latitude and longitude.
 * 1. Tries native device Geocoder via expo-location (fast, free, works offline).
 * 2. Tries backend /maps/reverse-geocode/ endpoint.
 * 3. Falls back to nearest Indore locality to guarantee address & pincode auto-fill.
 */
export async function reverseGeocodeGoogle(lat: number, lng: number): Promise<GeocodeResult> {
  // 1. Native mobile device geocoding
  if (Platform.OS !== 'web') {
    try {
      const places = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      if (places && places.length > 0) {
        const p = places[0];
        const parts = [
          p.name && p.name !== p.street ? p.name : null,
          p.street,
          p.district || p.subregion,
          p.city || 'Indore',
        ].filter(Boolean);

        const fullAddr = parts.length > 0 ? parts.join(', ') : `${p.city || 'Indore'}, MP`;
        const pin = (p.postalCode || '').replace(/\D/g, '').slice(0, 6);

        return {
          ok: true,
          address: fullAddr,
          pincode: pin,
          locality: p.district || p.subregion || p.city || 'Indore',
          lat,
          lng,
        };
      }
    } catch {
      // Fall through to backend
    }
  }

  // 2. Try backend Google Maps endpoint
  try {
    const res = await apiClient.get('/maps/reverse-geocode/', { params: { lat, lng } });
    if (res.data?.ok && res.data.address) {
      return {
        ok: true,
        address: res.data.address || '',
        pincode: res.data.pincode || '',
        locality: res.data.locality || '',
        lat: res.data.lat ?? lat,
        lng: res.data.lng ?? lng,
      };
    }
  } catch {
    // Backend API unavailable or billing disabled
  }

  // 3. Fallback: match nearest Indore locality
  let nearest = POPULAR_INDORE_LOCALITIES[0];
  let minDist = Number.MAX_VALUE;
  for (const loc of POPULAR_INDORE_LOCALITIES) {
    const d = Math.hypot(loc.lat - lat, loc.lng - lng);
    if (d < minDist) {
      minDist = d;
      nearest = loc;
    }
  }

  return {
    ok: true,
    address: `${nearest.name}, Indore`,
    pincode: nearest.pincode,
    locality: nearest.name,
    lat,
    lng,
  };
}

/**
 * Searches places via Indore localities, native device geocoder, and backend API.
 */
export async function searchPlacesGoogle(query: string): Promise<PlacePrediction[]> {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed || trimmed.length < 2) return [];

  const predictions: PlacePrediction[] = [];

  // 1. Check local Indore localities (Instant 0ms response)
  const matched = POPULAR_INDORE_LOCALITIES.filter(
    (l) => l.name.toLowerCase().includes(trimmed) || l.pincode.includes(trimmed)
  );
  for (const m of matched) {
    predictions.push({
      place_id: `local_${m.name.replace(/\s+/g, '_').toLowerCase()}`,
      description: `${m.name}, Indore, MP - ${m.pincode}`,
      main_text: m.name,
      secondary_text: `Indore, MP - ${m.pincode}`,
    });
  }

  // 2. Try native device geocoder via expo-location on mobile
  if (Platform.OS !== 'web') {
    try {
      const geoResults = await Location.geocodeAsync(`${query}, Indore, Madhya Pradesh`);
      for (let i = 0; i < Math.min(geoResults.length, 3); i++) {
        const g = geoResults[i];
        const id = `native_geo_${g.latitude.toFixed(4)}_${g.longitude.toFixed(4)}`;
        if (!predictions.some((p) => p.place_id === id)) {
          predictions.push({
            place_id: id,
            description: `${query}, Indore`,
            main_text: query,
            secondary_text: 'Indore, Madhya Pradesh',
          });
        }
      }
    } catch {}
  }

  // 3. Try backend Google Places API
  try {
    const res = await apiClient.get('/maps/places-autocomplete/', { params: { input: query.trim() } });
    if (res.data?.ok && Array.isArray(res.data.predictions)) {
      for (const p of res.data.predictions) {
        if (!predictions.some((existing) => existing.place_id === p.place_id || existing.description === p.description)) {
          predictions.push(p);
        }
      }
    }
  } catch {}

  return predictions;
}

/**
 * Resolves a selected place to exact coordinates, address, and pincode.
 */
export async function getPlaceDetailsGoogle(placeId: string): Promise<GeocodeResult> {
  // Check local Indore localities
  if (placeId.startsWith('local_')) {
    const rawName = placeId.replace('local_', '').replace(/_/g, ' ');
    const found = POPULAR_INDORE_LOCALITIES.find(
      (l) => l.name.toLowerCase() === rawName.toLowerCase()
    );
    if (found) {
      return {
        ok: true,
        address: `${found.name}, Indore`,
        pincode: found.pincode,
        locality: found.name,
        lat: found.lat,
        lng: found.lng,
      };
    }
  }

  // Check native geocode format
  if (placeId.startsWith('native_geo_')) {
    const parts = placeId.replace('native_geo_', '').split('_');
    const lat = parseFloat(parts[0]);
    const lng = parseFloat(parts[1]);
    if (!isNaN(lat) && !isNaN(lng)) {
      return reverseGeocodeGoogle(lat, lng);
    }
  }

  // Try backend API
  try {
    const res = await apiClient.get('/maps/place-details/', { params: { place_id: placeId } });
    if (res.data?.ok && res.data.address) {
      return {
        ok: true,
        address: res.data.address || '',
        pincode: res.data.pincode || '',
        locality: res.data.locality || '',
        lat: res.data.lat,
        lng: res.data.lng,
      };
    }
  } catch {}

  return {
    ok: false,
    lat: 22.7196,
    lng: 75.8577,
    error: 'Could not resolve place details.',
  };
}

export interface NearbyPlace {
  name: string;
  address: string;
  pincode?: string;
  lat?: number;
  lng?: number;
  types?: string[];
}

export const POPULAR_INDORE_LOCALITIES = [
  { name: 'Vijay Nagar', pincode: '452010', lat: 22.7533, lng: 75.8937 },
  { name: 'Palasia', pincode: '452001', lat: 22.7244, lng: 75.8839 },
  { name: 'Bhawarkua', pincode: '452001', lat: 22.6926, lng: 75.8676 },
  { name: 'Mahalaxmi Nagar', pincode: '452010', lat: 22.7562, lng: 75.9082 },
  { name: 'Saket Nagar', pincode: '452018', lat: 22.7161, lng: 75.8943 },
  { name: 'Rajwada', pincode: '452002', lat: 22.7186, lng: 75.8550 },
  { name: 'Annapurna', pincode: '452009', lat: 22.6983, lng: 75.8364 },
  { name: 'Nipania', pincode: '452016', lat: 22.7680, lng: 75.9180 },
  { name: 'Super Corridor', pincode: '452005', lat: 22.7744, lng: 75.8200 },
  { name: 'Rau', pincode: '453331', lat: 22.6288, lng: 75.8080 },
  { name: 'Rajendra Nagar', pincode: '452012', lat: 22.6718, lng: 75.8305 },
  { name: 'Bengali Square', pincode: '452016', lat: 22.7208, lng: 75.9077 },
  { name: 'Geeta Bhawan', pincode: '452001', lat: 22.7212, lng: 75.8812 },
  { name: 'Khajrana', pincode: '452016', lat: 22.7383, lng: 75.9102 },
  { name: 'Sudama Nagar', pincode: '452009', lat: 22.6881, lng: 75.8252 },
  { name: 'Scheme 54', pincode: '452010', lat: 22.7548, lng: 75.8887 },
  { name: 'Scheme 78', pincode: '452010', lat: 22.7661, lng: 75.8953 },
  { name: 'LIG Colony', pincode: '452008', lat: 22.7394, lng: 75.8872 },
  { name: 'Tilak Nagar', pincode: '452018', lat: 22.7175, lng: 75.9038 },
  { name: 'Navlakha', pincode: '452001', lat: 22.7011, lng: 75.8753 },
  { name: 'Chhavani', pincode: '452001', lat: 22.7104, lng: 75.8712 },
  { name: 'Sapna Sangeeta', pincode: '452001', lat: 22.7032, lng: 75.8647 },
  { name: 'Sarafa', pincode: '452002', lat: 22.7171, lng: 75.8528 },
  { name: 'Aerodrome Road', pincode: '452005', lat: 22.7289, lng: 75.8245 },
  { name: 'Bicholi Mardana', pincode: '452016', lat: 22.7058, lng: 75.9287 },
  { name: 'Kanadia Road', pincode: '452016', lat: 22.7215, lng: 75.9250 },
];

/**
 * Searches nearby landmarks, establishments, and localities via Google Places searchNearby.
 */
export async function searchNearbyPlacesGoogle(
  lat?: number,
  lng?: number,
  radius?: number
): Promise<NearbyPlace[]> {
  try {
    const res = await apiClient.get('/maps/nearby/', {
      params: {
        lat: lat ?? 22.7196,
        lng: lng ?? 75.8577,
        radius: radius ?? 2500,
      },
    });
    if (res.data?.ok && Array.isArray(res.data.places)) {
      return res.data.places;
    }
    return [];
  } catch {
    return [];
  }
}

