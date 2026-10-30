import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ElixColors, ElixTypography } from '@/constants/theme';

export type TabKey = 'index' | 'services' | 'urgent' | 'bookings' | 'profile';

interface BottomNavProps {
  activeTab?: TabKey;
}

export function BottomNav({ activeTab = 'profile' }: BottomNavProps) {
  const tabs: Array<{
    key: TabKey;
    label: string;
    route: '/(tabs)' | '/(tabs)/services' | '/(tabs)/urgent' | '/(tabs)/bookings' | '/(tabs)/profile';
    activeIcon: keyof typeof Ionicons.glyphMap;
    inactiveIcon: keyof typeof Ionicons.glyphMap;
    activeColor?: string;
  }> = [
    {
      key: 'index',
      label: 'Home',
      route: '/(tabs)',
      activeIcon: 'home',
      inactiveIcon: 'home-outline',
    },
    {
      key: 'services',
      label: 'Services',
      route: '/(tabs)/services',
      activeIcon: 'sparkles',
      inactiveIcon: 'sparkles-outline',
    },
    {
      key: 'urgent',
      label: 'Express 50m',
      route: '/(tabs)/urgent',
      activeIcon: 'flash',
      inactiveIcon: 'flash-outline',
      activeColor: ElixColors.urgentRed,
    },
    {
      key: 'bookings',
      label: 'Bookings',
      route: '/(tabs)/bookings',
      activeIcon: 'calendar',
      inactiveIcon: 'calendar-outline',
    },
    {
      key: 'profile',
      label: 'Profile',
      route: '/(tabs)/profile',
      activeIcon: 'person',
      inactiveIcon: 'person-outline',
    },
  ];

  return (
    <View style={styles.navBar}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;
        const tintColor = isActive
          ? tab.activeColor || ElixColors.blue
          : ElixColors.inkMuted;

        return (
          <TouchableOpacity
            key={tab.key}
            style={styles.tabItem}
            activeOpacity={0.7}
            onPress={() => router.replace(tab.route)}
          >
            <Ionicons
              name={isActive ? tab.activeIcon : tab.inactiveIcon}
              size={22}
              color={tintColor}
            />
            <Text style={[styles.tabLabel, { color: tintColor }]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  navBar: {
    flexDirection: 'row',
    backgroundColor: ElixColors.surface2,
    borderTopColor: ElixColors.borderHairline,
    borderTopWidth: 1,
    height: Platform.OS === 'ios' ? 88 : 64,
    paddingBottom: Platform.OS === 'ios' ? 28 : 10,
    paddingTop: 8,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: ElixTypography.weights.medium,
    marginTop: 3,
  },
});
