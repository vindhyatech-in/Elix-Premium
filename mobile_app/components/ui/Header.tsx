import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  Platform,
  Image,
  ImageSourcePropType,
  Modal,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ElixColors, ElixRadii, ElixTypography } from '@/constants/theme';
import { useLocationStore } from '@/store/locationStore';
import { LocationModal } from './LocationModal';

export interface HeaderProps {
  location?: string;
  onLocationPress?: () => void;
  onSearchPress?: () => void;
  onCartPress?: () => void;
  onLogoPress?: () => void;
  logoSource?: ImageSourcePropType;
  showLogo?: boolean;
  cartItemCount?: number;
  isSearchActive?: boolean;
  searchQuery?: string;
  onSearchChange?: (text: string) => void;
  onSearchClose?: () => void;
  onDismissSearch?: () => void;
  searchPlaceholder?: string;
  resultsCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  location,
  onLocationPress,
  onSearchPress,
  onCartPress,
  onLogoPress,
  logoSource,
  showLogo = true,
  cartItemCount = 0,
  isSearchActive = false,
  searchQuery = '',
  onSearchChange,
  onSearchClose,
  onDismissSearch,
  searchPlaceholder = 'Search services, packages...',
  resultsCount,
}) => {
  const inputRef = useRef<TextInput>(null);
  const storeLocation = useLocationStore((s) => s.selectedLocation);
  const activeLocation = location ?? storeLocation;
  const [locationModalVisible, setLocationModalVisible] = useState(false);

  useEffect(() => {
    if (isSearchActive) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isSearchActive]);

  const handleLocationPress = () => {
    if (onLocationPress) {
      onLocationPress();
    } else {
      setLocationModalVisible(true);
    }
  };

  const handleLogoPress = () => {
    if (onLogoPress) {
      onLogoPress();
    } else {
      try {
        router.push('/(tabs)');
      } catch (e) {
        // no-op
      }
    }
  };

  const isSearchHighlight = isSearchActive || (searchQuery && searchQuery.trim().length > 0);

  return (
    <View style={styles.container}>
      <View style={styles.leftGroup}>
        {showLogo && (
          <Pressable
            onPress={handleLogoPress}
            style={styles.logoBtn}
            hitSlop={8}
            accessibilityLabel="Elix Premium Home"
          >
            {logoSource ? (
              <Image source={logoSource} style={styles.logoImg} resizeMode="contain" />
            ) : (
              <View style={styles.brandWordmark}>
                <Text style={styles.logoText}>
                  <Text style={styles.logoAccent}>E</Text>LIX
                </Text>
                <Text style={styles.logoSub}>PREMIUM</Text>
              </View>
            )}
          </Pressable>
        )}

        <Pressable
          onPress={handleLocationPress}
          style={styles.locationChip}
          hitSlop={6}
          accessibilityLabel="Location selector"
        >
          <Ionicons name="location-sharp" size={13} color={ElixColors.blue} />
          <Text style={styles.locationText} numberOfLines={1}>{activeLocation}</Text>
          <Ionicons name="chevron-down" size={12} color={ElixColors.inkMuted} style={styles.chevron} />
        </Pressable>
      </View>

      <View style={styles.actions}>
        <Pressable
          onPress={onSearchPress}
          style={[styles.iconButton, isSearchHighlight && styles.iconButtonActive]}
          hitSlop={8}
          accessibilityLabel="Search services"
        >
          <Ionicons
            name={isSearchHighlight ? "search" : "search-outline"}
            size={20}
            color={isSearchHighlight ? ElixColors.blue : ElixColors.ink}
          />
        </Pressable>

        <Pressable
          onPress={onCartPress}
          style={styles.iconButton}
          hitSlop={8}
          accessibilityLabel="Cart"
        >
          <Ionicons name="bag-handle-outline" size={20} color={ElixColors.ink} />
          {cartItemCount > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{cartItemCount}</Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      <LocationModal
        visible={locationModalVisible}
        onClose={() => setLocationModalVisible(false)}
      />

      {/* Search Dropdown Popup Modal */}
      <Modal
        visible={isSearchActive}
        transparent
        animationType="fade"
        onRequestClose={onDismissSearch ?? onSearchClose}
      >
        <Pressable style={styles.searchModalBackdrop} onPress={onDismissSearch ?? onSearchClose}>
          <Pressable style={styles.searchDropdownCard} onPress={(e) => e.stopPropagation()}>
            {/* Inner Search Box Row */}
            <View style={styles.searchBoxRow}>
              <View style={styles.searchBoxInputContainer}>
                <Ionicons name="search" size={17} color={ElixColors.blue} style={{ marginRight: 8 }} />
                <TextInput
                  ref={inputRef}
                  style={styles.dropdownSearchInput}
                  placeholder={searchPlaceholder}
                  placeholderTextColor={ElixColors.inkMuted}
                  value={searchQuery}
                  onChangeText={onSearchChange}
                  autoFocus
                  returnKeyType="search"
                  onSubmitEditing={onDismissSearch ?? onSearchClose}
                />
                {searchQuery && searchQuery.length > 0 ? (
                  <Pressable onPress={() => onSearchChange?.('')} hitSlop={8} style={{ padding: 4 }}>
                    <Ionicons name="close-circle" size={17} color={ElixColors.inkMuted} />
                  </Pressable>
                ) : null}
              </View>

              <Pressable
                onPress={onSearchClose}
                style={styles.searchCancelBtn}
                hitSlop={8}
              >
                <Text style={styles.searchCancelText}>Cancel</Text>
              </Pressable>
            </View>

            {/* Quick Suggestions / Popular Searches */}
            <View style={styles.suggestionsContainer}>
              <Text style={styles.suggestionsTitle}>POPULAR SEARCHES:</Text>
              <View style={styles.suggestionChipsWrap}>
                {['Packages', 'Threading', 'Facial', 'Waxing', 'Clean Up', 'Manicure'].map((tag) => (
                  <Pressable
                    key={tag}
                    style={[
                      styles.suggestionChip,
                      searchQuery.toLowerCase() === tag.toLowerCase() && styles.suggestionChipActive,
                    ]}
                    onPress={() => {
                      onSearchChange?.(tag);
                    }}
                  >
                    <Text
                      style={[
                        styles.suggestionChipText,
                        searchQuery.toLowerCase() === tag.toLowerCase() && styles.suggestionChipTextActive,
                      ]}
                    >
                      {tag}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* If query has text, show results count and View Results button */}
            {searchQuery && searchQuery.trim().length > 0 ? (
              <View style={styles.searchDropdownFooter}>
                <Text style={styles.searchDropdownCount}>
                  {resultsCount !== undefined
                    ? `${resultsCount} item${resultsCount === 1 ? '' : 's'} matching`
                    : `Searching for "${searchQuery}"`}
                </Text>
                <Pressable
                  style={styles.viewResultsBtn}
                  onPress={onDismissSearch ?? onSearchClose}
                >
                  <Text style={styles.viewResultsBtnText}>View Results</Text>
                  <Ionicons name="arrow-forward" size={13} color="#FFFFFF" />
                </Pressable>
              </View>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: ElixColors.surface2,
    borderBottomWidth: 1,
    borderBottomColor: ElixColors.borderHairline,
    minHeight: 58,
  },
  leftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 1,
  },
  logoBtn: {
    paddingVertical: 4,
    paddingRight: 2,
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web' ? { cursor: 'pointer' as any } : {}),
  },
  brandWordmark: {
    flexDirection: 'column',
    justifyContent: 'center',
  },
  logoImg: {
    width: 60,
    height: 24,
  },
  logoText: {
    fontSize: 15,
    fontWeight: '900',
    color: ElixColors.ink,
    letterSpacing: 1.5,
    lineHeight: 16,
  },
  logoAccent: {
    color: ElixColors.blue,
  },
  logoSub: {
    fontSize: 8,
    fontWeight: '800',
    color: ElixColors.blue,
    letterSpacing: 1.5,
    marginTop: 1,
  },
  locationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ElixColors.surface1,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: ElixRadii.pill,
    borderWidth: 1,
    borderColor: ElixColors.borderHairline,
    maxWidth: 135,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' as any } : {}),
  },
  locationText: {
    marginLeft: 4,
    fontSize: 12,
    fontWeight: ElixTypography.weights.bold,
    color: ElixColors.ink,
    maxWidth: 85,
  },
  chevron: {
    marginLeft: 2,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: ElixRadii.pill,
    backgroundColor: ElixColors.surface1,
    borderWidth: 1,
    borderColor: ElixColors.borderHairline,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    ...(Platform.OS === 'web' ? { cursor: 'pointer' as any } : {}),
  },
  iconButtonActive: {
    backgroundColor: '#EFF6FF',
    borderColor: ElixColors.blue,
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: ElixColors.blue,
    borderRadius: ElixRadii.pill,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: ElixColors.white,
    fontSize: 10,
    fontWeight: ElixTypography.weights.bold,
  },

  // Dropdown popup search styles
  searchModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    paddingTop: Platform.OS === 'web' ? 58 : 66,
    paddingHorizontal: 16,
  },
  searchDropdownCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 10,
  },
  searchBoxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchBoxInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ElixColors.surface1,
    borderRadius: ElixRadii.pill,
    borderWidth: 1.5,
    borderColor: ElixColors.blue,
    paddingHorizontal: 12,
    height: 42,
  },
  dropdownSearchInput: {
    flex: 1,
    fontSize: 14,
    color: ElixColors.ink,
    borderWidth: 0,
    borderColor: 'transparent',
    backgroundColor: 'transparent',
    paddingVertical: 0,
    height: '100%',
    ...(Platform.OS === 'web'
      ? ({
          outlineStyle: 'none',
          outlineWidth: 0,
        } as any)
      : {}),
  },
  searchCancelBtn: {
    paddingVertical: 6,
    paddingHorizontal: 4,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' as any } : {}),
  },
  searchCancelText: {
    fontSize: 14,
    color: ElixColors.blue,
    fontWeight: ElixTypography.weights.semiBold,
  },
  suggestionsContainer: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  suggestionsTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: ElixColors.inkMuted,
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  suggestionChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  suggestionChip: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  suggestionChipActive: {
    backgroundColor: '#EFF6FF',
    borderColor: ElixColors.blue,
  },
  suggestionChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: ElixColors.ink,
  },
  suggestionChipTextActive: {
    color: ElixColors.blue,
    fontWeight: '700',
  },
  searchDropdownFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  searchDropdownCount: {
    fontSize: 12,
    fontWeight: '600',
    color: ElixColors.inkMuted,
  },
  viewResultsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: ElixColors.blue,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  viewResultsBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});
