import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ElixColors, ElixRadii, ElixTypography, ElixShadows } from '@/constants/theme';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useBeauticians } from '@/hooks/useBeauticians';
import type { Beautician } from '@/types/api';

// Curated verified specialists list with fallbacks for showcase
const FALLBACK_BEAUTICIANS: Beautician[] = [
  {
    slug: 'pooja-sharma',
    name: 'Pooja Sharma',
    specialties: 'Organic Facials, O3+ Treatments, Glow Rituals',
    rating: 4.9,
    reviews: 142,
    skills: ['O3+ Bridal Glow', 'Fruit Detan', 'Face Massage', 'Cleanups'],
    experience_years: 6,
    photo: 'http://localhost:8003/static/images/artist-2.jpg',
  },
  {
    slug: 'priya-verma',
    name: 'Priya Verma',
    specialties: 'RICA Italian Waxing, Threading & Detan',
    rating: 5.0,
    reviews: 98,
    skills: ['RICA White Chocolate', 'Honey Wax', 'Pain-Free Threading'],
    experience_years: 5,
    photo: 'http://localhost:8003/static/images/artist-3.jpg',
  },
  {
    slug: 'neha-patel',
    name: 'Neha Patel',
    specialties: "L'Oréal Hair Spa, Keratin Care & Head Massage",
    rating: 4.8,
    reviews: 86,
    skills: ['Deep Conditioning', 'Scalp Therapy', 'Blowdry & Styling'],
    experience_years: 4,
    photo: 'http://localhost:8003/static/images/artist-4.jpg',
  },
  {
    slug: 'ananya-joshi',
    name: 'Ananya Joshi',
    specialties: 'Bridal Makeovers & Luxury Nail Art Manicure',
    rating: 4.9,
    reviews: 110,
    skills: ['HD Bridal Makeup', 'Gel Polish', 'Luxury Pedicure'],
    experience_years: 7,
    photo: 'http://localhost:8003/static/images/artist-1.jpg',
  },
];

const SPECIALTY_FILTERS = ['All', 'Facial & Glow', 'Waxing', 'Hair Spa', 'Bridal'];

