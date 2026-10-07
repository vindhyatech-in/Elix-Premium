import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ElixColors, ElixRadii, ElixTypography, ElixShadows } from '@/constants/theme';

interface HeaderProps {
  location?: string;
  onLocationPress?: () => void;
  onSearchPress?: () => void;
  onCartPress?: () => void;
  cartItemCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  location = 'Indore, MP',
  onLocationPress,
  onSearchPress,
  onCartPress,
  cartItemCount = 0,
}) => {
  return (
    <View style={styles.container}>
      <Pressable onPress={onLocationPress} style={styles.locationChip}>
        <Ionicons name="location-sharp" size={16} color={ElixColors.blue} />
        <Text style={styles.locationText}>{location}</Text>
        <Ionicons name="chevron-down" size={14} color={ElixColors.inkMuted} style={styles.chevron} />
      </Pressable>

      <View style={styles.actions}>
        <Pressable onPress={onSearchPress} style={styles.iconButton} accessibilityLabel="Search">
          <Ionicons name="search-outline" size={20} color={ElixColors.ink} />
        </Pressable>

        <Pressable onPress={onCartPress} style={styles.iconButton} accessibilityLabel="Cart">
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
  },
  locationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ElixColors.surface1,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: ElixRadii.pill,
    borderWidth: 1,
    borderColor: ElixColors.borderHairline,
  },
  locationText: {
    marginLeft: 6,
    fontSize: ElixTypography.sizes.sm,
    fontWeight: ElixTypography.weights.bold,
    color: ElixColors.ink,
  },
  chevron: {
    marginLeft: 4,
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
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: ElixColors.urgentRed,
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
});
