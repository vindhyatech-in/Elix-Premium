import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform } from 'react-native';
import { ElixColors, ElixTypography } from '@/constants/theme';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: ElixColors.blue,
        tabBarInactiveTintColor: ElixColors.inkMuted,
        tabBarStyle: {
          backgroundColor: ElixColors.surface2,
          borderTopColor: ElixColors.borderHairline,
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 88 : 64,
          paddingBottom: Platform.OS === 'ios' ? 28 : 10,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: ElixTypography.weights.medium,
        },
        headerShown: false,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="services"
        options={{
          title: 'Services',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'sparkles' : 'sparkles-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="urgent"
        options={{
          title: 'Express 50m',
          tabBarActiveTintColor: ElixColors.urgentRed,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'flash' : 'flash-outline'}
              size={22}
              color={focused ? ElixColors.urgentRed : color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="bookings"
        options={{
          title: 'Bookings',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'calendar' : 'calendar-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={22} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
