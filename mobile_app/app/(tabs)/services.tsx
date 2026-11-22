import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import { ElixColors, ElixRadii, ElixTypography, ElixShadows } from '@/constants/theme';
import { Header } from '@/components/ui/Header';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useCatalog } from '@/hooks/useCatalog';
import { useCartStore } from '@/store/cartStore';
import type { CatalogItem } from '@/types/api';
import { BookingDrawer } from '@/components/booking/BookingDrawer';
import { resolveImageUrl } from '@/lib/apiClient';

export type SortOption =
  | 'default'
  | 'price_asc'
  | 'price_desc'
  | 'name_asc'
  | 'name_desc'
  | 'duration_asc'
  | 'duration_desc';

interface SortOptionConfig {
  id: SortOption;
  label: string;
  shortLabel: string;
  desc: string;
  icon: string;
}

const SORT_OPTIONS: SortOptionConfig[] = [
  { id: 'default', label: 'Recommended', shortLabel: 'Default', desc: 'Popular & featured catalog order', icon: 'sparkles' },
  { id: 'price_asc', label: 'Price: Low to High', shortLabel: 'Price: Low → High', desc: 'Most affordable services first', icon: 'trending-up' },
  { id: 'price_desc', label: 'Price: High to Low', shortLabel: 'Price: High → Low', desc: 'Premium & luxury packages first', icon: 'trending-down' },
  { id: 'name_asc', label: 'Name: A to Z', shortLabel: 'Name A → Z', desc: 'Alphabetical order A to Z', icon: 'text-outline' },
  { id: 'name_desc', label: 'Name: Z to A', shortLabel: 'Name Z → A', desc: 'Alphabetical order Z to A', icon: 'text-outline' },
  { id: 'duration_asc', label: 'Time: Shortest First', shortLabel: 'Quickest', desc: 'Services that take less time', icon: 'timer-outline' },
  { id: 'duration_desc', label: 'Time: Longest First', shortLabel: 'Longest Time', desc: 'Comprehensive full-session treatments', icon: 'time-outline' },
];

