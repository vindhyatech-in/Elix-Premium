import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { ElixColors, ElixRadii, ElixTypography } from '@/constants/theme';

export type BadgeVariant = 'urgent' | 'discount' | 'rating' | 'category' | 'neutral';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  icon?: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export const Badge: React.FC<BadgeProps> = ({
  label,
  variant = 'category',
  icon,
  style,
  textStyle,
}) => {
  const getColors = () => {
    switch (variant) {
      case 'urgent':
        return { bg: ElixColors.urgentRed, text: ElixColors.white };
      case 'discount':
        return { bg: ElixColors.greenLight, text: ElixColors.greenDeep };
      case 'rating':
        return { bg: '#FEF3C7', text: '#92400E' };
      case 'category':
        return { bg: ElixColors.blueLight, text: ElixColors.blue };
      case 'neutral':
        return { bg: ElixColors.surface3, text: ElixColors.inkMuted };
    }
  };

  const { bg, text } = getColors();

  return (
    <View style={[styles.badge, { backgroundColor: bg }, style]}>
      {icon ? <View style={styles.iconContainer}>{icon}</View> : null}
      <Text style={[styles.text, { color: text }, textStyle]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: ElixRadii.pill,
    alignSelf: 'flex-start',
  },
  iconContainer: {
    marginRight: 4,
  },
  text: {
    fontSize: ElixTypography.sizes.xs,
    fontWeight: ElixTypography.weights.bold,
    letterSpacing: 0.3,
  },
});
