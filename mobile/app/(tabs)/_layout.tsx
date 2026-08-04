import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform, View, StyleSheet, Text } from 'react-native';
import { useSettings } from '../../hooks/useSettings';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// New tab bar: warm cream background, teal accent, serif-ish feel
const TEAL     = '#0d9488';
const INACTIVE = '#a8a29e';
const BG       = '#faf7f2';   // cream
const BORDER   = '#e7e5e4';   // stone

export default function TabLayout() {
  const { t } = useSettings();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor:   TEAL,
        tabBarInactiveTintColor: INACTIVE,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          backgroundColor: BG,
          borderTopWidth: 1.5,
          borderTopColor: BORDER,
          height: Platform.OS === 'ios' ? 80 + insets.bottom : 64 + insets.bottom,
          paddingBottom: Platform.OS === 'ios' ? insets.bottom + 4 : insets.bottom + 10,
          paddingTop: 6,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '700',
          letterSpacing: 0.4,
          marginTop: 2,
        },
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconBox, focused && styles.iconBoxActive]}>
              <Ionicons name={focused ? 'home' : 'home-outline'} size={21} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="fines"
        options={{
          title: 'Fines & Rules',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconBox, focused && styles.iconBoxActive]}>
              <Ionicons name={focused ? 'document-text' : 'document-text-outline'} size={21} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: 'Map',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconBox, focused && styles.iconBoxActive]}>
              <Ionicons name={focused ? 'map' : 'map-outline'} size={21} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconBox, focused && styles.iconBoxActive]}>
              <Ionicons name={focused ? 'person-circle' : 'person-circle-outline'} size={22} color={color} />
            </View>
          ),
        }}
      />

      {/* Hidden screens */}
      <Tabs.Screen name="ask"    options={{ href: null }} />
      <Tabs.Screen name="zones"  options={{ href: null }} />
      <Tabs.Screen name="report" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconBox: {
    width: 32, height: 28, borderRadius: 8,
    justifyContent: 'center', alignItems: 'center',
  },
  iconBoxActive: {
    backgroundColor: '#ccfbf1',   // teal-lt
  },
});
