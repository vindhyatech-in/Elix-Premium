import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ElixColors, ElixRadii, ElixShadows } from '@/constants/theme';
import { useBookingFlowStore } from '@/store/bookingFlowStore';
import { useAuthStore } from '@/store/authStore';
import { useAddresses, useAddAddress } from '@/hooks/useProfile';
import { GoogleMapView } from './GoogleMapView';
import {
  getCurrentCoordinates,
  reverseGeocodeGoogle,
  searchPlacesGoogle,
  getPlaceDetailsGoogle,
  searchNearbyPlacesGoogle,
  POPULAR_INDORE_LOCALITIES,
  PlacePrediction,
  LocationCoords,
  NearbyPlace,
} from '@/lib/googleMaps';
import type { Address } from '@/types/api';

export function StepAddress({ onNext }: { onNext: () => void }) {
  const { selectedAddress, setAddress } = useBookingFlowStore();
  const { isLoggedIn } = useAuthStore();
  const { data: addresses, isLoading } = useAddresses(isLoggedIn);
  const addAddress = useAddAddress();

  const [showAddForm, setShowAddForm] = useState(false);
  const [newLabel, setNewLabel] = useState('Home');
  const [newText, setNewText] = useState('');
  const [newPincode, setNewPincode] = useState('');
  const [coords, setCoords] = useState<LocationCoords | null>({ lat: 22.7196, lng: 75.8577 });
  const [adding, setAdding] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState('');
  const [infoMsg, setInfoMsg] = useState('');

  // Places Autocomplete
  const [searchQuery, setSearchQuery] = useState('');
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [searching, setSearching] = useState(false);

  // Nearby Locations
  const [nearbyPlaces, setNearbyPlaces] = useState<NearbyPlace[]>([]);
  const [loadingNearby, setLoadingNearby] = useState(false);
  const [showNearbySection, setShowNearbySection] = useState(false);

  async function handleUseCurrentLocation() {
    setError('');
    setInfoMsg('');
    setLocating(true);
    try {
      const position = await getCurrentCoordinates();
      setCoords(position);

      const result = await reverseGeocodeGoogle(position.lat, position.lng);
      if (result.ok && result.address) {
        setNewText(result.address);
        if (result.pincode) setNewPincode(result.pincode);
        setInfoMsg(`GPS location & address acquired (${position.lat.toFixed(4)}, ${position.lng.toFixed(4)})`);
      } else {
        setInfoMsg(`GPS pin locked (${position.lat.toFixed(4)}, ${position.lng.toFixed(4)}). Please add house/flat details.`);
      }
    } catch (err: any) {
      setError(err?.message || 'Could not fetch current location. Please tap on map or enter manually.');
    } finally {
      setLocating(false);
    }
  }

  async function handleMapCoordsChange(newCoords: LocationCoords) {
    setCoords(newCoords);
    setError('');
    try {
      const result = await reverseGeocodeGoogle(newCoords.lat, newCoords.lng);
      if (result.ok && result.address) {
        setNewText(result.address);
        if (result.pincode) setNewPincode(result.pincode);
        setInfoMsg(`Address updated from map pin (${newCoords.lat.toFixed(4)}, ${newCoords.lng.toFixed(4)})`);
      } else {
        setInfoMsg(`Map pin dropped at ${newCoords.lat.toFixed(4)}, ${newCoords.lng.toFixed(4)}`);
      }
    } catch {
      setInfoMsg(`Map pin dropped at ${newCoords.lat.toFixed(4)}, ${newCoords.lng.toFixed(4)}`);
    }
  }

  async function handleSearchChange(text: string) {
    setSearchQuery(text);
    if (text.trim().length < 2) {
      setPredictions([]);
      return;
    }
    setSearching(true);
    try {
      const results = await searchPlacesGoogle(text);
      setPredictions(results);
    } catch {
      setPredictions([]);
    } finally {
      setSearching(false);
    }
  }

  async function handleSelectPrediction(item: PlacePrediction) {
    setSearching(true);
    setPredictions([]);
    setSearchQuery('');
    try {
      const details = await getPlaceDetailsGoogle(item.place_id);
      if (details.ok && details.address) {
        setNewText(details.address);
        if (details.pincode) setNewPincode(details.pincode);
        if (details.lat && details.lng) {
          setCoords({ lat: details.lat, lng: details.lng });
          setInfoMsg(`Location selected from Google Maps (${details.lat.toFixed(4)}, ${details.lng.toFixed(4)})`);
        }
      } else {
        setNewText(item.description);
      }
    } catch {
      setNewText(item.description);
    } finally {
      setSearching(false);
    }
  }

  async function handleFetchNearby() {
    setLoadingNearby(true);
    setShowNearbySection(true);
    try {
      const current = coords || { lat: 22.7196, lng: 75.8577 };
      const results = await searchNearbyPlacesGoogle(current.lat, current.lng, 2500);
      setNearbyPlaces(results);
      if (results.length === 0) {
        setInfoMsg('No specific landmarks found nearby. Tap on map or use search above.');
      }
    } catch {
      setNearbyPlaces([]);
    } finally {
      setLoadingNearby(false);
    }
  }

  function handleSelectNearbyPlace(place: NearbyPlace) {
    if (place.lat && place.lng) {
      setCoords({ lat: place.lat, lng: place.lng });
    }
    setNewText(place.address || place.name);
    if (place.pincode) setNewPincode(place.pincode);
    setInfoMsg(`Selected: ${place.name}`);
  }

  function handleSelectLocality(loc: { name: string; pincode: string; lat: number; lng: number }) {
    setCoords({ lat: loc.lat, lng: loc.lng });
    setNewText(`${loc.name}, Indore`);
    setNewPincode(loc.pincode);
    setInfoMsg(`Selected locality: ${loc.name}`);
  }

  async function handleAddNew() {
    setError('');
    setInfoMsg('');
    if (!newText.trim()) { setError('Enter your full address.'); return; }
    if (newPincode && (newPincode.length !== 6 || isNaN(Number(newPincode)))) {
      setError('Enter a valid 6-digit pincode.'); return;
    }
    setAdding(true);
    try {
      const res = await addAddress.mutateAsync({
        label: newLabel || 'Home',
        text: newText.trim(),
        pincode: newPincode,
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
      });
      setAddress((res.data as any).address as Address);
      setShowAddForm(false);
      setNewText('');
      setNewPincode('');
    } catch {
      setError('Could not save address. Try again.');
    } finally {
      setAdding(false);
    }
  }

  const canProceed = !!selectedAddress;

  return (
    <View style={styles.container}>
      <Text style={styles.stepTitle}>Where should the artist come?</Text>
      <Text style={styles.stepSubtitle}>Choose a saved address or pinpoint on Google Map</Text>

      {isLoading ? (
        <ActivityIndicator color={ElixColors.blue} style={{ marginTop: 20 }} />
      ) : (
        <ScrollView style={styles.addrList} showsVerticalScrollIndicator={false}>
          {(addresses ?? []).map((addr) => {
            const selected = selectedAddress?.id === addr.id;
            return (
              <Pressable
                key={addr.id}
                style={[styles.addrCard, selected && styles.addrCardSelected]}
                onPress={() => setAddress(addr)}
              >
                <View style={[styles.radioOuter, selected && styles.radioOuterSelected]}>
                  {selected && <View style={styles.radioInner} />}
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.addrHeaderRow}>
                    <Text style={styles.addrLabel}>{addr.label}</Text>
                    {addr.lat && addr.lng ? (
                      <View style={styles.gpsBadge}>
                        <Ionicons name="location" size={10} color="#166534" />
                        <Text style={styles.gpsBadgeText}>GPS Pin</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.addrText}>{addr.text}</Text>
                  {addr.pincode ? <Text style={styles.addrPincode}>Pincode: {addr.pincode}</Text> : null}
                </View>
                <Ionicons name="home" size={16} color={selected ? ElixColors.blue : ElixColors.inkMuted} />
              </Pressable>
            );
          })}

          {!showAddForm ? (
            <Pressable style={styles.addNewBtn} onPress={() => setShowAddForm(true)}>
              <Ionicons name="add-circle-outline" size={18} color={ElixColors.blue} />
              <Text style={styles.addNewText}>Add New Address (with Google Map)</Text>
            </Pressable>
          ) : (
            <View style={styles.addForm}>
              <View style={styles.formHeader}>
                <Text style={styles.formTitle}>Set Location on Map</Text>
                <View style={styles.gmapBadge}>
                  <Ionicons name="map" size={11} color="#1D4ED8" />
                  <Text style={styles.gmapBadgeText}>Google Maps</Text>
                </View>
              </View>

              {/* Action Buttons: Current Location + Search Nearby */}
              <View style={styles.actionRow}>
                <Pressable
                  style={[styles.actionBtn, locating && styles.btnDisabled]}
                  onPress={handleUseCurrentLocation}
                  disabled={locating}
                >
                  {locating ? (
                    <ActivityIndicator size="small" color="#1D4ED8" />
                  ) : (
                    <Ionicons name="navigate-circle" size={16} color="#1D4ED8" />
                  )}
                  <Text style={styles.actionBtnText}>
                    {locating ? 'Locating…' : 'Current GPS'}
                  </Text>
                </Pressable>

                <Pressable
                  style={[styles.actionBtn, styles.actionBtnOutline, loadingNearby && styles.btnDisabled]}
                  onPress={handleFetchNearby}
                  disabled={loadingNearby}
                >
                  {loadingNearby ? (
                    <ActivityIndicator size="small" color="#4F46E5" />
                  ) : (
                    <Ionicons name="compass-outline" size={16} color="#4F46E5" />
                  )}
                  <Text style={[styles.actionBtnText, { color: '#4F46E5' }]}>
                    {loadingNearby ? 'Searching…' : 'Nearby Spots'}
                  </Text>
                </Pressable>
              </View>

              {/* Google Places Autocomplete Search */}
              <View style={styles.searchBox}>
                <Ionicons name="search" size={15} color="#6B7280" style={{ marginRight: 6 }} />
                <TextInput
                  style={styles.searchInput}
                  value={searchQuery}
                  onChangeText={handleSearchChange}
                  placeholder="Search locality, building or landmark…"
                  placeholderTextColor="#9CA3AF"
                />
                {searching ? <ActivityIndicator size="small" color={ElixColors.blue} /> : null}
              </View>

              {predictions.length > 0 && (
                <View style={styles.predictionsList}>
                  {predictions.map((p) => (
                    <Pressable
                      key={p.place_id}
                      style={styles.predictionItem}
                      onPress={() => handleSelectPrediction(p)}
                    >
                      <Ionicons name="location-outline" size={16} color={ElixColors.blue} style={{ marginTop: 2 }} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.predMainText}>{p.main_text || p.description}</Text>
                        {p.secondary_text ? <Text style={styles.predSubText}>{p.secondary_text}</Text> : null}
                      </View>
                    </Pressable>
                  ))}
                </View>
              )}

              {/* Quick Popular Localities in Indore */}
              <View style={styles.popularSection}>
                <Text style={styles.popularTitle}>POPULAR INDORE AREAS:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                  {POPULAR_INDORE_LOCALITIES.map((loc) => (
                    <Pressable
                      key={loc.name}
                      style={styles.localityChip}
                      onPress={() => handleSelectLocality(loc)}
                    >
                      <Text style={styles.localityChipText}>{loc.name}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>

              {/* Nearby Spots List (if searched) */}
              {showNearbySection && nearbyPlaces.length > 0 && (
                <View style={styles.nearbySection}>
                  <Text style={styles.popularTitle}>NEARBY SPOTS (GOOGLE PLACES):</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                    {nearbyPlaces.map((np, idx) => (
                      <Pressable
                        key={idx}
                        style={styles.nearbyChip}
                        onPress={() => handleSelectNearbyPlace(np)}
                      >
                        <Ionicons name="business-outline" size={12} color="#1E40AF" />
                        <Text style={styles.nearbyChipText} numberOfLines={1}>{np.name}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* Interactive Google Map */}
              <Text style={styles.mapLabel}>DRAG PIN OR TAP TO SET EXACT SPOT:</Text>
              <GoogleMapView
                coords={coords}
                onCoordsChange={handleMapCoordsChange}
                height={210}
              />

              {infoMsg ? (
                <View style={styles.infoBox}>
                  <Ionicons name="checkmark-circle" size={14} color="#15803D" />
                  <Text style={styles.infoText}>{infoMsg}</Text>
                </View>
              ) : null}

              {error ? (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle" size={14} color="#DC2626" />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <Text style={styles.label}>Label</Text>
              <View style={styles.segRow}>
                {['Home', 'Work', 'Other'].map((l) => (
                  <Pressable
                    key={l}
                    style={[styles.segBtn, newLabel === l && styles.segBtnActive]}
                    onPress={() => setNewLabel(l)}
                  >
                    <Text style={[styles.segBtnText, newLabel === l && styles.segBtnTextActive]}>{l}</Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.label}>Full Address *</Text>
              <TextInput
                style={styles.input}
                value={newText}
                onChangeText={setNewText}
                placeholder="House / Flat / Road, Area, Landmark"
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={3}
              />

              <Text style={styles.label}>Pincode (Indore)</Text>
              <TextInput
                style={styles.input}
                value={newPincode}
                onChangeText={setNewPincode}
                placeholder="452001"
                placeholderTextColor="#9CA3AF"
                keyboardType="number-pad"
                maxLength={6}
              />

              <View style={styles.formActions}>
                <Pressable
                  style={styles.cancelBtn}
                  onPress={() => {
                    setShowAddForm(false);
                    setError('');
                    setInfoMsg('');
                    setPredictions([]);
                    setShowNearbySection(false);
                  }}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </Pressable>
                <Pressable style={styles.saveBtn} onPress={handleAddNew} disabled={adding}>
                  {adding ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveBtnText}>Save Address</Text>}
                </Pressable>
              </View>
            </View>
          )}
        </ScrollView>
      )}

      <Pressable
        style={[styles.nextBtn, !canProceed && styles.nextBtnDisabled]}
        onPress={canProceed ? onNext : undefined}
      >
        <Text style={styles.nextBtnText}>Continue</Text>
        <Ionicons name="arrow-forward" size={16} color="#fff" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20 },
  stepTitle: { fontSize: 18, fontWeight: '800', color: ElixColors.ink, marginBottom: 4 },
  stepSubtitle: { fontSize: 13, color: ElixColors.inkMuted, marginBottom: 16 },
  addrList: { flex: 1 },
  addrCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: ElixColors.white, borderRadius: ElixRadii.md,
    padding: 14, marginBottom: 8, borderWidth: 1.5, borderColor: '#E5E7EB',
    ...ElixShadows.sm,
  },
  addrCardSelected: { borderColor: ElixColors.blue, backgroundColor: '#EFF6FF' },
  radioOuter: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  radioOuterSelected: { borderColor: ElixColors.blue },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: ElixColors.blue },
  addrHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  addrLabel: { fontSize: 13, fontWeight: '700', color: ElixColors.ink },
  gpsBadge: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: '#DCFCE7', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
  gpsBadgeText: { fontSize: 10, fontWeight: '700', color: '#166534' },
  addrText: { fontSize: 13, color: ElixColors.inkMuted, lineHeight: 18 },
  addrPincode: { fontSize: 11, color: ElixColors.inkMuted, marginTop: 2 },
  addNewBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 14, borderRadius: ElixRadii.md, borderWidth: 1.5, borderColor: ElixColors.blue, borderStyle: 'dashed', justifyContent: 'center', marginBottom: 8 },
  addNewText: { color: ElixColors.blue, fontWeight: '600', fontSize: 14 },
  addForm: { backgroundColor: '#F8FAFC', borderRadius: ElixRadii.lg, padding: 16, marginBottom: 8, borderWidth: 1, borderColor: '#E5E7EB' },
  formHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  formTitle: { fontSize: 15, fontWeight: '700', color: ElixColors.ink },
  gmapBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#DBEAFE', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  gmapBadgeText: { fontSize: 10, fontWeight: '700', color: '#1E40AF' },
  actionRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE', paddingVertical: 9, borderRadius: ElixRadii.md },
  actionBtnOutline: { backgroundColor: '#EEF2FF', borderColor: '#C7D2FE' },
  actionBtnText: { color: '#1D4ED8', fontSize: 12, fontWeight: '700' },
  btnDisabled: { opacity: 0.6 },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: ElixRadii.sm, paddingHorizontal: 10, paddingVertical: 8, marginBottom: 8 },
  searchInput: { flex: 1, fontSize: 13, color: ElixColors.ink },
  predictionsList: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: ElixRadii.sm, marginBottom: 10, maxHeight: 150, overflow: 'hidden' },
  predictionItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingHorizontal: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  predMainText: { fontSize: 13, fontWeight: '600', color: ElixColors.ink },
  predSubText: { fontSize: 11, color: ElixColors.inkMuted },
  popularSection: { marginBottom: 10 },
  popularTitle: { fontSize: 10, fontWeight: '800', color: ElixColors.inkMuted, letterSpacing: 0.5, marginBottom: 5 },
  chipScroll: { flexDirection: 'row' },
  localityChip: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#CBD5E1', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16, marginRight: 6 },
  localityChipText: { fontSize: 12, fontWeight: '600', color: ElixColors.ink },
  nearbySection: { marginBottom: 10 },
  nearbyChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#DBEAFE', borderWidth: 1, borderColor: '#93C5FD', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16, marginRight: 6, maxWidth: 160 },
  nearbyChipText: { fontSize: 11, fontWeight: '600', color: '#1E40AF' },
  mapLabel: { fontSize: 10, fontWeight: '800', color: ElixColors.inkMuted, letterSpacing: 0.5, marginBottom: 6 },
  infoBox: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F0FDF4', padding: 8, borderRadius: 6, marginBottom: 10, borderWidth: 1, borderColor: '#BBF7D0' },
  infoText: { color: '#166534', fontSize: 11, fontWeight: '500', flex: 1 },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FEF2F2', padding: 8, borderRadius: 6, marginBottom: 10, borderWidth: 1, borderColor: '#FECACA' },
  errorText: { color: '#DC2626', fontSize: 11, fontWeight: '500', flex: 1 },
  label: { fontSize: 12, fontWeight: '600', color: ElixColors.ink, marginBottom: 6 },
  segRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  segBtn: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, backgroundColor: '#E5E7EB' },
  segBtnActive: { backgroundColor: ElixColors.blue },
  segBtnText: { fontSize: 13, fontWeight: '600', color: ElixColors.inkMuted },
  segBtnTextActive: { color: '#fff' },
  input: { borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: ElixRadii.sm, padding: 10, fontSize: 14, color: ElixColors.ink, backgroundColor: '#fff', marginBottom: 12 },
  formActions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  cancelBtn: { flex: 1, paddingVertical: 10, borderRadius: ElixRadii.md, borderWidth: 1.5, borderColor: '#E5E7EB', alignItems: 'center' },
  cancelBtnText: { fontSize: 14, fontWeight: '600', color: ElixColors.inkMuted },
  saveBtn: { flex: 2, paddingVertical: 10, borderRadius: ElixRadii.md, backgroundColor: ElixColors.blue, alignItems: 'center' },
  saveBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  nextBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: ElixColors.blue, borderRadius: ElixRadii.lg, paddingVertical: 14, marginTop: 16, marginBottom: 8 },
  nextBtnDisabled: { opacity: 0.45 },
  nextBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
