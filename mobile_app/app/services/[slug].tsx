import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ElixColors, ElixRadii, ElixTypography, ElixShadows } from '@/constants/theme';
import { useServiceDetail } from '@/hooks/useServiceDetail';
import { useCartStore } from '@/store/cartStore';
import { resolveImageUrl } from '@/lib/apiClient';
import { BookingDrawer } from '@/components/booking/BookingDrawer';

export default function ServiceDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const insets = useSafeAreaInsets();
  const { data: item, isLoading, error, refetch } = useServiceDetail(slug);

  const { items: cartItems, totalItems, totalAmount, addItem, increment, decrement, getKey } = useCartStore();
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [drawerMode, setDrawerMode] = useState<'cart' | 'checkout'>('cart');
  const [expandedFaq, setExpandedFaq] = useState<number | null>(0);

  // Selected variant for standalone service
  const [selectedVariantId, setSelectedVariantId] = useState<number | null>(null);

  // Selected variants for package included services: map of incServiceId -> variantId
  const [pkgCustomVariants, setPkgCustomVariants] = useState<Record<number, number>>({});

  // Active variant resolution
  const activeVariant = useMemo(() => {
    if (!item || item.kind === 'package' || !item.variants?.length) return null;
    if (selectedVariantId) {
      return item.variants.find((v) => v.id === selectedVariantId) || item.variants[0];
    }
    return item.variants.find((v) => v.is_default) || item.variants[0];
  }, [item, selectedVariantId]);

  // Current price & duration
  const activePrice = useMemo(() => {
    if (!item) return 0;
    if (item.kind === 'package') return item.price;
    return activeVariant ? activeVariant.price : item.price;
  }, [item, activeVariant]);

  const activeMrp = useMemo(() => {
    if (!item) return null;
    if (item.kind === 'package') return item.mrp;
    return activeVariant?.mrp ?? item.mrp;
  }, [item, activeVariant]);

  const discount = useMemo(() => {
    if (!activeMrp || activeMrp <= activePrice) return 0;
    return Math.round((1 - activePrice / activeMrp) * 100);
  }, [activePrice, activeMrp]);

  const activeDuration = useMemo(() => {
    if (!item) return '15 mins';
    if (item.kind === 'package') {
      return item.duration_label || (item.duration_mins ? `${item.duration_mins} mins` : '60 mins');
    }
    return activeVariant?.duration_label || (activeVariant?.duration_mins ? `${activeVariant.duration_mins} mins` : item.duration_label || '15 mins');
  }, [item, activeVariant]);

  // Cart quantity for currently selected configuration
  const currentKey = useMemo(() => {
    if (!item) return '';
    return item.kind === 'package'
      ? getKey({ isPackage: true, packageId: item.id })
      : getKey({ isPackage: false, variantId: activeVariant?.id ?? item.variant_id ?? item.id });
  }, [item, activeVariant, getKey]);

  const currentQty = useMemo(() => {
    if (!currentKey) return 0;
    return cartItems.find((c) => {
      const k = getKey({ isPackage: c.isPackage, variantId: c.variantId, packageId: c.packageId });
      return k === currentKey;
    })?.quantity ?? 0;
  }, [cartItems, currentKey, getKey]);

  const handleAddToCart = () => {
    if (!item) return;
    addItem({
      isPackage: item.kind === 'package',
      variantId: item.kind === 'service' ? (activeVariant?.id ?? item.variant_id ?? item.id) : undefined,
      packageId: item.kind === 'package' ? item.id : undefined,
      name: item.name + (activeVariant?.label ? ' - ' + activeVariant.label : ''),
      price: activePrice,
      duration: activeVariant?.duration_mins ?? item.duration_mins ?? 15,
    });
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={ElixColors.blue} />
        <Text style={styles.loadingText}>Loading service details...</Text>
      </View>
    );
  }

  if (error || !item) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={48} color={ElixColors.urgentRed} />
        <Text style={styles.errorTitle}>Could not load service</Text>
        <Text style={styles.errorSub}>The requested service or package is currently unavailable.</Text>
        <Pressable style={styles.retryBtn} onPress={() => refetch()}>
          <Text style={styles.retryBtnText}>Try Again</Text>
        </Pressable>
        <Pressable style={styles.backLink} onPress={() => router.back()}>
          <Text style={styles.backLinkText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const photoUri = resolveImageUrl(item.photo);

  return (
    <View style={styles.screen}>
      {/* Top Floating Navigation Header */}
      <View style={[styles.floatingHeader, { top: insets.top > 0 ? insets.top : 12 }]}>
        <Pressable
          style={styles.headerCircleBtn}
          onPress={() => router.back()}
          accessibilityLabel="Back"
        >
          <Ionicons name="arrow-back" size={20} color={ElixColors.ink} />
        </Pressable>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Pressable
            style={styles.headerCircleBtn}
            onPress={() => {
              setDrawerMode('cart');
              setDrawerVisible(true);
            }}
            accessibilityLabel="Cart"
          >
            <Ionicons name="bag-handle-outline" size={20} color={ElixColors.ink} />
            {totalItems > 0 && (
              <View style={styles.headerCartBadge}>
                <Text style={styles.headerCartBadgeText}>{totalItems}</Text>
              </View>
            )}
          </Pressable>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        {/* Hero Photo / Media Banner */}
        <View style={styles.heroMediaContainer}>
          {photoUri ? (
            <Image
              source={{ uri: photoUri }}
              style={styles.heroImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.heroPlaceholder}>
              <Ionicons name="sparkles" size={48} color={ElixColors.blue} />
            </View>
          )}

          {/* Scrim Overlay & Badges */}
          <View style={styles.heroBadgeRow}>
            <View style={styles.categoryChip}>
              <Text style={styles.categoryChipText}>{item.category.toUpperCase()}</Text>
            </View>
            {item.kind === 'package' && (
              <View style={styles.packagePill}>
                <Text style={styles.packagePillText}>LUXURY PACKAGE</Text>
              </View>
            )}
            {discount > 0 && (
              <View style={styles.discountBadge}>
                <Text style={styles.discountBadgeText}>{discount}% OFF</Text>
              </View>
            )}
          </View>
        </View>

        {/* Main Details Card */}
        <View style={styles.mainContent}>
          <Text style={styles.itemTitle}>{item.name}</Text>

          {/* Rating, Duration & Verified Info */}
          <View style={styles.ratingMetaRow}>
            <View style={styles.ratingPill}>
              <Ionicons name="star" size={13} color="#D97706" />
              <Text style={styles.ratingPillText}>{Number(item.rating || 4.8).toFixed(1)}</Text>
            </View>
            <Text style={styles.ratingReviewsText}>
              ({item.reviews_count || 128} reviews)
            </Text>
            <Text style={styles.metaDot}>·</Text>
            <View style={styles.durationPill}>
              <Ionicons name="time-outline" size={13} color={ElixColors.inkMuted} />
              <Text style={styles.durationPillText}>{activeDuration}</Text>
            </View>
          </View>

          {/* Pricing Box */}
          <View style={styles.pricingCard}>
            <View>
              <View style={styles.priceRow}>
                <Text style={styles.priceMain}>₹{Math.round(activePrice)}</Text>
                {activeMrp && activeMrp > activePrice && (
                  <Text style={styles.priceMrp}>₹{Math.round(activeMrp)}</Text>
                )}
                {discount > 0 && (
                  <View style={styles.discountPill}>
                    <Text style={styles.discountPillText}>{discount}% OFF</Text>
                  </View>
                )}
              </View>
              <Text style={styles.priceSub}>Inclusive of all taxes · Doorstep service</Text>
            </View>

            {/* Quick Add Button in Header */}
            {currentQty === 0 ? (
              <Pressable style={styles.quickAddBtn} onPress={handleAddToCart}>
                <Ionicons name="add" size={16} color={ElixColors.blue} />
                <Text style={styles.quickAddBtnText}>Add</Text>
              </Pressable>
            ) : (
              <View style={styles.quickQtyControl}>
                <Pressable style={styles.quickQtyBtn} onPress={() => decrement(currentKey)}>
                  <Ionicons name="remove" size={14} color={ElixColors.blue} />
                </Pressable>
                <Text style={styles.quickQtyValue}>{currentQty}</Text>
                <Pressable style={styles.quickQtyBtn} onPress={() => increment(currentKey)}>
                  <Ionicons name="add" size={14} color={ElixColors.blue} />
                </Pressable>
              </View>
            )}
          </View>

          {/* Description */}
          {item.description ? (
            <View style={styles.descBox}>
              <Text style={styles.sectionHeading}>About this Service</Text>
              <Text style={styles.descText}>{item.description}</Text>
            </View>
          ) : null}

          {/* Service Variants Selector (e.g. Honey Wax vs RICA Wax) */}
          {item.kind === 'service' && item.variants && item.variants.length > 1 && (
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionHeading}>Select Option / Variant</Text>
              <Text style={styles.sectionSub}>Choose your preferred material or duration:</Text>

              <View style={styles.variantsList}>
                {item.variants.map((v) => {
                  const isSelected = (activeVariant?.id === v.id);
                  const vDiscount = v.mrp && v.mrp > v.price ? Math.round((1 - v.price / v.mrp) * 100) : 0;
                  return (
                    <Pressable
                      key={v.id}
                      style={[styles.variantCard, isSelected && styles.variantCardSelected]}
                      onPress={() => setSelectedVariantId(v.id)}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.variantTitle, isSelected && styles.variantTitleSelected]}>
                          {v.label || v.duration_label}
                        </Text>
                        <View style={styles.variantMetaRow}>
                          <Text style={styles.variantPrice}>₹{Math.round(v.price)}</Text>
                          {v.mrp && v.mrp > v.price && (
                            <Text style={styles.variantMrp}>₹{Math.round(v.mrp)}</Text>
                          )}
                          {vDiscount > 0 && (
                            <Text style={styles.variantDiscount}>{vDiscount}% OFF</Text>
                          )}
                          {v.duration_label && (
                            <Text style={styles.variantTime}>· {v.duration_label}</Text>
                          )}
                        </View>
                      </View>

                      <View style={[styles.radioCircle, isSelected && styles.radioCircleSelected]}>
                        {isSelected && <View style={styles.radioDot} />}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {/* Package Included Services Breakdown */}
          {item.kind === 'package' && item.included_services && item.included_services.length > 0 && (
            <View style={styles.sectionBlock}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionHeading}>Included Services ({item.included_services.length})</Text>
                <Text style={styles.sectionActionTag}>Customizable</Text>
              </View>
              <Text style={styles.sectionSub}>All included services delivered together in one appointment:</Text>

              <View style={styles.includedList}>
                {item.included_services.map((inc) => {
                  const incPhoto = resolveImageUrl(inc.photo);
                  return (
                    <View key={inc.id} style={styles.includedItemCard}>
                      <View style={styles.includedItemMain}>
                        <View style={styles.includedImgWrap}>
                          {incPhoto ? (
                            <Image source={{ uri: incPhoto }} style={styles.includedImg} />
                          ) : (
                            <Ionicons name="sparkles" size={20} color={ElixColors.blue} />
                          )}
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={styles.includedItemName}>{inc.name}</Text>
                          <Text style={styles.includedItemDuration}>
                            {inc.duration_label || `${inc.duration_mins} mins`}
                          </Text>
                        </View>
                        <Text style={styles.includedItemPrice}>₹{Math.round(inc.price)}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* Treatment Steps Timeline (How this treatment works) */}
          {item.steps && item.steps.length > 0 && (
            <View style={styles.sectionBlock}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionHeading}>How It Works — Step by Step</Text>
              </View>
              <View style={styles.stepsTimeline}>
                {item.steps.map((st, idx) => (
                  <View key={idx} style={styles.stepRow}>
                    <View style={styles.stepIndicatorCol}>
                      <View style={styles.stepNumberCircle}>
                        <Text style={styles.stepNumberText}>{idx + 1}</Text>
                      </View>
                      {idx < item.steps.length - 1 && <View style={styles.stepLine} />}
                    </View>
                    <View style={styles.stepContentCol}>
                      <View style={styles.stepTitleRow}>
                        <Text style={styles.stepTitle}>{st.title}</Text>
                        {st.badge ? (
                          <View style={styles.stepBadge}>
                            <Text style={styles.stepBadgeText}>{st.badge}</Text>
                          </View>
                        ) : null}
                      </View>
                      {st.description ? (
                        <Text style={styles.stepDesc}>{st.description}</Text>
                      ) : null}
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* After-Care Tips */}
          {item.aftercare && item.aftercare.tips?.length > 0 && (
            <View style={styles.aftercareCard}>
              <View style={styles.aftercareHeader}>
                <Ionicons name="shield-checkmark" size={20} color="#047857" />
                <Text style={styles.aftercareTitle}>{item.aftercare.title || 'After-Care Tips'}</Text>
              </View>
              <View style={styles.aftercareList}>
                {item.aftercare.tips.map((tip, idx) => (
                  <View key={idx} style={styles.aftercareItem}>
                    <Ionicons name="checkmark-circle" size={14} color="#059669" style={{ marginTop: 2 }} />
                    <Text style={styles.aftercareText}>{tip}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Quality Promises (4 Pillars) */}
          <View style={styles.sectionBlock}>
            <Text style={styles.sectionHeading}>The ELIX At-Home Guarantee</Text>
            <View style={styles.promisesGrid}>
              {(item.promises || [
                { title: '100% Certified', desc: 'Background-verified beauticians', icon: 'shield-checkmark-outline' },
                { title: 'Mono-Dose Kits', desc: 'Sealed single-use sachets opened in front of you', icon: 'cube-outline' },
                { title: 'Free Rescheduling', desc: 'Instant reschedule or cancellation anytime', icon: 'time-outline' },
                { title: 'Mess-Free Clean-up', desc: 'Spotless post-service home clean-up', icon: 'sparkles-outline' },
              ]).map((p, idx) => (
                <View key={idx} style={styles.promiseItem}>
                  <View style={styles.promiseIconWrap}>
                    <Ionicons name={p.icon as any} size={20} color={ElixColors.blue} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.promiseTitle}>{p.title}</Text>
                    <Text style={styles.promiseDesc}>{p.desc}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* How At-Home Salon Works (3 Steps) */}
          <View style={styles.sectionBlock}>
            <Text style={styles.sectionHeading}>How At-Home Salon Works</Text>
            <View style={styles.hiwContainer}>
              {(item.how_it_works || [
                { step: '01', title: 'Beautician Arrival & Prep', desc: 'Certified professional arrives at your doorstep equipped with salon setup and hygiene disposable kit.' },
                { step: '02', title: 'Sealed Product Unboxing', desc: 'All products are mono-doses opened right before your eyes to guarantee 100% purity and safety.' },
                { step: '03', title: 'Flawless Service & Clean-up', desc: 'Enjoy luxury salon treatment at home, followed by complete post-service clean-up and care guidance.' },
              ]).map((hw, idx) => (
                <View key={idx} style={styles.hiwCard}>
                  <View style={styles.hiwStepNum}>
                    <Text style={styles.hiwStepNumText}>{hw.step}</Text>
                  </View>
                  <Text style={styles.hiwTitle}>{hw.title}</Text>
                  <Text style={styles.hiwDesc}>{hw.desc}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Customer Reviews & Ratings */}
          <View style={styles.sectionBlock}>
            <View style={styles.reviewsHeader}>
              <View>
                <Text style={styles.sectionHeading}>Customer Reviews & Ratings</Text>
                <Text style={styles.sectionSub}>Based on verified completed home visits</Text>
              </View>
              <View style={styles.scorePill}>
                <Ionicons name="star" size={14} color="#D97706" />
                <Text style={styles.scoreText}>{Number(item.rating || 4.9).toFixed(1)}</Text>
              </View>
            </View>

            {item.reviews && item.reviews.length > 0 ? (
              <View style={styles.reviewsList}>
                {item.reviews.slice(0, 5).map((rev) => (
                  <View key={rev.id} style={styles.reviewCard}>
                    <View style={styles.reviewTop}>
                      <Text style={styles.reviewerName}>{rev.name}</Text>
                      <View style={styles.starsRow}>
                        {Array.from({ length: rev.rating || 5 }).map((_, i) => (
                          <Ionicons key={i} name="star" size={11} color="#D97706" />
                        ))}
                      </View>
                    </View>
                    <View style={styles.verifiedRow}>
                      <Ionicons name="checkmark-circle" size={12} color={ElixColors.green} />
                      <Text style={styles.verifiedText}>Verified Customer</Text>
                      {rev.created_at ? <Text style={styles.reviewDate}>· {rev.created_at}</Text> : null}
                    </View>
                    {rev.comment ? <Text style={styles.reviewComment}>"{rev.comment}"</Text> : null}
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.noReviewsBox}>
                <Text style={styles.noReviewsText}>Be the first to book this service and share your experience!</Text>
              </View>
            )}
          </View>

          {/* FAQs Accordion */}
          {item.faqs && item.faqs.length > 0 && (
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionHeading}>Frequently Asked Questions</Text>
              <View style={styles.faqList}>
                {item.faqs.map((faq, idx) => {
                  const isOpen = expandedFaq === idx;
                  return (
                    <View key={idx} style={styles.faqCard}>
                      <Pressable
                        style={styles.faqHeader}
                        onPress={() => setExpandedFaq(isOpen ? null : idx)}
                      >
                        <Text style={styles.faqQuestion}>{faq.question}</Text>
                        <Ionicons
                          name={isOpen ? 'chevron-up' : 'chevron-down'}
                          size={18}
                          color={ElixColors.inkMuted}
                        />
                      </Pressable>
                      {isOpen && (
                        <View style={styles.faqBody}>
                          <Text style={styles.faqAnswer}>{faq.answer}</Text>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* Similar Services / You May Also Like */}
          {item.related_items && item.related_items.length > 0 && (
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionHeading}>Similar Services You May Like</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.relatedScroll}>
                {item.related_items.map((rel) => {
                  const relImg = resolveImageUrl(rel.photo);
                  return (
                    <Pressable
                      key={rel.id}
                      style={styles.relatedCard}
                      onPress={() => router.push(`/services/${rel.slug}` as any)}
                    >
                      <View style={styles.relatedImgWrap}>
                        {relImg ? (
                          <Image source={{ uri: relImg }} style={styles.relatedImg} resizeMode="cover" />
                        ) : (
                          <Ionicons name="sparkles" size={24} color={ElixColors.blue} />
                        )}
                      </View>
                      <Text style={styles.relatedTitle} numberOfLines={1}>{rel.name}</Text>
                      <View style={styles.relatedMeta}>
                        <Text style={styles.relatedPrice}>₹{Math.round(rel.price)}</Text>
                        <Text style={styles.relatedRating}>★ {rel.rating.toFixed(1)}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Sticky Bottom Action Bar */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom > 0 ? insets.bottom + 8 : 14 }]}>
        <View style={styles.bottomBarPriceCol}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
            <Text style={styles.bottomPrice}>₹{Math.round(activePrice)}</Text>
            {activeMrp && activeMrp > activePrice && (
              <Text style={styles.bottomMrp}>₹{Math.round(activeMrp)}</Text>
            )}
          </View>
          <Text style={styles.bottomDuration}>⏱ {activeDuration}</Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          {currentQty === 0 ? (
            <Pressable style={styles.bottomAddBtn} onPress={handleAddToCart}>
              <Ionicons name="add" size={18} color="#fff" />
              <Text style={styles.bottomAddBtnText}>Add to Cart</Text>
            </Pressable>
          ) : (
            <View style={styles.bottomQtyControl}>
              <Pressable style={styles.bottomQtyBtn} onPress={() => decrement(currentKey)}>
                <Ionicons name="remove" size={16} color={ElixColors.blue} />
              </Pressable>
              <Text style={styles.bottomQtyValue}>{currentQty}</Text>
              <Pressable style={styles.bottomQtyBtn} onPress={() => increment(currentKey)}>
                <Ionicons name="add" size={16} color={ElixColors.blue} />
              </Pressable>
            </View>
          )}

          {totalItems > 0 && (
            <Pressable
              style={styles.bottomViewCartBtn}
              onPress={() => {
                setDrawerMode('cart');
                setDrawerVisible(true);
              }}
            >
              <Ionicons name="bag-check" size={18} color="#fff" />
            </Pressable>
          )}
        </View>
      </View>

      {/* Booking Drawer for Cart & Checkout */}
      <BookingDrawer
        visible={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        initialMode={drawerMode}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: ElixColors.inkMuted,
    fontWeight: '600',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#fff',
    gap: 10,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: ElixColors.ink,
  },
  errorSub: {
    fontSize: 13,
    color: ElixColors.inkMuted,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 8,
  },
  retryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: ElixRadii.md,
    backgroundColor: ElixColors.blue,
  },
  retryBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  backLink: {
    paddingVertical: 8,
  },
  backLinkText: {
    color: ElixColors.blue,
    fontWeight: '600',
    fontSize: 13,
  },
  floatingHeader: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerCircleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    ...ElixShadows.md,
  },
  headerCartBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: ElixColors.blue,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCartBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },
  heroMediaContainer: {
    width: '100%',
    height: 250,
    backgroundColor: '#E5E7EB',
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
  },
  heroBadgeRow: {
    position: 'absolute',
    bottom: 14,
    left: 16,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  categoryChip: {
    backgroundColor: 'rgba(15, 23, 42, 0.82)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  categoryChipText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  packagePill: {
    backgroundColor: ElixColors.blue,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  packagePillText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  discountBadge: {
    backgroundColor: '#059669',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  discountBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  mainContent: {
    padding: 18,
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -20,
    ...ElixShadows.sm,
  },
  itemTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: ElixColors.ink,
    lineHeight: 28,
    marginBottom: 8,
  },
  ratingMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  ratingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  ratingPillText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#B45309',
  },
  ratingReviewsText: {
    fontSize: 12,
    color: ElixColors.inkMuted,
  },
  metaDot: {
    color: '#D1D5DB',
  },
  durationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  durationPillText: {
    fontSize: 12,
    color: ElixColors.inkMuted,
    fontWeight: '500',
  },
  pricingCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 14,
    borderRadius: ElixRadii.lg,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 18,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  priceMain: {
    fontSize: 22,
    fontWeight: '800',
    color: ElixColors.ink,
  },
  priceMrp: {
    fontSize: 14,
    color: ElixColors.inkMuted,
    textDecorationLine: 'line-through',
  },
  discountPill: {
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  discountPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#065F46',
  },
  priceSub: {
    fontSize: 11,
    color: ElixColors.inkMuted,
    marginTop: 2,
  },
  quickAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: ElixRadii.md,
    backgroundColor: '#EFF6FF',
    borderWidth: 1.5,
    borderColor: ElixColors.blue,
  },
  quickAddBtnText: {
    color: ElixColors.blue,
    fontWeight: '700',
    fontSize: 13,
  },
  quickQtyControl: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: ElixColors.blue,
    borderRadius: ElixRadii.md,
    overflow: 'hidden',
    backgroundColor: '#EFF6FF',
  },
  quickQtyBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  quickQtyValue: {
    paddingHorizontal: 6,
    fontSize: 13,
    fontWeight: '700',
    color: ElixColors.ink,
  },
  descBox: {
    marginBottom: 20,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '800',
    color: ElixColors.ink,
    marginBottom: 6,
  },
  sectionSub: {
    fontSize: 12,
    color: ElixColors.inkMuted,
    marginBottom: 12,
  },
  descText: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 22,
  },
  sectionBlock: {
    marginTop: 18,
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionActionTag: {
    fontSize: 11,
    fontWeight: '700',
    color: ElixColors.blue,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  variantsList: {
    gap: 10,
  },
  variantCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: ElixRadii.lg,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: '#fff',
  },
  variantCardSelected: {
    borderColor: ElixColors.blue,
    backgroundColor: '#F8FAFF',
  },
  variantTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: ElixColors.ink,
  },
  variantTitleSelected: {
    color: ElixColors.blue,
  },
  variantMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  variantPrice: {
    fontSize: 15,
    fontWeight: '800',
    color: ElixColors.ink,
  },
  variantMrp: {
    fontSize: 12,
    color: ElixColors.inkMuted,
    textDecorationLine: 'line-through',
  },
  variantDiscount: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },
  variantTime: {
    fontSize: 12,
    color: ElixColors.inkMuted,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleSelected: {
    borderColor: ElixColors.blue,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: ElixColors.blue,
  },
  includedList: {
    gap: 8,
  },
  includedItemCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: ElixRadii.md,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 10,
  },
  includedItemMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  includedImgWrap: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  includedImg: {
    width: '100%',
    height: '100%',
  },
  includedItemName: {
    fontSize: 13,
    fontWeight: '700',
    color: ElixColors.ink,
  },
  includedItemDuration: {
    fontSize: 11,
    color: ElixColors.inkMuted,
    marginTop: 2,
  },
  includedItemPrice: {
    fontSize: 13,
    fontWeight: '700',
    color: ElixColors.ink,
  },
  stepsTimeline: {
    marginTop: 10,
  },
  stepRow: {
    flexDirection: 'row',
    gap: 12,
  },
  stepIndicatorCol: {
    alignItems: 'center',
    width: 28,
  },
  stepNumberCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: ElixColors.blueLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    fontSize: 12,
    fontWeight: '800',
    color: ElixColors.blue,
  },
  stepLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 4,
  },
  stepContentCol: {
    flex: 1,
    paddingBottom: 18,
  },
  stepTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: ElixColors.ink,
  },
  stepBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  stepBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: ElixColors.blue,
  },
  stepDesc: {
    fontSize: 12,
    color: ElixColors.inkMuted,
    lineHeight: 18,
    marginTop: 4,
  },
  aftercareCard: {
    backgroundColor: '#ECFDF5',
    borderRadius: ElixRadii.lg,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    padding: 16,
    marginTop: 20,
  },
  aftercareHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  aftercareTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#065F46',
  },
  aftercareList: {
    gap: 8,
  },
  aftercareItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  aftercareText: {
    fontSize: 13,
    color: '#047857',
    flex: 1,
    lineHeight: 18,
  },
  promisesGrid: {
    gap: 12,
    marginTop: 6,
  },
  promiseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: ElixRadii.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  promiseIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  promiseTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: ElixColors.ink,
  },
  promiseDesc: {
    fontSize: 11,
    color: ElixColors.inkMuted,
    marginTop: 1,
  },
  hiwContainer: {
    gap: 10,
    marginTop: 6,
  },
  hiwCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: ElixRadii.md,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  hiwStepNum: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: ElixColors.blue,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  hiwStepNumText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  hiwTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: ElixColors.ink,
    marginBottom: 4,
  },
  hiwDesc: {
    fontSize: 12,
    color: ElixColors.inkMuted,
    lineHeight: 18,
  },
  reviewsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  scorePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  scoreText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#B45309',
  },
  reviewsList: {
    gap: 10,
  },
  reviewCard: {
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: ElixRadii.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  reviewTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  reviewerName: {
    fontSize: 13,
    fontWeight: '700',
    color: ElixColors.ink,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 1,
  },
  verifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  verifiedText: {
    fontSize: 11,
    fontWeight: '600',
    color: ElixColors.green,
  },
  reviewDate: {
    fontSize: 11,
    color: ElixColors.inkMuted,
  },
  reviewComment: {
    fontSize: 12,
    color: '#4B5563',
    lineHeight: 17,
  },
  noReviewsBox: {
    backgroundColor: '#F9FAFB',
    padding: 14,
    borderRadius: ElixRadii.md,
    alignItems: 'center',
  },
  noReviewsText: {
    fontSize: 12,
    color: ElixColors.inkMuted,
    textAlign: 'center',
  },
  faqList: {
    gap: 8,
    marginTop: 6,
  },
  faqCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: ElixRadii.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  faqHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
  },
  faqQuestion: {
    fontSize: 13,
    fontWeight: '700',
    color: ElixColors.ink,
    flex: 1,
    paddingRight: 10,
  },
  faqBody: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  faqAnswer: {
    fontSize: 12,
    color: '#4B5563',
    lineHeight: 18,
    marginTop: 8,
  },
  relatedScroll: {
    marginTop: 10,
  },
  relatedCard: {
    width: 140,
    marginRight: 12,
    backgroundColor: '#fff',
    borderRadius: ElixRadii.md,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 10,
  },
  relatedImgWrap: {
    width: '100%',
    height: 90,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  relatedImg: {
    width: '100%',
    height: '100%',
  },
  relatedTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: ElixColors.ink,
    marginBottom: 4,
  },
  relatedMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  relatedPrice: {
    fontSize: 13,
    fontWeight: '800',
    color: ElixColors.ink,
  },
  relatedRating: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B45309',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingHorizontal: 18,
    paddingTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...ElixShadows.lg,
  },
  bottomBarPriceCol: {
    flex: 1,
  },
  bottomPrice: {
    fontSize: 20,
    fontWeight: '800',
    color: ElixColors.ink,
  },
  bottomMrp: {
    fontSize: 13,
    color: ElixColors.inkMuted,
    textDecorationLine: 'line-through',
  },
  bottomDuration: {
    fontSize: 11,
    color: ElixColors.inkMuted,
    marginTop: 2,
  },
  bottomAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: ElixColors.blue,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: ElixRadii.lg,
  },
  bottomAddBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  bottomQtyControl: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderRadius: ElixRadii.lg,
    borderWidth: 1.5,
    borderColor: ElixColors.blue,
    overflow: 'hidden',
  },
  bottomQtyBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  bottomQtyValue: {
    paddingHorizontal: 8,
    fontSize: 14,
    fontWeight: '700',
    color: ElixColors.ink,
  },
  bottomViewCartBtn: {
    backgroundColor: ElixColors.ink,
    width: 44,
    height: 44,
    borderRadius: ElixRadii.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
