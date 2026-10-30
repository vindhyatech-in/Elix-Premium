import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  Platform,
  Image,
  ImageSourcePropType,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ElixColors, ElixRadii, ElixTypography } from '@/constants/theme';

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
  searchPlaceholder?: string;
}

export const Header: React.FC<HeaderProps> = ({
  location = 'Indore, MP',
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
  searchPlaceholder = 'Search services, packages...',
}) => {
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (isSearchActive) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isSearchActive]);

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

  if (isSearchActive) {
    return (
      <View style={styles.container}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={ElixColors.blue} style={styles.searchBarIcon} />
          <TextInput
            ref={inputRef}
            style={styles.searchInput}
            placeholder={searchPlaceholder}
            placeholderTextColor={ElixColors.inkMuted}
            value={searchQuery}
            onChangeText={onSearchChange}
            autoFocus
            returnKeyType="search"
          />
          {searchQuery && searchQuery.length > 0 ? (
            <Pressable onPress={() => onSearchChange?.('')} hitSlop={10} style={styles.clearBtn} accessibilityLabel="Clear search text">
              <Ionicons name="close-circle" size={18} color={ElixColors.inkMuted} />
            </Pressable>
          ) : null}
        </View>
        <Pressable onPress={onSearchClose} style={styles.cancelBtn} hitSlop={8} accessibilityLabel="Cancel search">
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.leftGroup}>
        {showLogo && (
          <Pressable
            onPress={handleLogoPress}
            style={styles.logoBtn}
            hitSlop={8}
            accessibilityLabel="Elix Home"
          >
            {logoSource ? (
              <Image source={logoSource} style={styles.logoImg} resizeMode="contain" />
            ) : (
              <View style={styles.brandWordmark}>
                <Text style={styles.logoText}>
                  <Text style={styles.logoAccent}>E</Text>LIX
                </Text>
              </View>
            )}
          </Pressable>
        )}

        <Pressable
          onPress={onLocationPress}
          style={styles.locationChip}
          hitSlop={6}
          accessibilityLabel="Location selector"
        >
          <Ionicons name="location-sharp" size={13} color={ElixColors.blue} />
          <Text style={styles.locationText} numberOfLines={1}>{location}</Text>
          <Ionicons name="chevron-down" size={12} color={ElixColors.inkMuted} style={styles.chevron} />
        </Pressable>
      </View>

      <View style={styles.actions}>
        <Pressable
          onPress={onSearchPress}
          style={styles.iconButton}
          hitSlop={8}
          accessibilityLabel="Search services"
        >
          <Ionicons name="search-outline" size={20} color={ElixColors.ink} />
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
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoImg: {
    width: 60,
    height: 24,
  },
  logoText: {
    fontSize: 18,
    fontWeight: '900',
    color: ElixColors.ink,
    letterSpacing: 1.5,
  },
  logoAccent: {
    color: ElixColors.blue,
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
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ElixColors.surface1,
    borderRadius: ElixRadii.pill,
    borderWidth: 1.5,
    borderColor: ElixColors.blue,
    paddingHorizontal: 12,
    height: 40,
  },
  searchBarIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: ElixColors.ink,
    paddingVertical: 0,
    height: '100%',
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' as any } : {}),
  },
  clearBtn: {
    padding: 4,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' as any } : {}),
  },
  cancelBtn: {
    marginLeft: 10,
    paddingVertical: 6,
    paddingHorizontal: 6,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' as any } : {}),
  },
  cancelText: {
    fontSize: 14,
    color: ElixColors.blue,
    fontWeight: ElixTypography.weights.semiBold,
  },
});
