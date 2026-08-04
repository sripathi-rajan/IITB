import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
  Animated
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { getApiBaseUrl } from '../../lib/api';
import { useSettings } from '../../hooks/useSettings';
import {
  useChallanCalculator,
  labelForOffence,
  labelForVehicleClass,
  labelForCountry,
  labelForState,
  formatAmount,
  ChallanResult,
} from '../../hooks/useChallanCalculator';
import { CATEGORY_DETAILS } from './zones/index';

interface Challan {
  date: string;
  violation: string;
  amount: number;
  status: string;
  location: string;
}

interface VehicleResult {
  demo: boolean;
  demo_notice: string;
  vehicle_number: string;
  owner: string;
  vehicle_type: string;
  pending_challans: Challan[];
  total_fine: number;
  last_updated: string;
  message?: string;
}

const VEHICLE_ICONS: Record<string, React.ComponentProps<typeof MaterialCommunityIcons>['name']> = {
  TWO_WHEELER: 'motorbike',
  THREE_WHEELER: 'rickshaw',
  LMV: 'car-outline',
  HGV: 'truck-outline',
  COMMERCIAL: 'truck-delivery-outline',
};

export default function FinesScreen() {
  const router = useRouter();
  const { t } = useSettings();
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VehicleResult | null>(null);
  
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [expandedAct, setExpandedAct] = useState<string | null>(null);

  const challan = useChallanCalculator();
  const [violationPickerVisible, setViolationPickerVisible] = useState(false);
  const [countryPickerVisible, setCountryPickerVisible] = useState(false);
  const [statePickerVisible, setStatePickerVisible] = useState(false);
  const [pendingCountry, setPendingCountry] = useState<string | null>(null);
  const [selectedVehicleClass, setSelectedVehicleClass] = useState<string | null>(null);
  const [selectedOffenceCode, setSelectedOffenceCode] = useState<string | null>(null);
  const [challanResult, setChallanResult] = useState<ChallanResult | null>(null);
  const [activeTab, setActiveTab] = useState<'search' | 'calc' | 'rules'>('search');


  // Some jurisdictions' fine schedules genuinely don't differentiate by vehicle type (every
  // fine is filed as vehicle_class='ALL') — forcing a vehicle-type choice there would be fake
  // precision, so that step is skipped entirely rather than shown with one meaningless option.
  const needsVehicleStep = challan.vehicleClasses.length > 0;
  const effectiveVehicleClass = needsVehicleStep ? selectedVehicleClass : null;
  const vehicleStepDone = !needsVehicleStep || !!selectedVehicleClass;

  const resultAnim = useRef(new Animated.Value(0)).current;
  const violationStepAnim = useRef(new Animated.Value(0)).current;
  const radarAnim = useRef(new Animated.Value(0)).current;
  const [calculating, setCalculating] = useState(false);
  const [lawsBanner, setLawsBanner] = useState<'hidden' | 'loading' | 'applied'>('hidden');
  const lawsBannerAnim = useRef(new Animated.Value(0)).current;
  const jurisdictionShortName = challan.locationLabel.split(',')[0]?.trim() || labelForCountry(challan.country);

  useEffect(() => {
    Animated.spring(violationStepAnim, {
      toValue: vehicleStepDone ? 1 : 0,
      useNativeDriver: true,
      friction: 8,
    }).start();
  }, [vehicleStepDone, violationStepAnim]);

  // Pulsing radar while the geofence is still resolving ("Detecting location...").
  useEffect(() => {
    if (!challan.loading) {
      radarAnim.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(radarAnim, { toValue: 1, duration: 650, useNativeDriver: true }),
        Animated.timing(radarAnim, { toValue: 0, duration: 650, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [challan.loading, radarAnim]);

  // Once the geofence locks in, briefly show "Loading X laws..." then "X laws applied" —
  // makes the background sync feel like a deliberate, visible step instead of instant magic.
  useEffect(() => {
    if (challan.loading) {
      setLawsBanner('hidden');
      return;
    }
    setLawsBanner('loading');
    lawsBannerAnim.setValue(1);
    const showApplied = setTimeout(() => setLawsBanner('applied'), 500);
    const hide = setTimeout(() => {
      Animated.timing(lawsBannerAnim, { toValue: 0, duration: 400, useNativeDriver: true }).start(() =>
        setLawsBanner('hidden')
      );
    }, 2200);
    return () => {
      clearTimeout(showApplied);
      clearTimeout(hide);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challan.loading, challan.state, challan.country]);

  const handleCalculateFine = () => {
    if (!vehicleStepDone || !selectedOffenceCode || calculating) return;
    setCalculating(true);
    setChallanResult(null);
    setTimeout(() => {
      const result = challan.calculate(selectedOffenceCode, effectiveVehicleClass, false);
      setChallanResult(result);
      setCalculating(false);
      resultAnim.setValue(0);
      Animated.spring(resultAnim, { toValue: 1, useNativeDriver: true, friction: 7 }).start();
    }, 1000);
  };

  const handlePickCountry = (countryCode: string) => {
    setPendingCountry(countryCode);
    setCountryPickerVisible(false);
    setStatePickerVisible(true);
  };

  const handlePickState = (stateCode: string) => {
    if (pendingCountry) {
      challan.setJurisdiction(stateCode, pendingCountry);
      setSelectedVehicleClass(null);
      setSelectedOffenceCode(null);
      setChallanResult(null);
    }
    setStatePickerVisible(false);
    setPendingCountry(null);
  };

  const handleOpenCategory = (catName: string) => {
    setSelectedCategory(catName);
    setExpandedAct(null);
    setModalVisible(true);
  };

  const handleLookup = async () => {
    const cleanNum = vehicleNumber.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (cleanNum.length < 4) {
      Alert.alert('Invalid Number', 'Please enter a valid vehicle registration number (minimum 4 characters).');
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const baseUrl = getApiBaseUrl();
      const response = await fetch(`${baseUrl}/challan/calculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vehicle_number: cleanNum }),
      });

      if (!response.ok) {
        throw new Error('API server returned an error');
      }

      const data: VehicleResult = await response.json();
      setResult(data);
    } catch (err) {
      console.log('Backend not reachable, using local mock data for challan calculation');
      // Local fallback for demo purposes when backend is down
      const vNum = cleanNum.toUpperCase();
      const isTN = vNum.includes('TN');
      const isDL = vNum.includes('DL');
      
      let mockData: VehicleResult;
      
      if (isTN) {
        mockData = {
          demo: true,
          demo_notice: "Demo sample data only — local fallback. Do not use for real payment decisions.",
          vehicle_number: vehicleNumber,
          owner: "J*** S***",
          vehicle_type: "Motor Car (LMV)",
          pending_challans: [
            { date: "2024-03-15", violation: "Over Speeding", amount: 1000, status: "Pending", location: "Anna Salai, Chennai" },
            { date: "2024-04-02", violation: "No Helmet (Pillion)", amount: 500, status: "Pending", location: "OMR, Chennai" }
          ],
          total_fine: 1500,
          last_updated: new Date().toISOString()
        };
      } else if (isDL) {
        mockData = {
          demo: true,
          demo_notice: "Demo sample data only — local fallback. Do not use for real payment decisions.",
          vehicle_number: vehicleNumber,
          owner: "A*** K***",
          vehicle_type: "Two Wheeler",
          pending_challans: [
            { date: "2024-02-10", violation: "Red Light Jumping", amount: 1000, status: "Pending", location: "Connaught Place, Delhi" }
          ],
          total_fine: 1000,
          last_updated: new Date().toISOString()
        };
      } else {
        mockData = {
          demo: true,
          demo_notice: "Demo sample data only — local fallback. Do not use for real payment decisions.",
          vehicle_number: vehicleNumber,
          owner: "N/A",
          vehicle_type: "Unknown",
          pending_challans: [],
          total_fine: 0,
          last_updated: new Date().toISOString(),
          message: "No pending challans found for this vehicle number."
        };
      }
      setResult(mockData);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setVehicleNumber('');
    setResult(null);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1c1c1c" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Traffic Registry</Text>
        <View style={styles.locationPill}>
          <Ionicons name="location" size={12} color="#0d9488" />
          <Text style={styles.locationText}>{activeTab === 'calc' ? 'Calculator' : activeTab === 'rules' ? 'Rule Book' : 'Challan Lookup'}</Text>
        </View>
      </View>

      {/* Segmented Tab Selector */}
      <View style={styles.tabSelector}>
        <TouchableOpacity 
          style={[styles.tabBtn, activeTab === 'search' && styles.tabBtnActive]} 
          onPress={() => setActiveTab('search')}
          activeOpacity={0.8}
        >
          <Ionicons name="search" size={16} color={activeTab === 'search' ? '#fff' : '#78716c'} />
          <Text style={[styles.tabBtnText, activeTab === 'search' && styles.tabBtnTextActive]}>Lookup</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tabBtn, activeTab === 'calc' && styles.tabBtnActive]} 
          onPress={() => setActiveTab('calc')}
          activeOpacity={0.8}
        >
          <Ionicons name="calculator" size={16} color={activeTab === 'calc' ? '#fff' : '#78716c'} />
          <Text style={[styles.tabBtnText, activeTab === 'calc' && styles.tabBtnTextActive]}>Calculator</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tabBtn, activeTab === 'rules' && styles.tabBtnActive]} 
          onPress={() => setActiveTab('rules')}
          activeOpacity={0.8}
        >
          <Ionicons name="book" size={16} color={activeTab === 'rules' ? '#fff' : '#78716c'} />
          <Text style={[styles.tabBtnText, activeTab === 'rules' && styles.tabBtnTextActive]}>Rules</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* TAB 1: Challan Search */}
        {activeTab === 'search' && (
          <View>
            <Text style={styles.description}>
              {t('challan_desc_long')}
            </Text>

            <View style={styles.searchCard}>
              <Text style={styles.inputLabel}>{t('vehicle_reg_number')}</Text>
              <View style={styles.inputWrapper}>
                <MaterialCommunityIcons name="car-cog" size={20} color="#78716c" style={styles.inputIcon} />
                <TextInput
                  style={[
                    styles.input,
                    Platform.OS === 'web' && { outlineStyle: 'none' } as any
                  ]}
                  placeholder="e.g. TN 09 BX 4421"
                  placeholderTextColor="#a8a29e"
                  value={vehicleNumber}
                  onChangeText={setVehicleNumber}
                  autoCapitalize="characters"
                  autoCorrect={false}
                />
                {vehicleNumber.length > 0 && (
                  <TouchableOpacity onPress={handleClear} style={{ marginRight: 8 }}>
                    <Ionicons name="close-circle" size={18} color="#a8a29e" />
                  </TouchableOpacity>
                )}
              </View>
              
              <TouchableOpacity 
                style={[styles.searchButton, loading && styles.searchButtonDisabled]} 
                onPress={handleLookup}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Text style={styles.searchButtonText}>{t('verify_fines')}</Text>
                    <Ionicons name="search" size={18} color="#fff" style={{ marginLeft: 6 }} />
                  </>
                )}
              </TouchableOpacity>

              {loading && (
                <View style={styles.loaderContainer}>
                  <ActivityIndicator size="large" color="#0d9488" />
                  <Text style={styles.loaderText}>Checking Parivahan databases...</Text>
                </View>
              )}

              {result && (
                <View style={styles.resultContainer}>
                  {result.demo && (
                    <View style={styles.demoNotice}>
                      <Ionicons name="information-circle" size={16} color="#b45309" />
                      <Text style={styles.demoNoticeText}>{result.demo_notice}</Text>
                    </View>
                  )}

                  <View style={styles.profileCard}>
                    <View style={styles.profileHeader}>
                      <View style={styles.profileInfo}>
                        <Text style={styles.resultPlate}>{result.vehicle_number.toUpperCase()}</Text>
                        <Text style={styles.resultOwner}>Owner: {result.owner}</Text>
                        <Text style={styles.resultType}>{result.vehicle_type}</Text>
                      </View>
                      <View style={[styles.statusBadge, result.total_fine > 0 ? styles.statusBadgeRed : styles.statusBadgeGreen]}>
                        <Text style={[styles.statusText, result.total_fine > 0 ? styles.statusTextRed : styles.statusTextGreen]}>
                          {result.total_fine > 0 ? 'Fines Pending' : 'Clear'}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.divider} />

                    <View style={styles.totalFineRow}>
                      <Text style={styles.totalLabel}>Total Outstanding</Text>
                      <Text style={styles.totalValue}>₹{result.total_fine.toLocaleString()}</Text>
                    </View>
                  </View>

                  {result.pending_challans.length > 0 ? (
                    <View style={styles.challanListContainer}>
                      <Text style={styles.sectionSubTitle}>PENDING VIOLATIONS ({result.pending_challans.length})</Text>
                      
                      {result.pending_challans.map((challan, index) => (
                        <View key={index} style={styles.challanItem}>
                          <View style={styles.challanLeft}>
                            <View style={styles.violationIcon}>
                              <MaterialCommunityIcons name="alert-circle-outline" size={20} color="#dc2626" />
                            </View>
                            <View style={styles.challanDetails}>
                              <Text style={styles.violationTitle}>{challan.violation}</Text>
                              <Text style={styles.violationLoc}>{challan.location}</Text>
                              <Text style={styles.violationDate}>{challan.date}</Text>
                            </View>
                          </View>
                          <Text style={styles.violationAmount}>₹{challan.amount}</Text>
                        </View>
                      ))}

                      <TouchableOpacity 
                        style={styles.payButton}
                        onPress={() => Alert.alert('Payment Portal', 'Redirecting to secure gateway... (Mock)')}
                      >
                        <Text style={styles.payButtonText}>Pay All Challans</Text>
                        <Ionicons name="card" size={18} color="#fff" style={{ marginLeft: 8 }} />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={styles.clearContainer}>
                      <View style={styles.checkWrapper}>
                        <Ionicons name="checkmark-circle" size={48} color="#16a34a" />
                      </View>
                      <Text style={styles.clearTitle}>Zero Pending Fines</Text>
                      <Text style={styles.clearDesc}>No pending e-challans found for this vehicle. Drive safe and keep up the good work!</Text>
                    </View>
                  )}

                  <Text style={styles.lastUpdatedText}>
                    Last checked: {new Date(result.last_updated).toLocaleTimeString()}
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* TAB 2: Penalty Calculator */}
        {activeTab === 'calc' && (
          <View style={styles.calculatorCard}>
            <View style={styles.jurisdictionRow}>
              <View style={styles.jurisdictionPin}>
                {challan.loading ? (
                  <Animated.View
                    style={{
                      opacity: radarAnim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }),
                      transform: [{ scale: radarAnim.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.2] }) }],
                    }}
                  >
                    <Ionicons name="radio-outline" size={16} color="#d97706" />
                  </Animated.View>
                ) : (
                  <Ionicons name="location" size={16} color="#d97706" />
                )}
              </View>
              <Text style={styles.jurisdictionText} numberOfLines={1}>
                {challan.loading
                  ? 'Detecting location…'
                  : `${challan.isManualJurisdiction ? 'Jurisdiction selected' : 'Geofence locked'}: ${challan.locationLabel}`}
              </Text>
              <TouchableOpacity
                style={styles.jurisdictionChangeButton}
                onPress={() => setCountryPickerVisible(true)}
                accessibilityLabel="Check a different country or state"
              >
                <Text style={styles.jurisdictionChangeText}>Change</Text>
              </TouchableOpacity>
            </View>

            {lawsBanner !== 'hidden' && (
              <Animated.View style={[styles.lawsAppliedBanner, { opacity: lawsBannerAnim }]}>
                {lawsBanner === 'loading' ? (
                  <>
                    <ActivityIndicator size="small" color="#d97706" />
                    <Text style={styles.lawsAppliedText}>Loading {jurisdictionShortName} laws…</Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={16} color="#16a34a" />
                    <Text style={styles.lawsAppliedText}>{jurisdictionShortName} laws applied</Text>
                  </>
                )}
              </Animated.View>
            )}

            {challan.zones.length > 0 && (
              <View style={styles.zoneChipRow}>
                {challan.zones.map((z) => (
                  <View key={z.zone_id} style={styles.zoneChip}>
                    <Text style={styles.zoneChipText}>
                      {z.zone_type.replace(/_/g, ' ')}{z.fine_multiplier > 1 ? ` · ${z.fine_multiplier}x fine` : ''}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {challan.isOffline && (
              <View style={styles.challanOfflineBanner}>
                <Ionicons name="cloud-offline-outline" size={14} color="#92400e" />
                <Text style={styles.challanOfflineText}>
                  Offline — showing last synced fine data.
                </Text>
              </View>
            )}

            {challan.loading ? (
              <View style={styles.loaderContainer}>
                <ActivityIndicator size="small" color="#0d9488" />
                <Text style={styles.loaderText}>Finding your jurisdiction…</Text>
              </View>
            ) : (
              <>
                {needsVehicleStep && (
                  <View style={styles.calcStep}>
                    <View style={styles.calcStepHeader}>
                      <View style={[styles.stepBadge, styles.stepBadgeActive]}>
                        <Text style={styles.stepBadgeText}>1</Text>
                      </View>
                      <Text style={styles.calcStepLabel}>VEHICLE TYPE</Text>
                    </View>
                    <View style={styles.vehicleChipRow}>
                      {challan.vehicleClasses.map((vc) => {
                        const active = selectedVehicleClass === vc;
                        return (
                          <TouchableOpacity
                            key={vc}
                            style={[styles.vehicleChip, active && styles.vehicleChipActive]}
                            onPress={() => {
                              setSelectedVehicleClass(vc);
                              setSelectedOffenceCode(null);
                              setChallanResult(null);
                            }}
                          >
                            <MaterialCommunityIcons
                              name={VEHICLE_ICONS[vc] || 'car-outline'}
                              size={22}
                              color={active ? '#fff' : '#0d9488'}
                            />
                            <Text style={[styles.vehicleChipText, active && styles.vehicleChipTextActive]}>
                              {labelForVehicleClass(vc)}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                )}

                <Animated.View
                  style={[
                    styles.calcStep,
                    {
                      opacity: violationStepAnim,
                      pointerEvents: vehicleStepDone ? 'auto' : 'none',
                      transform: [
                        { translateY: violationStepAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) },
                      ],
                    },
                  ]}
                >
                  <View style={styles.calcStepHeader}>
                    <View style={[styles.stepBadge, vehicleStepDone && styles.stepBadgeActive]}>
                      <Text style={styles.stepBadgeText}>{needsVehicleStep ? 2 : 1}</Text>
                    </View>
                    <Text style={styles.calcStepLabel}>VIOLATION TYPE</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.violationPickerButton}
                    onPress={() => vehicleStepDone && setViolationPickerVisible(true)}
                    disabled={!vehicleStepDone}
                  >
                    <View style={styles.violationPickerIcon}>
                      <Ionicons name="warning-outline" size={18} color="#0d9488" />
                    </View>
                    <Text
                      style={[
                        styles.violationPickerText,
                        !selectedOffenceCode && styles.violationPickerPlaceholder,
                      ]}
                    >
                      {selectedOffenceCode ? labelForOffence(selectedOffenceCode) : 'Tap to choose a violation'}
                    </Text>
                    <Ionicons name="chevron-forward" size={18} color="#a8a29e" />
                  </TouchableOpacity>
                </Animated.View>

                <TouchableOpacity
                  style={[
                    styles.searchButton,
                    { marginTop: 24 },
                    (!vehicleStepDone || !selectedOffenceCode || calculating) && styles.searchButtonDisabled,
                  ]}
                  onPress={handleCalculateFine}
                  disabled={!vehicleStepDone || !selectedOffenceCode || calculating}
                >
                  {calculating ? (
                    <>
                      <ActivityIndicator size="small" color="#fff" style={{ marginRight: 8 }} />
                      <Text style={styles.searchButtonText}>Calculating…</Text>
                    </>
                  ) : (
                    <>
                      <Ionicons name="calculator" size={16} color="#fff" style={{ marginRight: 8 }} />
                      <Text style={styles.searchButtonText}>Calculate Fine</Text>
                    </>
                  )}
                </TouchableOpacity>

                {challanResult && (
                  <Animated.View
                    style={[
                      styles.challanResultCard,
                      {
                        opacity: resultAnim,
                        transform: [
                          { translateY: resultAnim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) },
                        ],
                      },
                    ]}
                  >
                    <View style={styles.challanResultIconWrap}>
                      <Ionicons name="receipt-outline" size={20} color="#d97706" />
                    </View>
                    <Text style={styles.challanAmountText}>
                      {formatAmount(challanResult.amount, challanResult.currency)}
                    </Text>
                    {challanResult.sectionRef && (
                      <Text style={styles.challanSectionText}>Legal Reference: {challanResult.sectionRef}</Text>
                    )}
                    {challanResult.zoneMultiplier > 1 && (
                      <Text style={styles.challanZoneNote}>
                        Includes {challanResult.zoneMultiplier}x zone multiplier ({formatAmount(challanResult.baseAmount, challanResult.currency)} base fine)
                      </Text>
                    )}
                  </Animated.View>
                )}
              </>
            )}
          </View>
        )}

        {/* TAB 3: Browse Rules */}
        {activeTab === 'rules' && (
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>{t('browse_category')}</Text>

            <View style={styles.gridContainer}>
              <TouchableOpacity style={styles.categoryCard} onPress={() => handleOpenCategory('Speed & limits')}>
                <View style={[styles.iconWrapper, { backgroundColor: '#ccfbf1' }]}>
                  <Ionicons name="flash" size={20} color="#0d9488" />
                </View>
                <Text style={styles.categoryTitle}>{t('speed_limits')}</Text>
                <Text style={styles.categorySubtitle}>{CATEGORY_DETAILS['Speed & limits']?.acts.length || 0} rules</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.categoryCard} onPress={() => handleOpenCategory('Safety gear')}>
                <View style={[styles.iconWrapper, { backgroundColor: '#fff7ed' }]}>
                  <Ionicons name="car-sport" size={20} color="#ea580c" />
                </View>
                <Text style={styles.categoryTitle}>{t('safety_gear')}</Text>
                <Text style={styles.categorySubtitle}>{CATEGORY_DETAILS['Safety gear']?.acts.length || 0} rules</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.categoryCard} onPress={() => handleOpenCategory('Lane & overtaking')}>
                <View style={[styles.iconWrapper, { backgroundColor: '#fffbeb' }]}>
                  <Ionicons name="car" size={20} color="#d97706" />
                </View>
                <Text style={styles.categoryTitle}>{t('lane_overtaking')}</Text>
                <Text style={styles.categorySubtitle}>{CATEGORY_DETAILS['Lane & overtaking']?.acts.length || 0} rules</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.categoryCard} onPress={() => handleOpenCategory('Signal & signage')}>
                <View style={[styles.iconWrapper, { backgroundColor: '#f0fdf4' }]}>
                  <Ionicons name="medical" size={20} color="#16a34a" />
                </View>
                <Text style={styles.categoryTitle}>{t('signal_signage')}</Text>
                <Text style={styles.categorySubtitle}>{CATEGORY_DETAILS['Signal & signage']?.acts.length || 0} rules</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.categoryCard} onPress={() => handleOpenCategory('Documents')}>
                <View style={[styles.iconWrapper, { backgroundColor: '#f0ebe3' }]}>
                  <Ionicons name="document-text" size={20} color="#78716c" />
                </View>
                <Text style={styles.categoryTitle}>{t('documents_paperwork')}</Text>
                <Text style={styles.categorySubtitle}>{CATEGORY_DETAILS['Documents']?.acts.length || 0} rules</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.categoryCard} onPress={() => handleOpenCategory('Distraction & DUI')}>
                <View style={[styles.iconWrapper, { backgroundColor: '#fff1f2' }]}>
                  <Ionicons name="eye-off" size={20} color="#dc2626" />
                </View>
                <Text style={styles.categoryTitle}>{t('dui_substance')}</Text>
                <Text style={styles.categorySubtitle}>{CATEGORY_DETAILS['Distraction & DUI']?.acts.length || 0} rules</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.categoryCard} onPress={() => handleOpenCategory('Parking & Halting')}>
                <View style={[styles.iconWrapper, { backgroundColor: '#f0ebe3' }]}>
                  <Ionicons name="car-sport-outline" size={20} color="#78716c" />
                </View>
                <Text style={styles.categoryTitle}>Parking & Halting</Text>
                <Text style={styles.categorySubtitle}>{CATEGORY_DETAILS['Parking & Halting']?.acts.length || 0} rules</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.categoryCard} onPress={() => handleOpenCategory('Commercial & Load')}>
                <View style={[styles.iconWrapper, { backgroundColor: '#fff7ed' }]}>
                  <Ionicons name="bus-outline" size={20} color="#ea580c" />
                </View>
                <Text style={styles.categoryTitle}>Commercial & Load</Text>
                <Text style={styles.categorySubtitle}>{CATEGORY_DETAILS['Commercial & Load']?.acts.length || 0} rules</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.categoryCard} onPress={() => handleOpenCategory('Emissions & Health')}>
                <View style={[styles.iconWrapper, { backgroundColor: '#f0fdf4' }]}>
                  <Ionicons name="leaf-outline" size={20} color="#16a34a" />
                </View>
                <Text style={styles.categoryTitle}>Emissions & Health</Text>
                <Text style={styles.categorySubtitle}>{CATEGORY_DETAILS['Emissions & Health']?.acts.length || 0} rules</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.categoryCard} onPress={() => handleOpenCategory('Vehicle Modifications')}>
                <View style={[styles.iconWrapper, { backgroundColor: '#ccfbf1' }]}>
                  <Ionicons name="build-outline" size={20} color="#0d9488" />
                </View>
                <Text style={styles.categoryTitle}>Modifications</Text>
                <Text style={styles.categorySubtitle}>{CATEGORY_DETAILS['Vehicle Modifications']?.acts?.length || 0} rules</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.categoryCard} onPress={() => router.push('/signs')}>
                <View style={[styles.iconWrapper, { backgroundColor: '#fff1f2' }]}>
                  <Ionicons name="warning-outline" size={20} color="#dc2626" />
                </View>
                <Text style={styles.categoryTitle}>Traffic Signs</Text>
                <Text style={styles.categorySubtitle}>View all</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

      </ScrollView>

      {/* Category Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => { setModalVisible(false); setExpandedAct(null); }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            
            {/* Modal Header */}
            {selectedCategory && CATEGORY_DETAILS[selectedCategory] && (
              <>
                <View style={styles.modalHeader}>
                  <View style={styles.modalHeaderLeft}>
                    <View style={[styles.modalIconWrapper, { backgroundColor: CATEGORY_DETAILS[selectedCategory].iconBg }]}>
                      <Ionicons name={CATEGORY_DETAILS[selectedCategory].icon as any} size={22} color={CATEGORY_DETAILS[selectedCategory].iconColor} />
                    </View>
                    <Text style={styles.modalTitle}>{CATEGORY_DETAILS[selectedCategory].title}</Text>
                  </View>
                  <TouchableOpacity onPress={() => { setModalVisible(false); setExpandedAct(null); }}>
                    <Ionicons name="close" size={24} color="#1f2937" />
                  </TouchableOpacity>
                </View>

                {/* Modal Body */}
                <ScrollView showsVerticalScrollIndicator={false} style={styles.modalScroll}>
                  <Text style={styles.modalDesc}>
                    Local Traffic Acts and penal guidelines. Tap an act to read compliance instructions.
                  </Text>
                  
                  {CATEGORY_DETAILS[selectedCategory].acts.map((item, idx) => {
                    const isExpanded = expandedAct === item.act;
                    return (
                      <View key={idx} style={styles.accordionItem}>
                        <TouchableOpacity 
                          style={styles.accordionHeader}
                          onPress={() => setExpandedAct(isExpanded ? null : item.act)}
                          activeOpacity={0.7}
                        >
                          <View style={styles.accordionTitleContainer}>
                            <Text style={styles.accordionAct}>{item.act}</Text>
                            <Text style={styles.accordionPenalty}>{item.penalty}</Text>
                          </View>
                          <Ionicons 
                            name={isExpanded ? "chevron-up" : "chevron-down"} 
                            size={18} 
                            color="#9ca3af" 
                          />
                        </TouchableOpacity>
                        
                        {isExpanded && (
                          <View style={styles.accordionDetails}>
                            <Text style={styles.detailsLabel}>GUIDELINES & SAFE DRIVING</Text>
                            <Text style={styles.detailsText}>{item.guidelines}</Text>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Violation Type Picker */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={violationPickerVisible}
        onRequestClose={() => setViolationPickerVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Violation Type</Text>
              <TouchableOpacity onPress={() => setViolationPickerVisible(false)}>
                <Ionicons name="close" size={24} color="#1f2937" />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} style={styles.modalScroll}>
              {challan.offencesFor(effectiveVehicleClass).map((v) => (
                <TouchableOpacity
                  key={v.offence_code}
                  style={styles.pickerRow}
                  onPress={() => {
                    setSelectedOffenceCode(v.offence_code);
                    setChallanResult(null);
                    setViolationPickerVisible(false);
                  }}
                >
                  <Text style={styles.pickerRowText}>{labelForOffence(v.offence_code)}</Text>
                  {selectedOffenceCode === v.offence_code && <Ionicons name="checkmark" size={18} color="#d97706" />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Country Picker (manual jurisdiction override, step 1) */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={countryPickerVisible}
        onRequestClose={() => setCountryPickerVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Country</Text>
              <TouchableOpacity onPress={() => setCountryPickerVisible(false)}>
                <Ionicons name="close" size={24} color="#1f2937" />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} style={styles.modalScroll}>
              {challan.availableCountries.map((c) => (
                <TouchableOpacity key={c} style={styles.pickerRow} onPress={() => handlePickCountry(c)}>
                  <Text style={styles.pickerRowText}>{labelForCountry(c)}</Text>
                  {challan.country === c && <Ionicons name="checkmark" size={18} color="#d97706" />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* State Picker (manual jurisdiction override, step 2) */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={statePickerVisible}
        onRequestClose={() => setStatePickerVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Select State{pendingCountry ? ` — ${labelForCountry(pendingCountry)}` : ''}
              </Text>
              <TouchableOpacity onPress={() => setStatePickerVisible(false)}>
                <Ionicons name="close" size={24} color="#1f2937" />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} style={styles.modalScroll}>
              {pendingCountry &&
                challan.availableStatesFor(pendingCountry).map((s) => (
                  <TouchableOpacity key={s} style={styles.pickerRow} onPress={() => handlePickState(s)}>
                    <Text style={styles.pickerRowText}>{labelForState(s)}</Text>
                  </TouchableOpacity>
                ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#faf7f2' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 18, paddingVertical: 13,
    borderBottomWidth: 1.5, borderBottomColor: '#e7e5e4',
    backgroundColor: '#faf7f2',
  },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#1c1917', marginLeft: 12, flex: 1 },
  locationPill: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#ccfbf1', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 16,
  },
  locationText: { fontSize: 11, fontWeight: '700', color: '#0d9488', marginLeft: 4 },
  tabSelector: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 4,
    marginHorizontal: 16,
    marginVertical: 12,
    borderWidth: 1.5,
    borderColor: '#e7e5e4',
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
  },
  tabBtnActive: {
    backgroundColor: '#0d9488',
  },
  tabBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#78716c',
  },
  tabBtnTextActive: {
    color: '#ffffff',
  },
  content: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 80 },
  description: { fontSize: 14, color: '#78716c', lineHeight: 20, marginBottom: 24, fontWeight: '500' },

  searchCard: {
    backgroundColor: '#ffffff', borderRadius: 20, padding: 16,
    borderWidth: 1.5, borderColor: '#e7e5e4',
    shadowColor: '#0d9488', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8,
    elevation: 2, marginBottom: 20,
  },
  inputLabel: { fontSize: 11, fontWeight: '800', color: '#78716c', marginBottom: 8, letterSpacing: 0.6, textTransform: 'uppercase' },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#e7e5e4', borderRadius: 12,
    paddingHorizontal: 12, height: 48, marginBottom: 16, backgroundColor: '#faf7f2',
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 15, color: '#1c1917', height: '100%', padding: 0, fontWeight: '600' },
  searchButton: { backgroundColor: '#0d9488', borderRadius: 12, height: 48, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  searchButtonDisabled: { backgroundColor: '#99d6d0' },
  searchButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  loaderContainer: { alignItems: 'center', justifyContent: 'center', marginVertical: 40 },
  loaderText: { marginTop: 12, fontSize: 14, color: '#a8a29e', fontWeight: '500' },
  resultContainer: { marginTop: 8 },
  demoNotice: {
    flexDirection: 'row', backgroundColor: '#fffbeb', padding: 12, borderRadius: 12,
    borderWidth: 1, borderColor: '#fde68a', marginBottom: 16, alignItems: 'flex-start',
  },
  demoNoticeText: { flex: 1, fontSize: 12, color: '#92400e', marginLeft: 8, lineHeight: 16, fontWeight: '500' },
  profileCard: {
    backgroundColor: '#ffffff', borderRadius: 20, padding: 16,
    borderWidth: 1.5, borderColor: '#e7e5e4', marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 6,
  },
  profileHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  profileInfo: { flex: 1 },
  resultPlate: { fontSize: 20, fontWeight: '800', color: '#1c1917', letterSpacing: 0.5 },
  resultOwner: { fontSize: 13, color: '#78716c', marginTop: 4, fontWeight: '600' },
  resultType: { fontSize: 12, color: '#a8a29e', marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  statusBadgeRed: { backgroundColor: '#fee2e2' },
  statusBadgeGreen: { backgroundColor: '#dcfce7' },
  statusText: { fontSize: 11, fontWeight: '700' },
  statusTextRed: { color: '#dc2626' },
  statusTextGreen: { color: '#16a34a' },
  divider: { height: 1.5, backgroundColor: '#e7e5e4', marginVertical: 14 },
  totalFineRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { fontSize: 14, color: '#78716c', fontWeight: '500' },
  totalValue: { fontSize: 22, fontWeight: '800', color: '#dc2626' },
  challanListContainer: {
    backgroundColor: '#ffffff', borderRadius: 20, padding: 16,
    borderWidth: 1.5, borderColor: '#e7e5e4', marginBottom: 16,
  },
  sectionSubTitle: { fontSize: 11, fontWeight: '700', color: '#a8a29e', marginBottom: 12, letterSpacing: 0.6, textTransform: 'uppercase' },
  challanItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0ebe3',
  },
  challanLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  violationIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: '#fee2e2', justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  challanDetails: { flex: 1 },
  violationTitle: { fontSize: 14, fontWeight: '700', color: '#1c1917' },
  violationLoc: { fontSize: 12, color: '#78716c', marginTop: 2 },
  violationDate: { fontSize: 11, color: '#a8a29e', marginTop: 2 },
  violationAmount: { fontSize: 15, fontWeight: '700', color: '#1c1917', marginLeft: 8 },
  payButton: {
    backgroundColor: '#0d9488', borderRadius: 12, height: 48,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 16,
  },
  payButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  clearContainer: {
    backgroundColor: '#fff', borderRadius: 20, padding: 24,
    borderWidth: 1.5, borderColor: '#e7e5e4', alignItems: 'center', marginBottom: 16,
  },
  checkWrapper: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: '#ccfbf1', justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  clearTitle: { fontSize: 18, fontWeight: '700', color: '#16a34a', marginBottom: 6 },
  clearDesc: { fontSize: 13, color: '#78716c', textAlign: 'center', lineHeight: 18 },
  lastUpdatedText: { fontSize: 11, color: '#a8a29e', textAlign: 'center', marginTop: 16, marginBottom: 8 },
  rulesSectionHeader: { flexDirection: 'row', alignItems: 'center', marginTop: 16, marginBottom: 12 },
  rulesSectionTitle: { fontSize: 22, fontWeight: '800', color: '#1c1917', marginLeft: 8 },
  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  categoryCard: {
    width: '48%', backgroundColor: '#ffffff', borderRadius: 16, padding: 16, marginBottom: 16,
    borderWidth: 1.5, borderColor: '#e7e5e4',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 4, elevation: 2,
  },
  iconWrapper: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  categoryTitle: { fontSize: 14, fontWeight: '700', color: '#1c1917', marginBottom: 4 },
  categorySubtitle: { fontSize: 12, color: '#a8a29e' },
  sectionContainer: { marginTop: 8 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: '#a8a29e', letterSpacing: 1, marginBottom: 16, textTransform: 'uppercase' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(28,25,23,0.6)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: '#faf7f2', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderWidth: 1.5, borderColor: '#e7e5e4', padding: 24, maxHeight: '80%', minHeight: 450,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  modalIconWrapper: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#1c1917' },
  modalScroll: { marginBottom: 20 },
  modalDesc: { fontSize: 13, color: '#78716c', lineHeight: 18, marginBottom: 20, fontWeight: '500' },
  accordionItem: {
    backgroundColor: '#ffffff', borderRadius: 16,
    borderWidth: 1.5, borderColor: '#e7e5e4', marginBottom: 12, overflow: 'hidden',
  },
  accordionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  accordionTitleContainer: { flex: 1, marginRight: 12 },
  jurisdictionName: { fontSize: 14, fontWeight: '700', color: '#1c1917' },
  accordionPenalty: { fontSize: 12, color: '#dc2626', fontWeight: '600', marginTop: 4 },
  accordionDetails: { backgroundColor: '#faf7f2', borderTopWidth: 1.5, borderTopColor: '#e7e5e4', padding: 16 },
  detailsLabel: { fontSize: 10, fontWeight: '700', color: '#a8a29e', letterSpacing: 0.6, marginBottom: 6, textTransform: 'uppercase' },
  detailsText: { fontSize: 13, color: '#78716c', lineHeight: 18, fontWeight: '500' },
  jurisdictionRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  jurisdictionText: { flex: 1, fontSize: 14, fontWeight: '700', color: '#1c1917' },
  jurisdictionChangeText: { fontSize: 12, fontWeight: '700', color: '#d97706' },
  zoneChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  zoneChip: { backgroundColor: '#fffbeb', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  zoneChipText: { fontSize: 11, fontWeight: '700', color: '#b45309', textTransform: 'capitalize' },
  challanOfflineBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, padding: 8,
    backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fde68a', borderRadius: 8,
  },
  challanOfflineText: { flex: 1, fontSize: 11, color: '#92400e', fontWeight: '500' },
  challanResultCard: {
    marginTop: 16, padding: 16, backgroundColor: '#fffbeb',
    borderRadius: 16, borderWidth: 1.5, borderColor: '#fde68a', alignItems: 'center',
  },
  challanAmountText: { fontSize: 32, fontWeight: '800', color: '#d97706' },
  challanSectionText: { marginTop: 6, fontSize: 13, fontWeight: '600', color: '#92400e' },
  challanZoneNote: { marginTop: 6, fontSize: 11, color: '#92400e', textAlign: 'center' },
  pickerRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f0ebe3',
  },
  pickerRowText: { fontSize: 15, fontWeight: '600', color: '#1c1917' },
  calculatorCard: {
    backgroundColor: '#ffffff', borderRadius: 24, padding: 18,
    borderWidth: 1.5, borderColor: '#e7e5e4',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 10, elevation: 3,
  },
  jurisdictionPin: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#fffbeb', alignItems: 'center', justifyContent: 'center' },
  jurisdictionChangeButton: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, backgroundColor: '#fffbeb' },
  calcStep: { marginTop: 18 },
  calcStepHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  stepBadge: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#e7e5e4', alignItems: 'center', justifyContent: 'center' },
  stepBadgeActive: { backgroundColor: '#0d9488' },
  stepBadgeText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  calcStepLabel: { fontSize: 12, fontWeight: '700', color: '#78716c', letterSpacing: 0.5, textTransform: 'uppercase' },
  vehicleChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  vehicleChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16,
    borderWidth: 1.5, borderColor: '#e7e5e4', backgroundColor: '#faf7f2',
  },
  vehicleChipActive: { backgroundColor: '#0d9488', borderColor: '#0d9488' },
  vehicleChipText: { fontSize: 13, fontWeight: '700', color: '#78716c' },
  vehicleChipTextActive: { color: '#fff' },
  violationPickerButton: {
    flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: '#e7e5e4',
    borderRadius: 16, paddingHorizontal: 12, paddingVertical: 14, gap: 10,
  },
  violationPickerIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#ccfbf1', alignItems: 'center', justifyContent: 'center' },
  violationPickerText: { flex: 1, fontSize: 15, fontWeight: '600', color: '#1c1917' },
  violationPickerPlaceholder: { color: '#a8a29e', fontWeight: '400' },
  challanResultIconWrap: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#fffbeb', alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  lawsAppliedBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  lawsAppliedText: { fontSize: 12, fontWeight: '600', color: '#78716c' },
});
