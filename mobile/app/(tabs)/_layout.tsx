import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform, View, StyleSheet } from 'react-native';
import { useSettings } from '../../hooks/useSettings';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ACCENT = '#6366f1';
const INACTIVE = '#475569';
const BG = '#07070f';
const BORDER = 'rgba(255,255,255,0.08)';

export default function TabLayout() {
  const { t } = useSettings();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: ACCENT,
          tabBarInactiveTintColor: INACTIVE,
          tabBarHideOnKeyboard: true,
          tabBarStyle: {
            backgroundColor: '#0d0d1a',
            borderTopColor: BORDER,
            borderTopWidth: 1,
            height: Platform.OS === 'ios' ? 80 + insets.bottom : 66 + insets.bottom,
            paddingBottom: Platform.OS === 'ios' ? insets.bottom + 6 : insets.bottom + 10,
            paddingTop: 8,
            elevation: 0,
            shadowOpacity: 0,
          },
          tabBarItemStyle: {
            justifyContent: 'center',
            alignItems: 'center',
            flex: 1,
          },
          headerShown: false,
          tabBarLabelStyle: {
            fontSize: 10,
            fontWeight: '600',
            letterSpacing: 0.3,
            marginTop: 2,
          },
        }}
      >
        {/* Home */}
        <Tabs.Screen
          name="index"
          options={{
            title: t('tab_home') || 'Home',
            tabBarIcon: ({ color, focused }) => (
              <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
                <Ionicons name={focused ? 'home' : 'home-outline'} size={22} color={color} />
              </View>
            ),
          }}
        />

        {/* Fines & Rules */}
        <Tabs.Screen
          name="fines"
          options={{
            title: 'Fines & Rules',
            tabBarIcon: ({ color, focused }) => (
              <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
                <Ionicons name={focused ? 'document-text' : 'document-text-outline'} size={22} color={color} />
              </View>
            ),
          }}
        />

        {/* Map */}
        <Tabs.Screen
          name="map"
          options={{
            title: t('tab_map') || 'Map',
            tabBarIcon: ({ color, focused }) => (
              <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
                <Ionicons name={focused ? 'map' : 'map-outline'} size={22} color={color} />
              </View>
            ),
          }}
        />

        {/* Settings / Profile */}
        <Tabs.Screen
          name="settings"
          options={{
            title: t('tab_you') || 'You',
            tabBarIcon: ({ color, focused }) => (
              <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
                <Ionicons name={focused ? 'person' : 'person-outline'} size={22} color={color} />
              </View>
            ),
          }}
        />

        {/* ── Hidden screens (not in tab bar) ── */}
        <Tabs.Screen name="ask"    options={{ href: null }} />
        <Tabs.Screen name="zones"  options={{ href: null }} />
        <Tabs.Screen name="report" options={{ href: null }} />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#07070f',
  },
  iconWrap: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  iconWrapActive: {
    backgroundColor: 'rgba(99,102,241,0.12)',
  },
});