function formatCategoryLabel(cat: string) {
  if (!cat || cat === 'all') return 'All';
  if (cat.toLowerCase() === 'packages') return 'Packages';
  return cat
    .split(/[-_ ]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function getItemDurationMinutes(item: CatalogItem): number {
  if (item.duration_mins && typeof item.duration_mins === 'number') return item.duration_mins;
  if (item.duration && typeof item.duration === 'number') return item.duration;
  if (item.duration_label) {
    const hoursMatch = item.duration_label.match(/(\d+)\s*h/i);
    const minsMatch = item.duration_label.match(/(\d+)\s*m/i);
    let total = 0;
    if (hoursMatch) total += parseInt(hoursMatch[1], 10) * 60;
    if (minsMatch) total += parseInt(minsMatch[1], 10);
    if (total > 0) return total;
  }
  return 0;
}

export default function ServicesScreen() {
  const params = useLocalSearchParams<{
    autoSearch?: string;
    openBooking?: string;
    openCart?: string;
    category?: string;
  }>();
  const [activeTab, setActiveTab] = useState<string>('all');
  const [isSearchActive, setIsSearchActive] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<SortOption>('default');
  const [showSortModal, setShowSortModal] = useState<boolean>(false);

  const { data: catalog, isLoading, error } = useCatalog();
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [drawerInitialMode, setDrawerInitialMode] = useState<'cart' | 'checkout'>('cart');
  const { items: cartItems, totalItems, totalAmount, addItem, increment, decrement, getKey } = useCartStore();

  // If navigated here with category param, select that category tab
  useEffect(() => {
    if (params.category) {
      setActiveTab(params.category.toLowerCase());
    }
  }, [params.category]);

  // If navigated here with autoSearch=1, immediately activate search
  useEffect(() => {
    if (params.autoSearch === '1') {
      setIsSearchActive(true);
      setActiveTab('all');
    }
  }, [params.autoSearch]);

  // If navigated here with openBooking or openCart, immediately open the drawer
  useEffect(() => {
    if (params.openBooking === '1') {
      setDrawerInitialMode('checkout');
      setDrawerVisible(true);
    } else if (params.openCart === '1') {
      setDrawerInitialMode('cart');
      setDrawerVisible(true);
    }
  }, [params.openBooking, params.openCart]);

  // Derive category tabs from live catalog data, ensuring "Packages" is always present
  const categoryTabs = useMemo(() => {
    const tabs: { id: string; label: string }[] = [{ id: 'all', label: 'All' }];
    tabs.push({ id: 'packages', label: 'Packages' });
    if (catalog) {
      const cats = Array.from(new Set(catalog.map((i) => i.category).filter(Boolean)));
      cats.forEach((c) => {
        const normalized = c.toLowerCase();
        if (normalized !== 'packages' && normalized !== 'all') {
          tabs.push({ id: c, label: formatCategoryLabel(c) });
        }
      });
    }
    return tabs;
  }, [catalog]);

  // Filter by category tab, search query, and sort by chosen order
  const filtered = useMemo(() => {
    if (!catalog) return [];
    let list = catalog;

    // Filter by category if not 'all'
    if (activeTab === 'packages') {
      list = list.filter((i) => i.kind === 'package' || (i.category || '').toLowerCase() === 'packages');
    } else if (activeTab !== 'all') {
      const target = activeTab.toLowerCase().replace(/\s+/g, '-');
      list = list.filter((i) => {
        const itemCat = (i.category || '').toLowerCase().replace(/\s+/g, '-');
        return (
          itemCat === target ||
          itemCat.includes(target) ||
          target.includes(itemCat) ||
          (i.category || '').toLowerCase() === activeTab.toLowerCase()
        );
      });
    }

    // Filter by search query (name, category, description, variant label, features)
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((item) => {
        const nameMatch = item.name.toLowerCase().includes(q);
        const descMatch = (item.description || '').toLowerCase().includes(q);
        const catMatch = (item.category || '').toLowerCase().includes(q);
        const labelMatch = (item.label || '').toLowerCase().includes(q);
        const featMatch = (item.features || []).some((f) => f.toLowerCase().includes(q));
        return nameMatch || descMatch || catMatch || labelMatch || featMatch;
      });
    }

    // Apply sorting
    if (sortBy === 'price_asc') {
      list = [...list].sort((a, b) => a.price - b.price);
    } else if (sortBy === 'price_desc') {
      list = [...list].sort((a, b) => b.price - a.price);
    } else if (sortBy === 'name_asc') {
      list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'name_desc') {
      list = [...list].sort((a, b) => b.name.localeCompare(a.name));
    } else if (sortBy === 'duration_asc') {
      list = [...list].sort((a, b) => getItemDurationMinutes(a) - getItemDurationMinutes(b));
    } else if (sortBy === 'duration_desc') {
      list = [...list].sort((a, b) => getItemDurationMinutes(b) - getItemDurationMinutes(a));
    }

    return list;
  }, [catalog, activeTab, searchQuery, sortBy]);

  function getItemQty(item: CatalogItem): number {
    const key = item.kind === 'package'
      ? getKey({ isPackage: true, packageId: item.package_id ?? item.id })
      : getKey({ isPackage: false, variantId: item.variant_id ?? item.id });
    return cartItems.find((c) => {
      const ck = getKey({ isPackage: c.isPackage, variantId: c.variantId, packageId: c.packageId });
      return ck === key;
    })?.quantity ?? 0;
  }

  function handleAdd(item: CatalogItem) {
    addItem({
      isPackage: item.kind === 'package',
      variantId: item.kind === 'service' ? (item.variant_id ?? item.id) : undefined,
      packageId: item.kind === 'package' ? (item.package_id ?? item.id) : undefined,
      name: item.name + (item.label ? ' - ' + item.label : ''),
      price: item.price,
      duration: item.duration_mins ?? item.duration ?? 15,
    });
  }

  function handleIncrement(item: CatalogItem) {
    const key = item.kind === 'package'
      ? getKey({ isPackage: true, packageId: item.package_id ?? item.id })
      : getKey({ isPackage: false, variantId: item.variant_id ?? item.id });
    increment(key);
  }

  function handleDecrement(item: CatalogItem) {
    const key = item.kind === 'package'
      ? getKey({ isPackage: true, packageId: item.package_id ?? item.id })
      : getKey({ isPackage: false, variantId: item.variant_id ?? item.id });
    decrement(key);
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Header
        cartItemCount={totalItems}
        onSearchPress={() => {
          setIsSearchActive(true);
          setActiveTab('all');
        }}
        onCartPress={() => {
          setDrawerInitialMode('cart');
          setDrawerVisible(true);
        }}
        isSearchActive={isSearchActive}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSearchClose={() => {
          setIsSearchActive(false);
          setSearchQuery('');
        }}
        onDismissSearch={() => {
          setIsSearchActive(false);
        }}
        resultsCount={filtered.length}
        searchPlaceholder="Search services, packages, categories..."
      />

      {/* Category filter tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabBar}
        contentContainerStyle={styles.tabBarContent}
      >
        {categoryTabs.map((tab) => (
          <Pressable
            key={tab.id}
            style={[styles.tab, activeTab === tab.id && styles.tabActive]}
            onPress={() => setActiveTab(tab.id)}
          >
            <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Sorting bar & Quick Sort chips */}
      <View style={styles.controlsBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.sortChipsContent}
        >
          {/* Main Sort Modal Trigger */}
          <Pressable
            style={[styles.sortModalTrigger, sortBy !== 'default' && styles.sortModalTriggerActive]}
            onPress={() => setShowSortModal(true)}
            accessibilityRole="button"
          >
            <Ionicons
              name="swap-vertical"
              size={13}
              color={sortBy !== 'default' ? ElixColors.blue : ElixColors.ink}
            />
            <Text style={[styles.sortModalTriggerText, sortBy !== 'default' && styles.sortModalTriggerTextActive]}>
              {sortBy === 'default' ? 'Sort' : SORT_OPTIONS.find((s) => s.id === sortBy)?.shortLabel ?? 'Sort'}
            </Text>
            <Ionicons
              name="chevron-down"
              size={12}
              color={sortBy !== 'default' ? ElixColors.blue : ElixColors.inkMuted}
            />
          </Pressable>

          {/* Quick Sort Direct Chips */}
          {SORT_OPTIONS.map((opt) => {
            const isSelected = sortBy === opt.id;
            return (
              <Pressable
                key={opt.id}
                style={[styles.sortChip, isSelected && styles.sortChipActive]}
                onPress={() => setSortBy(isSelected && opt.id !== 'default' ? 'default' : opt.id)}
              >
                <Ionicons
                  name={opt.icon as any}
                  size={12}
                  color={isSelected ? '#FFFFFF' : ElixColors.inkMuted}
                />
                <Text style={[styles.sortChipText, isSelected && styles.sortChipTextActive]}>
                  {opt.shortLabel}
                </Text>
                {isSelected && opt.id !== 'default' && (
                  <Ionicons name="close-circle" size={12} color="#FFFFFF" style={{ marginLeft: 3 }} />
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Results Count & Active Sort Info Bar */}
      <View style={styles.resultsInfoBar}>
        <Text style={styles.resultsInfoText}>
          {filtered.length} {filtered.length === 1 ? 'item' : 'items'}
          {activeTab === 'packages'
            ? ' in Packages'
            : activeTab !== 'all'
            ? ` in ${formatCategoryLabel(activeTab)}`
            : ''}
        </Text>
        {sortBy !== 'default' && (
          <Pressable
            style={styles.activeSortReset}
            onPress={() => setSortBy('default')}
            hitSlop={6}
          >
            <Text style={styles.activeSortResetText}>
              Sorted by: {SORT_OPTIONS.find((s) => s.id === sortBy)?.shortLabel}
            </Text>
            <Ionicons name="close-circle" size={13} color={ElixColors.blue} />
          </Pressable>
        )}
      </View>

      {/* Search results status row */}
      {searchQuery.trim().length > 0 && (
        <View style={styles.searchStatusRow}>
          <Text style={styles.searchStatusText}>
            {filtered.length} {filtered.length === 1 ? 'service' : 'services'} found for "{searchQuery}"
          </Text>
          <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
            <Text style={styles.searchStatusClear}>Clear</Text>
          </Pressable>
        </View>
      )}

      {/* Service list */}
      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: totalItems > 0 ? 120 : 40 }}
      >
        {isLoading ? (
          <ActivityIndicator color={ElixColors.blue} size="large" style={{ marginTop: 60 }} />
        ) : error ? (
          <View style={styles.errorState}>
            <Ionicons name="wifi-outline" size={40} color={ElixColors.inkMuted} />
            <Text style={styles.errorText}>Could not load services. Check your connection.</Text>
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="search-outline" size={32} color={ElixColors.blue} />
            </View>
            <Text style={styles.emptyTitle}>No services found</Text>
            <Text style={styles.emptySub}>
              {searchQuery.trim()
                ? `We couldn't find any service matching "${searchQuery}".`
                : 'No services available in this category.'}
            </Text>
            <Button
              title="View All Services"
              variant="outline"
              size="sm"
              onPress={() => {
                setSearchQuery('');
                setActiveTab('all');
                setIsSearchActive(false);
              }}
              style={{ marginTop: 14 }}
            />
          </View>
        ) : (
          <View style={{ padding: 16, gap: 16 }}>
            {filtered.map((item) => {
              const qty = getItemQty(item);
              const originalPrice = item.mrp || item.original_price;
              const discount = originalPrice && originalPrice > item.price
                ? Math.round((1 - item.price / originalPrice) * 100)
                : (item.discount_pct || 0);

              const photoUrl = resolveImageUrl(item.photo || item.image);
              const durationText = item.duration_label || (item.duration_mins ? `${item.duration_mins} mins` : (item.duration ? `${item.duration} mins` : null));
              const ratingVal = item.rating ? Number(item.rating).toFixed(1) : '4.8';

              return (
                <View key={`${item.kind}-${item.id}-${item.variant_id ?? ''}`} style={styles.serviceCard}>
                  <View style={styles.cardMainRow}>
                    {/* Left Column: Info & Price (Tappable to View Details) */}
                    <Pressable
                      style={styles.cardInfoCol}
                      onPress={() => router.push(`/services/${item.id}` as any)}
                    >
                      {item.kind === 'package' && (
                        <View style={styles.packageBadge}>
                          <Text style={styles.packageBadgeText}>PACKAGE</Text>
                        </View>
                      )}

                      <Text style={styles.serviceName}>{item.name}{item.label ? ' - ' + item.label : ''}</Text>

                      <View style={styles.metaRow}>
                        <View style={styles.ratingPill}>
                          <Ionicons name="star" size={11} color={ElixColors.blue} />
                          <Text style={styles.ratingText}>{ratingVal}★</Text>
                        </View>
                        {durationText ? (
                          <>
                            <Ionicons name="time-outline" size={12} color={ElixColors.inkMuted} />
                            <Text style={styles.metaText}>{durationText}</Text>
                          </>
                        ) : null}
                        <Text style={styles.metaDot}>·</Text>
                        <Text style={styles.metaText}>{item.category}</Text>
                      </View>

                      {item.description ? (
                        <Text style={styles.serviceDesc} numberOfLines={2}>{item.description}</Text>
                      ) : null}

                      {item.features && item.features.length > 0 && (
                        <View style={styles.featureList}>
                          {item.features.slice(0, 2).map((f, i) => (
                            <View key={i} style={styles.featureItem}>
                              <Ionicons name="checkmark-circle" size={12} color={ElixColors.green} />
                              <Text style={styles.featureText} numberOfLines={1}>{f}</Text>
                            </View>
                          ))}
                        </View>
                      )}

                      <View style={styles.priceRow}>
                        <View style={styles.priceGroup}>
                          <Text style={styles.price}>Rs.{Math.round(item.price)}</Text>
                          {discount > 0 && originalPrice && (
                            <>
                              <Text style={styles.originalPrice}>Rs.{Math.round(originalPrice)}</Text>
                              <View style={styles.discountPill}>
                                <Text style={styles.discountText}>{discount}% OFF</Text>
                              </View>
                            </>
                          )}
                        </View>
                      </View>

                      <View style={styles.viewDetailsRow}>
                        <Text style={styles.viewDetailsText}>View Details</Text>
                        <Ionicons name="chevron-forward" size={12} color={ElixColors.blue} />
                      </View>
                    </Pressable>

                    {/* Right Column: Service Image & Add/Qty Button */}
                    <View style={styles.cardMediaCol}>
                      <Pressable
                        style={styles.imageContainer}
                        onPress={() => router.push(`/services/${item.id}` as any)}
                      >
                        {photoUrl ? (
                          <Image
                            source={{ uri: photoUrl }}
                            style={styles.serviceImage}
                            resizeMode="cover"
                          />
                        ) : (
                          <View style={styles.imagePlaceholder}>
                            <Ionicons name="sparkles" size={26} color={ElixColors.blue} />
                          </View>
                        )}
                      </Pressable>

                      <View style={styles.actionBtnWrap}>
                        {qty === 0 ? (
                          <Pressable style={styles.addBtn} onPress={() => handleAdd(item)}>
                            <Ionicons name="add" size={15} color={ElixColors.blue} />
                            <Text style={styles.addBtnText}>Add</Text>
                          </Pressable>
                        ) : (
                          <View style={styles.qtyControl}>
                            <Pressable style={styles.qtyBtn} onPress={() => handleDecrement(item)}>
                              <Ionicons name="remove" size={14} color={ElixColors.blue} />
                            </Pressable>
                            <Text style={styles.qtyValue}>{qty}</Text>
                            <Pressable style={styles.qtyBtn} onPress={() => handleIncrement(item)}>
                              <Ionicons name="add" size={14} color={ElixColors.blue} />
                            </Pressable>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Floating cart bar */}
      {totalItems > 0 && (
        <View style={styles.cartBar}>
          <View>
            <Text style={styles.cartBarItems}>{totalItems} item{totalItems !== 1 ? 's' : ''} added</Text>
            <Text style={styles.cartBarAmount}>Rs.{totalAmount.toFixed(0)}</Text>
          </View>
          <Pressable
            style={styles.cartBarBtn}
            onPress={() => {
              setDrawerInitialMode('checkout');
              setDrawerVisible(true);
            }}
          >
            <Text style={styles.cartBarBtnText}>Proceed to Booking</Text>
            <Ionicons name="arrow-forward" size={16} color="#fff" />
          </Pressable>
        </View>
      )}
      <BookingDrawer
        visible={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        initialMode={drawerInitialMode}
      />

      {/* Sort Bottom Sheet Modal */}
      <Modal
        visible={showSortModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSortModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowSortModal(false)}
        >
          <Pressable style={styles.sortSheetContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetTitle}>Sort Services & Packages</Text>
                <Text style={styles.sheetSubtitle}>Choose how you want items ordered</Text>
              </View>
              {sortBy !== 'default' && (
                <Pressable
                  onPress={() => {
                    setSortBy('default');
                    setShowSortModal(false);
                  }}
                  hitSlop={8}
                >
                  <Text style={styles.sheetResetText}>Reset</Text>
                </Pressable>
              )}
            </View>

            <View style={styles.sortOptionsList}>
              {SORT_OPTIONS.map((opt) => {
                const isSelected = sortBy === opt.id;
                return (
                  <Pressable
                    key={opt.id}
                    style={[styles.sortOptionItem, isSelected && styles.sortOptionItemSelected]}
                    onPress={() => {
                      setSortBy(opt.id);
                      setShowSortModal(false);
                    }}
                  >
                    <View style={styles.sortOptionLeft}>
                      <View style={[styles.sortIconCircle, isSelected && styles.sortIconCircleSelected]}>
                        <Ionicons
                          name={opt.icon as any}
                          size={16}
                          color={isSelected ? ElixColors.blue : ElixColors.inkMuted}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.sortOptionLabel, isSelected && styles.sortOptionLabelSelected]}>
                          {opt.label}
                        </Text>
                        <Text style={styles.sortOptionSub}>{opt.desc}</Text>
                      </View>
                    </View>
                    <View style={[styles.sortRadio, isSelected && styles.sortRadioSelected]}>
                      {isSelected && <View style={styles.sortRadioInner} />}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: ElixColors.surface1 },
  tabBar: {
    maxHeight: 52,
    backgroundColor: ElixColors.white,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  tabBarContent: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  tab: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, backgroundColor: '#F3F4F6' },
  tabActive: { backgroundColor: ElixColors.blue },
  tabText: { fontSize: 13, fontWeight: '600', color: ElixColors.inkMuted },
  tabTextActive: { color: '#fff' },

  controlsBar: {
    backgroundColor: ElixColors.white,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    paddingVertical: 8,
  },
  sortChipsContent: {
    paddingHorizontal: 16,
    gap: 8,
    alignItems: 'center',
  },
  sortModalTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  sortModalTriggerActive: {
    backgroundColor: '#EFF6FF',
    borderColor: ElixColors.blue,
  },
  sortModalTriggerText: {
    fontSize: 12,
    fontWeight: '700',
    color: ElixColors.ink,
  },
  sortModalTriggerTextActive: {
    color: ElixColors.blue,
  },
  sortChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  sortChipActive: {
    backgroundColor: ElixColors.blue,
    borderColor: ElixColors.blue,
  },
  sortChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: ElixColors.inkMuted,
  },
  sortChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  resultsInfoBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 2,
  },
  resultsInfoText: {
    fontSize: 12,
    fontWeight: '600',
    color: ElixColors.inkMuted,
  },
  activeSortReset: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  activeSortResetText: {
    fontSize: 11,
    fontWeight: '700',
    color: ElixColors.blue,
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  sortSheetContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 34,
    paddingTop: 12,
    maxHeight: '80%',
  },
  sheetHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginBottom: 14,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: ElixColors.ink,
  },
  sheetSubtitle: {
    fontSize: 12,
    color: ElixColors.inkMuted,
    marginTop: 2,
  },
  sheetResetText: {
    fontSize: 13,
    fontWeight: '700',
    color: ElixColors.blue,
  },
  sortOptionsList: {
    gap: 8,
  },
  sortOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sortOptionItemSelected: {
    backgroundColor: '#EFF6FF',
    borderColor: ElixColors.blue,
  },
  sortOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  sortIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sortIconCircleSelected: {
    backgroundColor: '#DBEAFE',
    borderColor: '#BFDBFE',
  },
  sortOptionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: ElixColors.ink,
  },
  sortOptionLabelSelected: {
    color: ElixColors.blue,
  },
  sortOptionSub: {
    fontSize: 11,
    color: ElixColors.inkMuted,
    marginTop: 1,
  },
  sortRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sortRadioSelected: {
    borderColor: ElixColors.blue,
  },
  sortRadioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: ElixColors.blue,
  },

  searchStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: ElixColors.blueLight,
    borderBottomWidth: 1,
    borderBottomColor: '#C7D2FE',
  },
  searchStatusText: {
    fontSize: 12,
    fontWeight: ElixTypography.weights.medium,
    color: ElixColors.blue,
  },
  searchStatusClear: {
    fontSize: 12,
    fontWeight: ElixTypography.weights.bold,
    color: ElixColors.blue,
    textDecorationLine: 'underline',
  },

  container: { flex: 1 },
  errorState: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
  errorText: { fontSize: 14, color: ElixColors.inkMuted, textAlign: 'center', marginTop: 8 },

  emptyContainer: {
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: 32,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: ElixColors.blueLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: ElixTypography.weights.bold,
    color: ElixColors.ink,
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 13,
    color: ElixColors.inkMuted,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 8,
  },

  serviceCard: {
    backgroundColor: ElixColors.white,
    borderRadius: ElixRadii.lg,
    padding: 16,
    ...ElixShadows.md,
  },
  cardMainRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  cardInfoCol: {
    flex: 1,
    justifyContent: 'space-between',
  },
  cardMediaCol: {
    width: 96,
    alignItems: 'center',
    flexShrink: 0,
  },
  imageContainer: {
    width: 96,
    height: 96,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  serviceImage: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
  },
  actionBtnWrap: {
    marginTop: 10,
    width: '100%',
  },
  packageBadge: {
    alignSelf: 'flex-start',
    backgroundColor: ElixColors.blueLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 8,
  },
  packageBadgeText: { fontSize: 10, fontWeight: '800', color: ElixColors.blue, letterSpacing: 0.5 },
  serviceName: { fontSize: 15, fontWeight: '700', color: ElixColors.ink, marginBottom: 6 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6, flexWrap: 'wrap' },
  ratingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: ElixColors.blueLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  ratingText: { fontSize: 11, fontWeight: '700', color: ElixColors.blue },
  metaText: { fontSize: 12, color: ElixColors.inkMuted },
  metaDot: { color: ElixColors.inkMuted },
  serviceDesc: { fontSize: 13, color: ElixColors.inkMuted, lineHeight: 18, marginBottom: 8 },
  featureList: { gap: 4, marginBottom: 10 },
  featureItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  featureText: { fontSize: 12, color: ElixColors.inkMuted, flex: 1 },
  priceRow: { marginTop: 4 },
  viewDetailsRow: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 6 },
  viewDetailsText: { fontSize: 12, fontWeight: '700', color: ElixColors.blue },
  priceGroup: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  price: { fontSize: 18, fontWeight: '800', color: ElixColors.ink },
  originalPrice: { fontSize: 13, color: ElixColors.inkMuted, textDecorationLine: 'line-through' },
  discountPill: { backgroundColor: '#D1FAE5', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  discountText: { fontSize: 10, fontWeight: '700', color: '#065F46' },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    borderWidth: 1.5,
    borderColor: ElixColors.blue,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    paddingVertical: 7,
    width: '100%',
  },
  addBtnText: { fontSize: 13, fontWeight: '700', color: ElixColors.blue },
  qtyControl: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderColor: ElixColors.blue,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#EFF6FF',
    width: '100%',
  },
  qtyBtn: { paddingHorizontal: 7, paddingVertical: 7, alignItems: 'center', justifyContent: 'center' },
  qtyValue: { fontSize: 13, fontWeight: '700', color: ElixColors.ink },
  cartBar: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    backgroundColor: ElixColors.ink,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  cartBarItems: { fontSize: 11, color: '#9CA3AF', fontWeight: '500' },
  cartBarAmount: { fontSize: 18, fontWeight: '800', color: '#fff' },
  cartBarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: ElixColors.blue,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  cartBarBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
});
