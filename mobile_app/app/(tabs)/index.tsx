import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ElixColors, ElixRadii, ElixTypography, ElixShadows } from '@/constants/theme';
import { Header } from '@/components/ui/Header';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useHome } from '@/hooks/useHome';
import { useCatalog } from '@/hooks/useCatalog';
import { useOffers } from '@/hooks/useOffers';
import { useBeauticians } from '@/hooks/useBeauticians';
import { useCartStore } from '@/store/cartStore';
import type { Category, Beautician } from '@/types/api';

// ─── STATIC CONTENT ──────────────────────────────────────────────────────────
// These are truly static and do not change based on DB:

/** Icon map: slug → Ionicons name. Add new slugs as categories grow. */
const CATEGORY_ICON_MAP: Record<string, string> = {
  threading:          'cut-outline',
  waxing:             'flower-outline',
  'body-wax':         'flower-outline',
  facial:             'sparkles',
  cleanup:            'sparkles',
  'facial-cleanup':   'sparkles',
  'hair-care':        'cut-outline',
  'hair-spa':         'cut-outline',
  manicure:           'hand-left-outline',
  pedicure:           'hand-left-outline',
  'manicure-pedicure':'hand-left-outline',
  bridal:             'heart-outline',
  makeup:             'heart-outline',
  bleach:             'sunny-outline',
  detan:              'sunny-outline',
  'bleach-detan':     'sunny-outline',
  massage:            'body-outline',
  packages:           'gift-outline',
};

/** Offer banner images — mapped by code. Falls back to service-facial.jpg. */
const OFFER_IMAGE_MAP: Record<string, string> = {
  BUNDLE20:     '/static/images/service-facial.jpg',
  WEEKDAY15:    '/static/images/service-hair-spa.jpg',
  GLAM10:       '/static/images/service-bridal-makeup.jpg',
  ELIXEXPRESS:  '/static/images/hero-bg.jpg',
};

/** How It Works step icon map — backend returns icon slugs, we map to Ionicons. */
const HIW_ICON_MAP: Record<string, string> = {
  select:  'sparkles-outline',
  match:   'shield-checkmark-outline',
  arrive:  'key-outline',
  ritual:  'flower-outline',
  rebook:  'star-outline',
};

/** Fallback beauticians shown when no active staff records exist yet. */
const FALLBACK_BEAUTICIANS: Beautician[] = [
  { slug: 'pooja', name: 'Pooja Sharma',    specialties: 'Organic Facials & O3+',       rating: 4.9, reviews: 142, skills: [], experience_years: 6, photo: '/static/images/artist-2.jpg' },
  { slug: 'priya', name: 'Priya Verma',     specialties: 'RICA Italian Waxing',          rating: 5.0, reviews: 98,  skills: [], experience_years: 5, photo: '/static/images/artist-3.jpg' },
  { slug: 'neha',  name: 'Neha Patel',      specialties: "L'Oréal Hair Spa & Scalp",    rating: 4.8, reviews: 86,  skills: [], experience_years: 4, photo: '/static/images/artist-4.jpg' },
];

// ─── HELPERS ─────────────────────────────────────────────────────────────────

/** Prepend the base Django server URL if the path is relative (from /static/). */
function resolveImageUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `http://localhost:8003${path}`;
}

function getCategoryIcon(slug: string): string {
  return CATEGORY_ICON_MAP[slug] ?? 'grid-outline';
}

function getOfferImage(code: string): string {
  const path = OFFER_IMAGE_MAP[code] ?? '/static/images/service-facial.jpg';
  return `http://localhost:8003${path}`;
}

function getHiwIcon(iconSlug: string): string {
  return HIW_ICON_MAP[iconSlug] ?? 'ellipse-outline';
}

/** Extract discount % from a catalog package, formatted as "XX% OFF". */
function discountLabel(price: number, mrp: number): string | null {
  if (!mrp || mrp <= price) return null;
  const pct = Math.round(((mrp - price) / mrp) * 100);
  return `${pct}% OFF`;
}