export default function BeauticiansScreen() {
  const { data: apiBeauticians, isLoading } = useBeauticians();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');

  // Merge backend data with fallback profiles so screen is always rich and populated
  const allBeauticians: Beautician[] = React.useMemo(() => {
    if (!apiBeauticians || apiBeauticians.length === 0) {
      return FALLBACK_BEAUTICIANS;
    }
    // Combine API beauticians with fallbacks, deduping by slug
    const seen = new Set<string>();
    const merged: Beautician[] = [];
    for (const b of apiBeauticians) {
      seen.add(b.slug);
      merged.push({
        ...b,
        photo: b.photo?.startsWith('http') ? b.photo : `http://localhost:8003${b.photo}`,
      });
    }
    for (const f of FALLBACK_BEAUTICIANS) {
      if (!seen.has(f.slug)) {
        merged.push(f);
      }
    }
    return merged;
  }, [apiBeauticians]);

  const filteredBeauticians = allBeauticians.filter((b) => {
    const matchesSearch =
      b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.specialties.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.skills.some((s) => s.toLowerCase().includes(searchQuery.toLowerCase()));

    if (activeFilter === 'All') return matchesSearch;
    if (activeFilter === 'Facial & Glow') {
      return matchesSearch && (b.specialties.toLowerCase().includes('facial') || b.specialties.toLowerCase().includes('glow'));
    }
    if (activeFilter === 'Waxing') {
      return matchesSearch && b.specialties.toLowerCase().includes('wax');
    }
    if (activeFilter === 'Hair Spa') {
      return matchesSearch && (b.specialties.toLowerCase().includes('hair') || b.specialties.toLowerCase().includes('spa'));
    }
    if (activeFilter === 'Bridal') {
      return matchesSearch && (b.specialties.toLowerCase().includes('bridal') || b.specialties.toLowerCase().includes('makeup'));
    }
    return matchesSearch;
  });

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* 1. Header Bar */}
      <View style={styles.headerBar}>
        <Pressable
          style={styles.backButton}
          onPress={() => router.back()}
          hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color={ElixColors.ink} />
        </Pressable>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Our Beauticians</Text>
          <Text style={styles.headerSubtitle}>Indore’s Verified Senior Specialists</Text>
        </View>
        <View style={styles.headerBadge}>
          <Ionicons name="shield-checkmark" size={14} color={ElixColors.green} />
          <Text style={styles.headerBadgeText}>100% Vetted</Text>
        </View>
      </View>

      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}>
        {/* 2. Trust Promise Strip */}
        <View style={styles.promiseBanner}>
          <View style={styles.promiseItem}>
            <Ionicons name="finger-print-outline" size={18} color={ElixColors.blue} />
            <Text style={styles.promiseText}>Police & ID Verified</Text>
          </View>
          <View style={styles.promiseDivider} />
          <View style={styles.promiseItem}>
            <Ionicons name="ribbon-outline" size={18} color={ElixColors.blue} />
            <Text style={styles.promiseText}>4+ Yrs Salon Exp</Text>
          </View>
          <View style={styles.promiseDivider} />
          <View style={styles.promiseItem}>
            <Ionicons name="sparkles-outline" size={18} color={ElixColors.blue} />
            <Text style={styles.promiseText}>Monodose Kits</Text>
          </View>
        </View>

        {/* 3. Search Input */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={18} color={ElixColors.inkMuted} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by artist name or specialty (e.g. Facial, Waxing)..."
            placeholderTextColor={ElixColors.inkMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={ElixColors.inkMuted} />
            </Pressable>
          )}
        </View>

        {/* 4. Filter Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterPillsContainer}>
          {SPECIALTY_FILTERS.map((filter) => {
            const isActive = activeFilter === filter;
            return (
              <Pressable
                key={filter}
                style={[styles.filterPill, isActive && styles.filterPillActive]}
                onPress={() => setActiveFilter(filter)}>
                <Text style={[styles.filterPillText, isActive && styles.filterPillTextActive]}>
                  {filter}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* 5. Beautician Cards List */}
        {isLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={ElixColors.blue} />
            <Text style={styles.loadingText}>Loading certified artists...</Text>
          </View>
        ) : filteredBeauticians.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Ionicons name="person-outline" size={48} color={ElixColors.inkMuted} />
            <Text style={styles.emptyTitle}>No specialists found</Text>
            <Text style={styles.emptyDesc}>Try searching for a different service or specialty.</Text>
          </View>
        ) : (
          filteredBeauticians.map((artist) => (
            <View key={artist.slug} style={styles.artistCard}>
              <View style={styles.artistTopRow}>
                {/* Photo / Avatar */}
                <View style={styles.photoContainer}>
                  {artist.photo ? (
                    <Image
                      source={{ uri: artist.photo }}
                      style={styles.artistPhoto}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.avatarFallback}>
                      <Ionicons name="person" size={28} color={ElixColors.blue} />
                    </View>
                  )}
                  <View style={styles.verifiedDot}>
                    <Ionicons name="checkmark" size={10} color={ElixColors.white} />
                  </View>
                </View>

                {/* Info Column */}
                <View style={styles.artistMeta}>
                  <View style={styles.nameRow}>
                    <Text style={styles.artistName}>{artist.name}</Text>
                    <View style={styles.ratingBadge}>
                      <Ionicons name="star" size={12} color={ElixColors.blue} />
                      <Text style={styles.ratingText}>{Number(artist.rating).toFixed(1)}</Text>
                    </View>
                  </View>

                  <Text style={styles.specialtyText} numberOfLines={2}>
                    {artist.specialties}
                  </Text>

                  <View style={styles.experienceRow}>
                    <View style={styles.pillChip}>
                      <Ionicons name="time-outline" size={12} color={ElixColors.inkSoft} />
                      <Text style={styles.pillChipText}>{artist.experience_years} yrs exp</Text>
                    </View>
                    <View style={styles.pillChip}>
                      <Ionicons name="chatbubble-ellipses-outline" size={12} color={ElixColors.inkSoft} />
                      <Text style={styles.pillChipText}>{artist.reviews} reviews</Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Skills Chips */}
              {artist.skills && artist.skills.length > 0 && (
                <View style={styles.skillsRow}>
                  {artist.skills.map((skill, idx) => (
                    <View key={idx} style={styles.skillTag}>
                      <Text style={styles.skillTagText}>{skill}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Trust & Action Footer */}
              <View style={styles.cardFooter}>
                <View style={styles.safetyGuarantee}>
                  <Ionicons name="shield-checkmark-outline" size={14} color={ElixColors.green} />
                  <Text style={styles.safetyText}>Indore Verified Specialist</Text>
                </View>
                <Button
                  title="Book Services"
                  size="sm"
                  onPress={() => router.push('/services')}
                />
              </View>
            </View>
          ))
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: ElixColors.surface1,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: ElixColors.white,
    borderBottomWidth: 1,
    borderBottomColor: ElixColors.borderHairline,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: ElixRadii.full,
    backgroundColor: ElixColors.surface2,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: ElixTypography.sizes.lg,
    fontWeight: ElixTypography.weights.bold,
    color: ElixColors.ink,
  },
  headerSubtitle: {
    fontSize: ElixTypography.sizes.xs,
    color: ElixColors.inkMuted,
  },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: ElixRadii.full,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  headerBadgeText: {
    fontSize: 11,
    fontWeight: ElixTypography.weights.bold,
    color: ElixColors.green,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  promiseBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: ElixColors.ink,
    borderRadius: ElixRadii.lg,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  promiseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  promiseText: {
    fontSize: 11,
    fontWeight: ElixTypography.weights.medium,
    color: ElixColors.white,
  },
  promiseDivider: {
    width: 1,
    height: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ElixColors.white,
    borderRadius: ElixRadii.full,
    paddingHorizontal: 14,
    height: 44,
    borderWidth: 1,
    borderColor: ElixColors.borderHairline,
    marginBottom: 12,
    ...ElixShadows.sm,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: ElixTypography.sizes.sm,
    color: ElixColors.ink,
  },
  filterPillsContainer: {
    gap: 8,
    paddingBottom: 14,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: ElixRadii.full,
    backgroundColor: ElixColors.white,
    borderWidth: 1,
    borderColor: ElixColors.borderHairline,
  },
  filterPillActive: {
    backgroundColor: ElixColors.ink,
    borderColor: ElixColors.ink,
  },
  filterPillText: {
    fontSize: ElixTypography.sizes.xs,
    fontWeight: ElixTypography.weights.medium,
    color: ElixColors.inkSoft,
  },
  filterPillTextActive: {
    color: ElixColors.white,
    fontWeight: ElixTypography.weights.bold,
  },
  loadingWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: 12,
  },
  loadingText: {
    fontSize: ElixTypography.sizes.sm,
    color: ElixColors.inkMuted,
  },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: 8,
  },
  emptyTitle: {
    fontSize: ElixTypography.sizes.md,
    fontWeight: ElixTypography.weights.bold,
    color: ElixColors.ink,
  },
  emptyDesc: {
    fontSize: ElixTypography.sizes.sm,
    color: ElixColors.inkMuted,
  },
  artistCard: {
    backgroundColor: ElixColors.white,
    borderRadius: ElixRadii.xl,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: ElixColors.borderHairline,
    ...ElixShadows.sm,
  },
  artistTopRow: {
    flexDirection: 'row',
    gap: 14,
  },
  photoContainer: {
    position: 'relative',
    width: 68,
    height: 68,
  },
  artistPhoto: {
    width: 68,
    height: 68,
    borderRadius: ElixRadii.full,
    backgroundColor: ElixColors.surface2,
  },
  avatarFallback: {
    width: 68,
    height: 68,
    borderRadius: ElixRadii.full,
    backgroundColor: ElixColors.surface2,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: ElixColors.borderHairline,
  },
  verifiedDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 18,
    height: 18,
    borderRadius: ElixRadii.full,
    backgroundColor: ElixColors.green,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: ElixColors.white,
  },
  artistMeta: {
    flex: 1,
    justifyContent: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 3,
  },
  artistName: {
    fontSize: ElixTypography.sizes.md,
    fontWeight: ElixTypography.weights.bold,
    color: ElixColors.ink,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: ElixColors.blueLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: ElixRadii.full,
  },
  ratingText: {
    fontSize: 11,
    fontWeight: ElixTypography.weights.bold,
    color: '#B45309',
  },
  specialtyText: {
    fontSize: ElixTypography.sizes.xs,
    color: ElixColors.inkSoft,
    lineHeight: 16,
    marginBottom: 8,
  },
  experienceRow: {
    flexDirection: 'row',
    gap: 8,
  },
  pillChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: ElixColors.surface2,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: ElixRadii.sm,
  },
  pillChipText: {
    fontSize: 10,
    fontWeight: ElixTypography.weights.medium,
    color: ElixColors.inkSoft,
  },
  skillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: ElixColors.borderHairline,
  },
  skillTag: {
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: ElixRadii.sm,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  skillTagText: {
    fontSize: 10,
    color: ElixColors.inkSoft,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: ElixColors.borderHairline,
  },
  safetyGuarantee: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  safetyText: {
    fontSize: 11,
    fontWeight: ElixTypography.weights.medium,
    color: ElixColors.green,
  },
});
