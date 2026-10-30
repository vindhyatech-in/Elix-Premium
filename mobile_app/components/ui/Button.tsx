import React from 'react';
import {
  Pressable,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  StyleProp,
} from 'react-native';
import { ElixColors, ElixRadii, ElixTypography } from '@/constants/theme';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'urgent' | 'outline';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  style,
  textStyle,
  fullWidth = false,
}) => {
  const getContainerStyle = (pressed: boolean): ViewStyle => {
    let bg = ElixColors.blue;
    let border: string | undefined = undefined;

    switch (variant) {
      case 'primary':
      case 'urgent':
        bg = pressed ? ElixColors.blueDeep : ElixColors.blue;
        break;
      case 'secondary':
        bg = pressed ? '#E2E8F0' : ElixColors.surface3;
        break;
      case 'ghost':
        bg = pressed ? ElixColors.blueLight : 'transparent';
        break;
      case 'outline':
        bg = pressed ? ElixColors.surface3 : 'transparent';
        border = ElixColors.borderHairlineMedium;
        break;
    }

    const paddingV = size === 'sm' ? 8 : size === 'lg' ? 16 : 12;
    const paddingH = size === 'sm' ? 14 : size === 'lg' ? 24 : 18;

    return {
      backgroundColor: bg,
      paddingVertical: paddingV,
      paddingHorizontal: paddingH,
      borderRadius: ElixRadii.pill,
      borderWidth: border ? 1 : 0,
      borderColor: border,
      opacity: disabled || loading ? 0.6 : 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: fullWidth ? 'stretch' : 'auto',
    };
  };

  const getTextColor = (): string => {
    switch (variant) {
      case 'primary':
      case 'urgent':
        return ElixColors.white;
      case 'secondary':
      case 'outline':
        return ElixColors.ink;
      case 'ghost':
        return ElixColors.blue;
    }
  };

  const fontSize =
    size === 'sm'
      ? ElixTypography.sizes.sm
      : size === 'lg'
      ? ElixTypography.sizes.lg
      : ElixTypography.sizes.md;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [getContainerStyle(pressed), style]}>
      {loading ? (
        <ActivityIndicator size="small" color={getTextColor()} />
      ) : (
        <>
          {icon ? <>{icon}</> : null}
          <Text
            style={[
              styles.text,
              { color: getTextColor(), fontSize },
              icon ? { marginLeft: 8 } : null,
              textStyle,
            ]}>
            {title}
          </Text>
        </>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  text: {
    fontWeight: ElixTypography.weights.semiBold,
    textAlign: 'center',
  },
});
