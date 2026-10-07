import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ElixColors, ElixRadii, ElixShadows } from '@/constants/theme';
import { useBookingFlowStore } from '@/store/bookingFlowStore';
import { useAuthStore } from '@/store/authStore';
import { useAddresses, useAddAddress } from '@/hooks/useProfile';
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
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');

  async function handleAddNew() {
    setError('');
    if (!newText.trim()) { setError('Enter your full address.'); return; }
    if (newPincode && (newPincode.length !== 6 || isNaN(Number(newPincode)))) {
      setError('Enter a valid 6-digit pincode.'); return;
    }
    setAdding(true);
    try {
      const res = await addAddress.mutateAsync({ label: newLabel || 'Home', text: newText.trim(), pincode: newPincode, lat: null, lng: null });
      setAddress((res.data as any).address as Address);
      setShowAddForm(false);
      setNewText(''); setNewPincode('');
    } catch {
      setError('Could not save address. Try again.');
    } finally { setAdding(false); }
  }

  const canProceed = !!selectedAddress;

  return (
    <View style={styles.container}>
      <Text style={styles.stepTitle}>Where should the artist come?</Text>
      <Text style={styles.stepSubtitle}>Choose a saved address or add a new one</Text>

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
                  <Text style={styles.addrLabel}>{addr.label}</Text>
                  <Text style={styles.addrText}>{addr.text}</Text>
                  {addr.pincode ? <Text style={styles.addrPincode}>{addr.pincode}</Text> : null}
                </View>
                <Ionicons name="home" size={16} color={selected ? ElixColors.blue : ElixColors.inkMuted} />
              </Pressable>
            );
          })}

          {!showAddForm ? (
            <Pressable style={styles.addNewBtn} onPress={() => setShowAddForm(true)}>
              <Ionicons name="add-circle-outline" size={18} color={ElixColors.blue} />
              <Text style={styles.addNewText}>Add New Address</Text>
            </Pressable>
          ) : (
            <View style={styles.addForm}>
              <Text style={styles.formTitle}>New Address</Text>
              {error ? <Text style={styles.errorText}>{error}</Text> : null}

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

              <Text style={styles.label}>Full Address</Text>
              <TextInput
                style={styles.input}
                value={newText}
                onChangeText={setNewText}
                placeholder="Flat/House, Street, Area, City"
                placeholderTextColor="#9CA3AF"
                multiline
              />

              <Text style={styles.label}>Pincode</Text>
              <TextInput
                style={styles.input}
                value={newPincode}
                onChangeText={setNewPincode}
                placeholder="452010"
                placeholderTextColor="#9CA3AF"
                keyboardType="number-pad"
                maxLength={6}
              />

              <View style={styles.formActions}>
                <Pressable style={styles.cancelBtn} onPress={() => { setShowAddForm(false); setError(''); }}>
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
  addrLabel: { fontSize: 13, fontWeight: '700', color: ElixColors.ink, marginBottom: 2 },
  addrText: { fontSize: 13, color: ElixColors.inkMuted, lineHeight: 18 },
  addrPincode: { fontSize: 11, color: ElixColors.inkMuted, marginTop: 2 },
  addNewBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 14, borderRadius: ElixRadii.md, borderWidth: 1.5, borderColor: ElixColors.blue, borderStyle: 'dashed', justifyContent: 'center', marginBottom: 8 },
  addNewText: { color: ElixColors.blue, fontWeight: '600', fontSize: 14 },
  addForm: { backgroundColor: '#F8FAFC', borderRadius: ElixRadii.lg, padding: 16, marginBottom: 8, borderWidth: 1, borderColor: '#E5E7EB' },
  formTitle: { fontSize: 15, fontWeight: '700', color: ElixColors.ink, marginBottom: 12 },
  errorText: { color: '#DC2626', fontSize: 12, marginBottom: 8 },
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
