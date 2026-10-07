import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ElixColors, ElixRadii, ElixTypography, ElixShadows } from '@/constants/theme';
import { Header } from '@/components/ui/Header';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

// Mock service categories matching Elix catalog
const CATEGORIES = [
  { id: '1', name: 'Facial & Cleanup', icon: 'sparkles', slug: 'facial-cleanup', count: '12 Services' },
  { id: '2', name: 'Hair Care & Spa', icon: 'cut-outline', slug: 'hair-care', count: '8 Services' },
  { id: '3', name: 'Waxing & Threading', icon: 'flower-outline', slug: 'waxing', count: '15 Services' },
  { id: '4', name: 'Manicure & Pedicure', icon: 'hand-left-outline', slug: 'manicure-pedicure', count: '6 Services' },
  { id: '5', name: 'Bridal & Makeup', icon: 'heart-outline', slug: 'bridal', count: '5 Packages' },
  { id: '6', name: 'Bleach & Detan', icon: 'sunny-outline', slug: 'bleach-detan', count: '7 Services' },
];

const PACKAGES = [
  {
    id: 'p1',
    name: 'Glow & Radiance Special',
    price: 1199,
    originalPrice: 1799,
    discount: '33% OFF',
    duration: '90 mins',
    items: ['O3+ Bridal Glow Facial', 'Full Arms Waxing', 'Eyebrow & Upper Lip Threading'],
  },
  {
    id: 'p2',
    name: 'Complete Head-to-Toe Relax',
    price: 1699,
    originalPrice: 2499,
    discount: '32% OFF',
    duration: '120 mins',
    items: ['L\'Oreal Hair Spa', 'Express Pedicure', 'Fruit Detan Pack'],
  },
];

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Header
        location="Indore, MP"
        onLocationPress={() => {}}
        onSearchPress={() => router.push('/services')}
        onCartPress={() => {}}
        cartItemCount={0}
      />

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* 1. Hero Promo Banner */}
        <View style={styles.heroBanner}>
          <Badge label="★ 4.9 (1,200+ INDORE REVIEWS)" variant="discount" style={{ marginBottom: 8 }} />
          <Text style={styles.heroTitle}>Luxury Salon Services at Your Doorstep</Text>
          <Text style={styles.heroSubtitle}>
            Hygienic single-use kits, background-verified senior beauticians in Indore.
          </Text>
          <View style={styles.heroActions}>
            <Button
              title="Explore Services"
              size="sm"
              onPress={() => router.push('/services')}
            />
          </View>
        </View>

        {/* 2. Express 50-Min Urgent Callout */}
        <Pressable
          style={styles.urgentCard}
          onPress={() => router.push('/urgent')}>
          <View style={styles.urgentHeader}>
            <View style={styles.urgentTitleRow}>
              <Ionicons name="flash" size={18} color={ElixColors.urgentRed} />
              <Text style={styles.urgentTitle}>50-Minute Express Urgent Service</Text>
            </View>
            <Badge label="+₹99 Express Fee" variant="urgent" />
          </View>
          <Text style={styles.urgentDesc}>
            Need salon service urgently? Dedicated artist dispatched to your door in Indore within 50 minutes.
          </Text>
          <View style={styles.urgentFooter}>
            <Text style={styles.urgentLink}>View Express Slots</Text>
            <Ionicons name="arrow-forward" size={14} color={ElixColors.urgentRed} />
          </View>
        </Pressable>

        {/* 3. Categories Grid */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Service Categories</Text>
            <Pressable onPress={() => router.push('/services')}>
              <Text style={styles.viewAllText}>View All</Text>
            </Pressable>
          </View>

          <View style={styles.categoryGrid}>
            {CATEGORIES.map((cat) => (
              <Pressable
                key={cat.id}
                style={styles.categoryCard}
                onPress={() => router.push('/services')}>
                <View style={styles.categoryIconWrap}>
                  <Ionicons name={cat.icon as any} size={24} color={ElixColors.blue} />
                </View>
                <Text style={styles.categoryName} numberOfLines={2}>
                  {cat.name}
                </Text>
                <Text style={styles.categoryCount}>{cat.count}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* 4. Curated Packages */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Curated Luxury Packages</Text>
          </View>

          {PACKAGES.map((pkg) => (
            <View key={pkg.id} style={styles.packageCard}>
              <View style={styles.packageHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.packageName}>{pkg.name}</Text>
                  <Text style={styles.packageDuration}>⏱ {pkg.duration}</Text>
                </View>
                <Badge label={pkg.discount} variant="discount" />
              </View>

              <View style={styles.packageItems}>
                {pkg.items.map((item, idx) => (
                  <View key={idx} style={styles.packageItemRow}>
                    <Ionicons name="checkmark-circle" size={14} color={ElixColors.green} />
                    <Text style={styles.packageItemText}>{item}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.packageFooter}>
                <View style={styles.packagePriceRow}>
                  <Text style={styles.packagePrice}>₹{pkg.price}</Text>
                  <Text style={styles.packageOriginalPrice}>₹{pkg.originalPrice}</Text>
                </View>
                <Button
                  title="+ Add"
                  size="sm"
                  variant="outline"
                  onPress={() => router.push('/services')}
                />
              </View>
            </View>
          ))}
        </View>

        {/* 5. Trust Pillars */}
        <View style={styles.trustSection}>
          <Text style={styles.trustTitle}>The Elix Hygiene Promise</Text>
          <View style={styles.trustRow}>
            <View style={styles.trustPillar}>
              <Ionicons name="shield-checkmark" size={24} color={ElixColors.green} />
              <Text style={styles.trustPillarTitle}>100% Sealed Kits</Text>
              <Text style={styles.trustPillarDesc}>Single-use tools opened in front of you</Text>
            </View>
            <View style={styles.trustPillar}>
              <Ionicons name="person-circle-outline" size={24} color={ElixColors.blue} />
              <Text style={styles.trustPillarTitle}>Certified Artists</Text>
              <Text style={styles.trustPillarDesc}>Background-checked salon professionals</Text>
            </View>
          </View>
        </View>

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
  container: {
    flex: 1,
  },
  heroBanner: {
    backgroundColor: ElixColors.ink,
    padding: 20,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: ElixRadii.xl,
  },
  heroTitle: {
    color: ElixColors.white,
    fontSize: ElixTypography.sizes.xl,
    fontWeight: ElixTypography.weights.bold,
    lineHeight: 28,
    marginBottom: 6,
  },
  heroSubtitle: {
    color: '#94A3B8',
    fontSize: ElixTypography.sizes.sm,
    lineHeight: 20,
    marginBottom: 16,
  },
  heroActions: {
    flexDirection: 'row',
  },
  urgentCard: {
    backgroundColor: ElixColors.urgentRedLight,
    borderWidth: 1,
    borderColor: ElixColors.urgentBorder,
    borderRadius: ElixRadii.lg,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 12,
  },
  urgentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  urgentTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  urgentTitle: {
    color: ElixColors.urgentRed,
    fontWeight: ElixTypography.weights.bold,
    fontSize: ElixTypography.sizes.md,
  },
  urgentDesc: {
    color: '#7F1D1D',
    fontSize: ElixTypography.sizes.sm,
    lineHeight: 18,
    marginBottom: 10,
  },
  urgentFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  urgentLink: {
    color: ElixColors.urgentRed,
    fontWeight: ElixTypography.weights.bold,
    fontSize: ElixTypography.sizes.sm,
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: ElixTypography.sizes.lg,
    fontWeight: ElixTypography.weights.bold,
    color: ElixColors.ink,
  },
  viewAllText: {
    fontSize: ElixTypography.sizes.sm,
    fontWeight: ElixTypography.weights.semiBold,
    color: ElixColors.blue,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  categoryCard: {
    width: '30.5%',
    backgroundColor: ElixColors.surface2,
    borderRadius: ElixRadii.lg,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: ElixColors.borderHairline,
    ...ElixShadows.sm,
  },
  categoryIconWrap: {
    width: 46,
    height: 46,
    borderRadius: ElixRadii.pill,
    backgroundColor: ElixColors.blueLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  categoryName: {
    fontSize: 12,
    fontWeight: ElixTypography.weights.semiBold,
    color: ElixColors.ink,
    textAlign: 'center',
    minHeight: 32,
  },
  categoryCount: {
    fontSize: 10,
    color: ElixColors.inkMuted,
    marginTop: 2,
  },
  packageCard: {
    backgroundColor: ElixColors.surface2,
    borderRadius: ElixRadii.lg,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: ElixColors.borderHairline,
    ...ElixShadows.sm,
  },
  packageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  packageName: {
    fontSize: ElixTypography.sizes.md,
    fontWeight: ElixTypography.weights.bold,
    color: ElixColors.ink,
  },
  packageDuration: {
    fontSize: 12,
    color: ElixColors.inkMuted,
    marginTop: 2,
  },
  packageItems: {
    gap: 6,
    marginBottom: 14,
  },
  packageItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  packageItemText: {
    fontSize: ElixTypography.sizes.sm,
    color: ElixColors.inkSoft,
  },
  packageFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: ElixColors.borderHairline,
    paddingTop: 12,
  },
  packagePriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  packagePrice: {
    fontSize: ElixTypography.sizes.lg,
    fontWeight: ElixTypography.weights.bold,
    color: ElixColors.ink,
  },
  packageOriginalPrice: {
    fontSize: ElixTypography.sizes.sm,
    color: ElixColors.inkMuted,
    textDecorationLine: 'line-through',
  },
  trustSection: {
    marginHorizontal: 16,
    marginTop: 24,
    backgroundColor: ElixColors.surface2,
    borderRadius: ElixRadii.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: ElixColors.borderHairline,
  },
  trustTitle: {
    fontSize: ElixTypography.sizes.md,
    fontWeight: ElixTypography.weights.bold,
    color: ElixColors.ink,
    marginBottom: 12,
    textAlign: 'center',
  },
  trustRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: 12,
  },
  trustPillar: {
    flex: 1,
    alignItems: 'center',
    textAlign: 'center',
  },
  trustPillarTitle: {
    fontSize: 12,
    fontWeight: ElixTypography.weights.bold,
    color: ElixColors.ink,
    marginTop: 6,
    marginBottom: 2,
  },
  trustPillarDesc: {
    fontSize: 11,
    color: ElixColors.inkMuted,
    textAlign: 'center',
  },
});
