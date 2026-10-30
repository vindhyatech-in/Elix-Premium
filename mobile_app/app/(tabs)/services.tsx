import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { ElixColors, ElixRadii, ElixTypography, ElixShadows } from '@/constants/theme';
import { Header } from '@/components/ui/Header';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useCatalog } from '@/hooks/useCatalog';
import { useCartStore } from '@/store/cartStore';
import type { CatalogItem } from '@/types/api';
import { BookingDrawer } from '@/components/booking/BookingDrawer';

export default function ServicesScreen() {
  const params = useLocalSearchParams<{ autoSearch?: string; openBooking?: string; openCart?: string }>();
  const [activeTab, setActiveTab] = useState<string>('all');
  const [isSearchActive, setIsSearchActive] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const { data: catalog, isLoading, error } = useCatalog();
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [drawerInitialMode, setDrawerInitialMode] = useState<'cart' | 'checkout'>('cart');
  const { items: cartItems, totalItems, totalAmount, addItem, increment, decrement, getKey } = useCartStore();

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

  // Derive category tabs from live catalog data
  const categoryTabs = useMemo(() => {
    if (!catalog) return [{ id: 'all', label: 'All' }];
    const cats = Array.from(new Set(catalog.map((i) => i.category).filter(Boolean)));
    return [{ id: 'all', label: 'All' }, ...cats.map((c) => ({ id: c, label: c }))];
  }, [catalog]);

  // Filter by category tab AND search query
  const filtered = useMemo(() => {
    if (!catalog) return [];
    let list = catalog;

    // Filter by category if not 'all'
    if (activeTab !== 'all') {
      list = list.filter((i) => i.category === activeTab);
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

    return list;
  }, [catalog, activeTab, searchQuery]);

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
      duration: item.duration,
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
        location="Indore, MP"
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
              const discount = item.original_price && item.original_price > item.price
                ? Math.round((1 - item.price / item.original_price) * 100)
                : 0;
              return (
                <View key={`${item.kind}-${item.id}-${item.variant_id ?? ''}`} style={styles.serviceCard}>
                  {item.kind === 'package' && (
                    <View style={styles.packageBadge}>
                      <Text style={styles.packageBadgeText}>PACKAGE</Text>
                    </View>
                  )}

                  <Text style={styles.serviceName}>{item.name}{item.label ? ' - ' + item.label : ''}</Text>

                  <View style={styles.metaRow}>
                    <View style={styles.ratingPill}>
                      <Ionicons name="star" size={11} color={ElixColors.blue} />
                      <Text style={styles.ratingText}>4.8+</Text>
                    </View>
                    <Ionicons name="time-outline" size={12} color={ElixColors.inkMuted} />
                    <Text style={styles.metaText}>{item.duration} mins</Text>
                    <Text style={styles.metaDot}>·</Text>
                    <Text style={styles.metaText}>{item.category}</Text>
                  </View>

                  {item.description ? (
                    <Text style={styles.serviceDesc} numberOfLines={2}>{item.description}</Text>
                  ) : null}

                  {item.features && item.features.length > 0 && (
                    <View style={styles.featureList}>
                      {item.features.slice(0, 3).map((f, i) => (
                        <View key={i} style={styles.featureItem}>
                          <Ionicons name="checkmark-circle" size={13} color={ElixColors.green} />
                          <Text style={styles.featureText}>{f}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  <View style={styles.priceRow}>
                    <View style={styles.priceGroup}>
                      <Text style={styles.price}>Rs.{item.price}</Text>
                      {discount > 0 && item.original_price && (
                        <>
                          <Text style={styles.originalPrice}>Rs.{item.original_price}</Text>
                          <View style={styles.discountPill}>
                            <Text style={styles.discountText}>{discount}% OFF</Text>
                          </View>
                        </>
                      )}
                    </View>

                    {qty === 0 ? (
                      <Pressable style={styles.addBtn} onPress={() => handleAdd(item)}>
                        <Ionicons name="add" size={16} color={ElixColors.blue} />
                        <Text style={styles.addBtnText}>Add</Text>
                      </Pressable>
                    ) : (
                      <View style={styles.qtyControl}>
                        <Pressable style={styles.qtyBtn} onPress={() => handleDecrement(item)}>
                          <Ionicons name="remove" size={16} color={ElixColors.blue} />
                        </Pressable>
                        <Text style={styles.qtyValue}>{qty}</Text>
                        <Pressable style={styles.qtyBtn} onPress={() => handleIncrement(item)}>
                          <Ionicons name="add" size={16} color={ElixColors.blue} />
                        </Pressable>
                      </View>
                    )}
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
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6 },
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
  featureList: { gap: 4, marginBottom: 12 },
  featureItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  featureText: { fontSize: 12, color: ElixColors.inkMuted },
  priceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  priceGroup: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  price: { fontSize: 18, fontWeight: '800', color: ElixColors.ink },
  originalPrice: { fontSize: 13, color: ElixColors.inkMuted, textDecorationLine: 'line-through' },
  discountPill: { backgroundColor: '#D1FAE5', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  discountText: { fontSize: 10, fontWeight: '700', color: '#065F46' },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1.5,
    borderColor: ElixColors.blue,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  addBtnText: { fontSize: 13, fontWeight: '700', color: ElixColors.blue },
  qtyControl: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: ElixColors.blue,
    borderRadius: 10,
    overflow: 'hidden',
  },
  qtyBtn: { paddingHorizontal: 10, paddingVertical: 7, backgroundColor: '#EFF6FF' },
  qtyValue: { paddingHorizontal: 12, fontSize: 14, fontWeight: '700', color: ElixColors.ink },
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
