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
export function getCurrentCoordinates(): Promise<LocationCoords> {
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
 * Reverse-geocodes latitude and longitude using Google Maps Geocoding API.
 */
export async function reverseGeocodeGoogle(lat: number, lng: number): Promise<GeocodeResult> {
  try {
    const res = await apiClient.get('/maps/reverse-geocode/', { params: { lat, lng } });
    if (res.data?.ok) {
      return {
        ok: true,
        address: res.data.address || '',
        pincode: res.data.pincode || '',
        locality: res.data.locality || '',
        lat: res.data.lat ?? lat,
        lng: res.data.lng ?? lng,
      };
    }
    return {
      ok: false,
      lat,
      lng,
      error: res.data?.error || 'Could not resolve address.',
    };
  } catch (err: any) {
    const errorMsg =
      err?.response?.data?.error ||
      err?.message ||
      'Failed to connect to Google Maps service.';
    return {
      ok: false,
      lat,
      lng,
      error: errorMsg,
    };
  }
}

/**
 * Searches places via Google Places Autocomplete API.
 */
export async function searchPlacesGoogle(query: string): Promise<PlacePrediction[]> {
  const trimmed = query.trim();
  if (!trimmed || trimmed.length < 2) return [];

  try {
    const res = await apiClient.get('/maps/places-autocomplete/', { params: { input: trimmed } });
    if (res.data?.ok && Array.isArray(res.data.predictions)) {
      return res.data.predictions;
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * Resolves a selected place to exact coordinates, address, and pincode.
 */
export async function getPlaceDetailsGoogle(placeId: string): Promise<GeocodeResult> {
  try {
    const res = await apiClient.get('/maps/place-details/', { params: { place_id: placeId } });
    if (res.data?.ok) {
      return {
        ok: true,
        address: res.data.address || '',
        pincode: res.data.pincode || '',
        lat: res.data.lat,
        lng: res.data.lng,
      };
    }
    return {
      ok: false,
      lat: 0,
      lng: 0,
      error: res.data?.error || 'Could not resolve place details.',
    };
  } catch (err: any) {
    return {
      ok: false,
      lat: 0,
      lng: 0,
      error: err?.response?.data?.error || err?.message || 'Could not fetch place details.',
    };
  }
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

