import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import * as Location from 'expo-location';
import { useSettings } from '../hooks/useSettings';

const LOCATIONS = [
  { id: 'IN', country: 'India', region: 'Tamil Nadu', code: 'IN' },
  { id: 'US', country: 'United States', region: 'California', code: 'US' },
  { id: 'GB', country: 'United Kingdom', region: 'England', code: 'GB' },
  { id: 'AE', country: 'UAE', region: 'Dubai', code: 'AE' },
  { id: 'SG', country: 'Singapore', region: '', code: 'SG' },
];

export default function LocationScreen() {
  const router = useRouter();
  const { updateProfile } = useSettings();
  const [selectedId, setSelectedId] = useState('IN');
  const [searchQuery, setSearchQuery] = useState('');
  const [locating, setLocating] = useState(false);

  const filteredLocations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return LOCATIONS;
    return LOCATIONS.filter(
      (loc) => loc.country.toLowerCase().includes(q) || loc.region.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  const handleUseMyLocation = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Enable location access to auto-detect your country.');
        return;
      }
      const position = await Location.getCurrentPositionAsync({});
      const geocode = await Location.reverseGeocodeAsync(position.coords);
      const isoCode = geocode[0]?.isoCountryCode;
      const match = LOCATIONS.find((loc) => loc.code === isoCode);
      if (match) {
        setSelectedId(match.id);
      } else {
        Alert.alert('Not supported yet', "We don't have coverage for your detected location yet. Please pick one from the list.");
      }
    } catch (e) {
      Alert.alert('Could not detect location', 'Please pick your country/state from the list below.');
    } finally {
      setLocating(false);
    }
  };

  const handleContinue = () => {
    const selected = LOCATIONS.find((loc) => loc.id === selectedId);
    if (selected) {
      updateProfile({ country: selected.country, state: selected.region || selected.country });
    }
    router.push('/vehicle');
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      {/* Header with Progress */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1B1A17" />
        </TouchableOpacity>
        
        <View style={styles.progressContainer}>
          <View style={styles.progressBarBg}>
            <View style={styles.progressBarFill} />
          </View>
        </View>
        <Text style={styles.progressText}>2/3</Text>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Title & Subtitle */}
        <Text style={styles.headline}>Where do you drive?</Text>
        <Text style={styles.subheadline}>
          Rules and fines vary by state. Pick yours so we get it right.
        </Text>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#6b7280" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search country or state..."
            placeholderTextColor="#9ca3af"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.locationButton} onPress={handleUseMyLocation} disabled={locating}>
            <Ionicons name="location" size={14} color="#ef4444" style={styles.locationIcon} />
            <Text style={styles.locationButtonText}>{locating ? 'Locating…' : 'Use my location'}</Text>
          </TouchableOpacity>
        </View>

        {/* Location List */}
        <View style={styles.listContainer}>
          {filteredLocations.length === 0 && (
            <Text style={styles.noResultsText}>No matching country or state found.</Text>
          )}
          {filteredLocations.map((loc) => {
            const isSelected = selectedId === loc.id;
            return (
              <TouchableOpacity
                key={loc.id}
                style={[styles.locationCard, isSelected && styles.locationCardSelected]}
                onPress={() => setSelectedId(loc.id)}
                activeOpacity={0.7}
              >
                <View style={styles.cardLeft}>
                  <Text style={styles.countryCode}>{loc.code}</Text>
                  <View style={styles.cardTextContainer}>
                    <Text style={styles.countryText}>{loc.country}</Text>
                    {loc.region ? <Text style={styles.regionText}>{loc.region}</Text> : null}
                  </View>
                </View>
                {isSelected && (
                  <View style={styles.checkContainer}>
                    <Ionicons name="checkmark-circle" size={24} color="#C9621D" />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* Bottom Pinned Continue Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handleContinue}
        >
          <Text style={styles.primaryButtonText}>Continue</Text>
          <Ionicons name="arrow-forward" size={18} color="#fff" style={styles.buttonIcon} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#faf7f2',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  backButton: {
    padding: 4,
  },
  progressContainer: {
    flex: 1,
    marginHorizontal: 16,
  },
  progressBarBg: {
    height: 4,
    backgroundColor: '#e7e5e4',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    width: '66%',
    backgroundColor: '#0d9488',
  },
  progressText: {
    fontSize: 14,
    color: '#78716c',
    fontWeight: '500',
    fontFamily: Platform.OS === 'web' ? 'Inter, sans-serif' : 'System',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 40,
  },
  headline: {
    fontSize: 32,
    color: '#1c1917',
    fontFamily: Platform.OS === 'web' ? '"DM Serif Display", serif' : 'serif',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subheadline: {
    fontSize: 15,
    lineHeight: 22,
    color: '#78716c',
    fontFamily: Platform.OS === 'web' ? 'Inter, sans-serif' : 'System',
    marginBottom: 24,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e7e5e4',
    borderRadius: 24,
    paddingHorizontal: 16,
    height: 48,
    marginBottom: 16,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#1c1917',
    fontFamily: Platform.OS === 'web' ? 'Inter, sans-serif' : 'System',
    outlineStyle: 'none' as any,
  },
  quickActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    gap: 12,
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff1f2',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
  },
  locationIcon: {
    marginRight: 6,
    color: '#dc2626',
  },
  locationButtonText: {
    color: '#dc2626',
    fontSize: 13,
    fontWeight: '600',
    fontFamily: Platform.OS === 'web' ? 'Inter, sans-serif' : 'System',
  },
  noResultsText: {
    textAlign: 'center',
    color: '#78716c',
    fontSize: 14,
    paddingVertical: 24,
    fontFamily: Platform.OS === 'web' ? 'Inter, sans-serif' : 'System',
  },
  listContainer: {
    gap: 12,
  },
  locationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e7e5e4',
    borderRadius: 16,
    padding: 16,
  },
  locationCardSelected: {
    borderColor: '#0d9488',
    backgroundColor: '#ccfbf1',
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  countryCode: {
    fontSize: 16,
    fontWeight: '600',
    color: '#78716c',
    width: 32,
    fontFamily: Platform.OS === 'web' ? 'Inter, sans-serif' : 'System',
  },
  cardTextContainer: {
    marginLeft: 12,
  },
  countryText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1c1917',
    fontFamily: Platform.OS === 'web' ? 'Inter, sans-serif' : 'System',
  },
  regionText: {
    fontSize: 13,
    color: '#78716c',
    marginTop: 2,
    fontFamily: Platform.OS === 'web' ? 'Inter, sans-serif' : 'System',
  },
  checkContainer: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  footer: {
    backgroundColor: '#faf7f2',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
    borderTopWidth: 1.5,
    borderTopColor: '#e7e5e4',
  },
  primaryButton: {
    backgroundColor: '#0d9488',
    borderRadius: 24,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: Platform.OS === 'web' ? 'Inter, sans-serif' : 'System',
  },
  buttonIcon: {
    marginLeft: 8,
  },
});
