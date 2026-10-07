import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { ElixColors, ElixRadii, ElixShadows } from '@/constants/theme';

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  variant?: 'elevated' | 'outlined' | 'urgent';
}

export const Card: React.FC<CardProps> = ({
  children,
  style,
  variant = 'elevated',
}) => {
  return (
    <View
      style={[
        styles.base,
        variant === 'elevated' && styles.elevated,
        variant === 'outlined' && styles.outlined,
        variant === 'urgent' && styles.urgent,
        style,
      ]}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    backgroundColor: ElixColors.surface2,
    borderRadius: ElixRadii.lg,
    padding: 16,
  },
  elevated: {
    ...ElixShadows.sm,
    borderWidth: 1,
    borderColor: ElixColors.borderHairline,
  },
  outlined: {
    borderWidth: 1,
    borderColor: ElixColors.borderHairlineMedium,
  },
  urgent: {
    backgroundColor: ElixColors.urgentRedLight,
    borderWidth: 1,
    borderColor: ElixColors.urgentBorder,
  },
});