// ─── SCREEN ──────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const cartCount = useCartStore((s) => s.items.reduce((n, i) => n + i.quantity, 0));

  // ── DATA HOOKS ──────────────────────────────────────────────────────────────
  const {
    data: homeData,
    isLoading: homeLoading,
    refetch: refetchHome,
  } = useHome();

  const {
    data: allCatalog,
    isLoading: catalogLoading,
    refetch: refetchCatalog,
  } = useCatalog();

  const {
    data: offersData,
    isLoading: offersLoading,
    refetch: refetchOffers,
  } = useOffers();

  const {
    data: beauticiansData,
    isLoading: beauticiansLoading,
    refetch: refetchBeauticians,
  } = useBeauticians();

  const isRefreshing = homeLoading || catalogLoading || offersLoading || beauticiansLoading;

  const onRefresh = () => {
    refetchHome();
    refetchCatalog();
    refetchOffers();
    refetchBeauticians();
  };

  // ── DERIVED DATA ────────────────────────────────────────────────────────────

  /** Categories from /api/v1/home/ */
  const categories = homeData?.categories ?? [];

  /** Packages from /api/v1/catalog/ */
  const packages = (allCatalog ?? []).filter((item) => item.kind === 'package').slice(0, 4);

  /** Active offers from /api/v1/offers/ */
  const offers = offersData ?? [];

  /** How It Works steps from /api/v1/home/ */
  const hiwSteps = homeData?.how_it_works ?? [];

  /** Beauticians from /api/v1/beauticians/ — fallback if backend has no staff yet */
  const beauticians: Beautician[] =
    beauticiansData && beauticiansData.length > 0 ? beauticiansData : FALLBACK_BEAUTICIANS;

  /** Hero from /api/v1/home/ */
  const hero = homeData?.hero;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Header
        location="Indore, MP"
        onLocationPress={() => {}}
        onSearchPress={() => router.push({ pathname: '/(tabs)/services', params: { autoSearch: '1' } })}
        onCartPress={() => router.push({ pathname: '/(tabs)/services', params: { openCart: '1' } })}
        cartItemCount={cartCount}
      />

      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={ElixColors.blue}
            colors={[ElixColors.blue]}
          />
        }>

        {/* ── 1. HERO BANNER (Dynamic from /api/v1/home/) ── */}
        {homeLoading ? (
          <View style={[styles.heroBanner, styles.skeletonCard]}>
            <ActivityIndicator color={ElixColors.blue} />
          </View>
        ) : (
          <View style={styles.heroBanner}>
            <Badge label="★ 4.9 (1,200+ INDORE REVIEWS)" variant="discount" style={{ marginBottom: 8 }} />
            {/* headline_lines comes from the Hero CMS record */}
            <Text style={styles.heroTitle}>
              {hero?.headline_lines?.join(' ') ?? 'Luxury Salon Services at Your Doorstep'}
            </Text>
            <Text style={styles.heroSubtitle}>
              {hero?.subhead ?? 'Hygienic single-use kits, background-verified senior beauticians in Indore.'}
            </Text>
            <View style={styles.heroActions}>
              <Button
                title="Explore Services"
                size="sm"
                onPress={() => router.push('/services')}
              />
            </View>
          </View>
        )}

        {/* ── 2. EXPRESS 50-MIN CARD ─────────────────────────────────────────── */}
        {/* STATIC: The express service offering is a fixed product (₹99 express fee).
            This card's content is product-defined, not CMS-driven. */}
        <View style={styles.redesignedUrgentCard}>
          <View style={styles.urgentTopBar}>
            <View style={styles.urgentPillBadge}>
              <View style={styles.urgentLiveDot} />
              <Text style={styles.urgentPillText}>EXPRESS DISPATCH</Text>
            </View>
            <View style={styles.urgentFeeChip}>
              <Ionicons name="flash" size={13} color={ElixColors.blue} />
              <Text style={styles.urgentFeeText}>+₹99 Priority Fee</Text>
            </View>
          </View>

          <Text style={styles.urgentMainHeading}>50-Minute Doorstep Delivery</Text>
          <Text style={styles.urgentMainSubheading}>
            Need salon service urgently? A dedicated certified artist is dispatched to your door in Indore within 50 minutes.
          </Text>

          <View style={styles.urgentPerksRow}>
            <View style={styles.urgentPerkItem}>
              <Ionicons name="time" size={14} color={ElixColors.blue} />
              <Text style={styles.urgentPerkText}>50m Arrival</Text>
            </View>
            <View style={styles.urgentPerkItem}>
              <Ionicons name="shield-checkmark" size={14} color={ElixColors.blue} />
              <Text style={styles.urgentPerkText}>Sealed Kit</Text>
            </View>
            <View style={styles.urgentPerkItem}>
              <Ionicons name="location" size={14} color={ElixColors.blue} />
              <Text style={styles.urgentPerkText}>All Indore</Text>
            </View>
          </View>
        </View>

        {/* ── 3. OFFERS — Dynamic from /api/v1/offers/ ──────────────────────── */}
        {offers.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>Exclusive Offers & Deals</Text>
                <Text style={styles.sectionSubtitle}>Swipe for limited-time salon savings</Text>
              </View>
              <Badge label="Active Coupons" variant="urgent" />
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.offersScrollContainer}>
              {offersLoading ? (
                <View style={[styles.offerCard, styles.skeletonCard]}>
                  <ActivityIndicator color={ElixColors.white} />
                </View>
              ) : (
                offers.map((offer, idx) => (
                  <Pressable
                    key={offer.code}
                    style={styles.offerCard}
                    onPress={() => router.push('/services')}>
                    <Image
                      source={{ uri: getOfferImage(offer.code) }}
                      style={styles.offerImage}
                      resizeMode="cover"
                    />
                    <View style={styles.offerOverlay} />
                    <View style={styles.offerContent}>
                      {/* Discount badge derived from title (e.g. "20% off …" → "20% OFF") */}
                      <View style={styles.offerBadge}>
                        <Text style={styles.offerBadgeText}>
                          {offer.title.match(/\d+%/)?.[0]?.toUpperCase() ?? 'DEAL'}
                        </Text>
                      </View>
                      <Text style={styles.offerTitle} numberOfLines={2}>{offer.title}</Text>
                      <Text style={styles.offerDesc} numberOfLines={2}>{offer.description}</Text>
                      <View style={styles.offerCouponRow}>
                        <Ionicons name="pricetag-outline" size={13} color={ElixColors.blue} />
                        <Text style={styles.offerCouponCode}>CODE: {offer.code}</Text>
                        <Text style={styles.offerTapToApply}>Tap to apply →</Text>
                      </View>
                    </View>
                  </Pressable>
                ))
              )}
            </ScrollView>
          </View>
        )}

        {/* ── 4. CATEGORIES — Dynamic from /api/v1/home/ ────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Service Categories</Text>
            <Pressable onPress={() => router.push('/services')}>
              <Text style={styles.viewAllText}>View All</Text>
            </Pressable>
          </View>

          {catalogLoading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={ElixColors.blue} />
              <Text style={styles.loadingText}>Loading services...</Text>
            </View>
          ) : (
            <View style={styles.categoryGrid}>
              {categories.map((cat: Category) => (
                <Pressable
                  key={cat.slug}
                  style={styles.categoryCard}
                  onPress={() => router.push('/services')}>
                  <View style={styles.categoryIconWrap}>
                    <Ionicons
                      name={getCategoryIcon(cat.slug) as any}
                      size={24}
                      color={ElixColors.blue}
                    />
                  </View>
                  <Text style={styles.categoryName} numberOfLines={2}>
                    {cat.name}
                  </Text>
                  {/* services_count is the real count from the DB */}
                  {'services_count' in cat && (
                    <Text style={styles.categoryCount}>
                      {(cat as any).services_count} Services
                    </Text>
                  )}
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {/* ── 5. CURATED PACKAGES — Dynamic from /api/v1/catalog/?kind=package ── */}
        {packages.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Curated Luxury Packages</Text>
            </View>

            {catalogLoading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color={ElixColors.blue} />
              </View>
            ) : (
              packages.map((pkg) => {
                const label = discountLabel(pkg.price, pkg.original_price ?? 0);
                const includedItems = (pkg as any).included_services?.map((s: any) => s.name) ?? [];
                return (
                  <View key={pkg.id} style={styles.packageCard}>
                    <View style={styles.packageHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.packageName}>{pkg.name}</Text>
                        <Text style={styles.packageDuration}>
                          ⏱ {(pkg as any).duration_label ?? `${pkg.duration} mins`}
                        </Text>
                      </View>
                      {label && <Badge label={label} variant="discount" />}
                    </View>

                    {includedItems.length > 0 && (
                      <View style={styles.packageItems}>
                        {includedItems.slice(0, 3).map((item: string, idx: number) => (
                          <View key={idx} style={styles.packageItemRow}>
                            <Ionicons name="checkmark-circle" size={14} color={ElixColors.green} />
                            <Text style={styles.packageItemText}>{item}</Text>
                          </View>
                        ))}
                      </View>
                    )}

                    <View style={styles.packageFooter}>
                      <View style={styles.packagePriceRow}>
                        <Text style={styles.packagePrice}>₹{pkg.price.toFixed(0)}</Text>
                        {pkg.original_price && pkg.original_price > pkg.price && (
                          <Text style={styles.packageOriginalPrice}>
                            ₹{pkg.original_price.toFixed(0)}
                          </Text>
                        )}
                      </View>
                      <Button
                        title="+ Add"
                        size="sm"
                        variant="outline"
                        onPress={() => router.push('/services')}
                      />
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}

        {/* ── 6. BEAUTICIANS — Dynamic from /api/v1/beauticians/ ────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>Meet Our Beauticians</Text>
              <Text style={styles.sectionSubtitle}>The hands behind your glow</Text>
            </View>
            <Pressable onPress={() => router.push('/beauticians')}>
              <Text style={styles.viewAllText}>View All →</Text>
            </Pressable>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.beauticianScrollContainer}>
            {beauticiansLoading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color={ElixColors.blue} />
              </View>
            ) : (
              beauticians.slice(0, 6).map((artist) => (
                <Pressable
                  key={artist.slug}
                  style={styles.beauticianCard}
                  onPress={() => router.push('/beauticians')}>
                  {resolveImageUrl(artist.photo) ? (
                    <Image
                      source={{ uri: resolveImageUrl(artist.photo)! }}
                      style={styles.beauticianPhoto}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={[styles.beauticianPhoto, styles.avatarFallback]}>
                      <Ionicons name="person" size={28} color={ElixColors.inkMuted} />
                    </View>
                  )}
                  <View style={styles.beauticianInfo}>
                    <View style={styles.beauticianNameRow}>
                      <Text style={styles.beauticianName} numberOfLines={1}>{artist.name}</Text>
                      <View style={styles.beauticianRatingBadge}>
                        <Ionicons name="star" size={11} color={ElixColors.blue} />
                        <Text style={styles.beauticianRatingText}>
                          {Number(artist.rating).toFixed(1)}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.beauticianSpecialty} numberOfLines={1}>
                      {artist.specialties}
                    </Text>
                    <Text style={styles.beauticianExpText}>
                      {artist.experience_years} yrs exp • {artist.reviews} reviews
                    </Text>
                  </View>
                </Pressable>
              ))
            )}
          </ScrollView>
        </View>

        {/* ── 7. TRUST PILLARS ─────────────────────────────────────────────────
            STATIC: These are brand promises that never change regardless of DB.
            They are product guarantees, not CMS content. */}
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

        {/* ── 8. HOW IT WORKS — Dynamic from /api/v1/home/ ─────────────────── */}
        <View style={styles.hiwSection}>
          <View style={styles.hiwHeader}>
            <View style={styles.hiwEyebrowBadge}>
              <Text style={styles.hiwEyebrowText}>HOW IT WORKS</Text>
            </View>
            <Text style={styles.hiwTitle}>Five steps to your ritual.</Text>
            <Text style={styles.hiwSubtitle}>
              Experience seamless salon luxury in the comfort of your own home.
            </Text>
          </View>

          {homeLoading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={ElixColors.blue} />
            </View>
          ) : (
            <View style={styles.hiwStepsContainer}>
              {hiwSteps.map((step, index) => {
                const isLast = index === hiwSteps.length - 1;
                return (
                  <View key={step.step} style={styles.hiwStepRow}>
                    <View style={styles.hiwTrackColumn}>
                      <View style={styles.hiwNumberBubble}>
                        <Text style={styles.hiwNumberText}>{step.step}</Text>
                      </View>
                      {!isLast && <View style={styles.hiwLineTrack} />}
                    </View>
                    <View style={[styles.hiwContentCard, isLast && { marginBottom: 0 }]}>
                      <View style={styles.hiwStepTitleRow}>
                        <Ionicons
                          name={getHiwIcon(step.icon) as any}
                          size={18}
                          color={ElixColors.blue}
                        />
                        <Text style={styles.hiwStepTitle}>{step.title}</Text>
                      </View>
                      <Text style={styles.hiwStepBody}>{step.body}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        <View style={{ height: 48 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── STYLES ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: ElixColors.surface1,
  },
  container: {
    flex: 1,
  },
  skeletonCard: {
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 100,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  loadingText: {
    fontSize: ElixTypography.sizes.sm,
    color: ElixColors.inkMuted,
  },

  // ── Hero ──
  heroBanner: {
    backgroundColor: ElixColors.white,
    padding: 20,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: ElixRadii.xl,
    borderWidth: 1,
    borderColor: ElixColors.borderHairline,
    ...ElixShadows.sm,
  },
  heroTitle: {
    color: ElixColors.ink,
    fontSize: ElixTypography.sizes.xl,
    fontWeight: ElixTypography.weights.bold,
    lineHeight: 28,
    marginBottom: 6,
  },
  heroSubtitle: {
    color: ElixColors.inkMuted,
    fontSize: ElixTypography.sizes.sm,
    lineHeight: 20,
    marginBottom: 16,
  },
  heroActions: {
    flexDirection: 'row',
  },

  // ── Express Urgent Card (light mode) ──
  redesignedUrgentCard: {
    backgroundColor: ElixColors.blueLight,
    marginHorizontal: 16,
    marginTop: 14,
    borderRadius: ElixRadii.xl,
    padding: 18,
    borderWidth: 1.5,
    borderColor: '#C7D2FE',
    ...ElixShadows.sm,
  },
  urgentTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  urgentPillBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ElixColors.white,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: ElixRadii.full,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  urgentLiveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: ElixColors.blue,
    marginRight: 6,
  },
  urgentPillText: {
    fontSize: 10,
    fontWeight: ElixTypography.weights.bold,
    color: ElixColors.blue,
    letterSpacing: 0.5,
  },
  urgentFeeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ElixColors.white,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: ElixRadii.full,
    borderWidth: 1,
    borderColor: '#C7D2FE',
    gap: 4,
  },
  urgentFeeText: {
    fontSize: 11,
    fontWeight: ElixTypography.weights.bold,
    color: ElixColors.blue,
  },
  urgentMainHeading: {
    fontSize: ElixTypography.sizes.lg,
    fontWeight: ElixTypography.weights.bold,
    color: ElixColors.ink,
    marginBottom: 4,
  },
  urgentMainSubheading: {
    fontSize: ElixTypography.sizes.xs,
    color: ElixColors.inkSoft,
    lineHeight: 18,
    marginBottom: 14,
  },
  urgentPerksRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 2,
  },
  urgentPerkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: ElixColors.white,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: ElixRadii.sm,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  urgentPerkText: {
    fontSize: 11,
    color: ElixColors.ink,
    fontWeight: ElixTypography.weights.medium,
  },
  urgentCtaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ElixColors.urgentRed,
    paddingVertical: 11,
    borderRadius: ElixRadii.lg,
    gap: 6,
    ...ElixShadows.sm,
  },
  urgentCtaText: {
    color: ElixColors.white,
    fontWeight: ElixTypography.weights.bold,
    fontSize: ElixTypography.sizes.sm,
  },

  // ── Section Layout ──
  section: {
    marginTop: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: ElixTypography.sizes.lg,
    fontWeight: ElixTypography.weights.bold,
    color: ElixColors.ink,
  },
  sectionSubtitle: {
    fontSize: ElixTypography.sizes.xs,
    color: ElixColors.inkMuted,
    marginTop: 1,
  },
  viewAllText: {
    fontSize: ElixTypography.sizes.sm,
    color: ElixColors.blue,
    fontWeight: ElixTypography.weights.medium,
  },

  // ── Offers ──
  offersScrollContainer: {
    paddingLeft: 16,
    paddingRight: 6,
    gap: 12,
  },
  offerCard: {
    width: 260,
    height: 155,
    borderRadius: ElixRadii.xl,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: ElixColors.ink,
    ...ElixShadows.sm,
  },
  offerImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  offerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.68)',
  },
  offerContent: {
    flex: 1,
    padding: 14,
    justifyContent: 'space-between',
  },
  offerBadge: {
    alignSelf: 'flex-start',
    backgroundColor: ElixColors.urgentRed,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: ElixRadii.sm,
  },
  offerBadgeText: {
    color: ElixColors.white,
    fontSize: 10,
    fontWeight: ElixTypography.weights.bold,
  },
  offerTitle: {
    color: ElixColors.white,
    fontSize: ElixTypography.sizes.md,
    fontWeight: ElixTypography.weights.bold,
    marginTop: 2,
  },
  offerDesc: {
    color: '#E2E8F0',
    fontSize: 11,
    lineHeight: 15,
  },
  offerCouponRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: ElixRadii.sm,
    alignSelf: 'stretch',
    justifyContent: 'space-between',
  },
  offerCouponCode: {
    color: ElixColors.white,
    fontSize: 11,
    fontWeight: ElixTypography.weights.bold,
    letterSpacing: 0.5,
  },
  offerTapToApply: {
    color: ElixColors.blue,
    fontSize: 10,
    fontWeight: ElixTypography.weights.medium,
  },

  // ── Categories ──
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    gap: 8,
  },
  categoryCard: {
    width: '31%',
    backgroundColor: ElixColors.white,
    padding: 12,
    borderRadius: ElixRadii.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: ElixColors.borderHairline,
    ...ElixShadows.sm,
  },
  categoryIconWrap: {
    width: 44,
    height: 44,
    borderRadius: ElixRadii.full,
    backgroundColor: ElixColors.surface2,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryName: {
    fontSize: ElixTypography.sizes.xs,
    fontWeight: ElixTypography.weights.medium,
    color: ElixColors.ink,
    textAlign: 'center',
    marginBottom: 2,
  },
  categoryCount: {
    fontSize: 10,
    color: ElixColors.inkMuted,
  },

  // ── Packages ──
  packageCard: {
    backgroundColor: ElixColors.white,
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    borderRadius: ElixRadii.xl,
    borderWidth: 1,
    borderColor: ElixColors.borderHairline,
    ...ElixShadows.sm,
  },
  packageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  packageName: {
    fontSize: ElixTypography.sizes.md,
    fontWeight: ElixTypography.weights.bold,
    color: ElixColors.ink,
    marginBottom: 2,
  },
  packageDuration: {
    fontSize: ElixTypography.sizes.xs,
    color: ElixColors.inkMuted,
  },
  packageItems: {
    gap: 6,
    marginBottom: 12,
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

  // ── Beauticians ──
  beauticianScrollContainer: {
    paddingLeft: 16,
    paddingRight: 6,
    gap: 12,
  },
  beauticianCard: {
    width: 200,
    backgroundColor: ElixColors.white,
    borderRadius: ElixRadii.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: ElixColors.borderHairline,
    ...ElixShadows.sm,
  },
  beauticianPhoto: {
    width: '100%',
    height: 110,
    backgroundColor: ElixColors.surface2,
  },
  avatarFallback: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  beauticianInfo: {
    padding: 10,
  },
  beauticianNameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  beauticianName: {
    flex: 1,
    fontSize: ElixTypography.sizes.sm,
    fontWeight: ElixTypography.weights.bold,
    color: ElixColors.ink,
    marginRight: 4,
  },
  beauticianRatingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: ElixColors.blueLight,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  beauticianRatingText: {
    fontSize: 10,
    fontWeight: ElixTypography.weights.bold,
    color: ElixColors.blue,
  },
  beauticianSpecialty: {
    fontSize: 11,
    color: ElixColors.inkSoft,
    marginBottom: 4,
  },
  beauticianExpText: {
    fontSize: 10,
    color: ElixColors.inkMuted,
  },

  // ── Trust Pillars (Static) ──
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

  // ── How It Works (Dynamic) ──
  hiwSection: {
    marginTop: 28,
    marginHorizontal: 16,
    backgroundColor: ElixColors.white,
    borderRadius: ElixRadii.xl,
    padding: 18,
    borderWidth: 1,
    borderColor: ElixColors.borderHairline,
    ...ElixShadows.sm,
  },
  hiwHeader: {
    marginBottom: 20,
    alignItems: 'center',
  },
  hiwEyebrowBadge: {
    backgroundColor: ElixColors.surface2,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: ElixRadii.full,
    marginBottom: 6,
  },
  hiwEyebrowText: {
    fontSize: 10,
    fontWeight: ElixTypography.weights.bold,
    color: ElixColors.blue,
    letterSpacing: 1,
  },
  hiwTitle: {
    fontSize: ElixTypography.sizes.lg,
    fontWeight: ElixTypography.weights.bold,
    color: ElixColors.ink,
    marginBottom: 4,
    textAlign: 'center',
  },
  hiwSubtitle: {
    fontSize: ElixTypography.sizes.xs,
    color: ElixColors.inkMuted,
    textAlign: 'center',
    lineHeight: 16,
  },
  hiwStepsContainer: {
    paddingLeft: 4,
  },
  hiwStepRow: {
    flexDirection: 'row',
  },
  hiwTrackColumn: {
    alignItems: 'center',
    width: 36,
  },
  hiwNumberBubble: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: ElixColors.ink,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: ElixColors.blue,
  },
  hiwNumberText: {
    fontSize: 11,
    fontWeight: ElixTypography.weights.bold,
    color: ElixColors.white,
  },
  hiwLineTrack: {
    width: 2,
    flex: 1,
    backgroundColor: ElixColors.borderHairline,
    marginVertical: 4,
  },
  hiwContentCard: {
    flex: 1,
    marginLeft: 12,
    marginBottom: 16,
    backgroundColor: ElixColors.surface1,
    borderRadius: ElixRadii.lg,
    padding: 12,
    borderWidth: 1,
    borderColor: ElixColors.borderHairline,
  },
  hiwStepTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  hiwStepTitle: {
    fontSize: ElixTypography.sizes.sm,
    fontWeight: ElixTypography.weights.bold,
    color: ElixColors.ink,
  },
  hiwStepBody: {
    fontSize: ElixTypography.sizes.xs,
    color: ElixColors.inkSoft,
    lineHeight: 16,
  },
});
