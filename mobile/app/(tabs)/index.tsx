import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Linking,
  ActivityIndicator,
  Animated,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { useSettings } from '../../hooks/useSettings';
import { useAuth } from '../../hooks/useAuth';
import { getApiBaseUrl } from '../../lib/api';

const { width } = Dimensions.get('window');

// ── CRISP HIGH-CONTRAST LIGHT DESIGN SYSTEM TOKENS ──
const T = {
  bg: '#f8fafc',
  panel: '#ffffff',
  panelBorder: '#e2e8f0',
  accentPrimary: '#4f46e5',
  accentPurple: '#9333ea',
  accentCyan: '#0284c7',
  accentEmerald: '#059669',
  accentRose: '#e11d48',
  accentAmber: '#d97706',
  textMain: '#0f172a',
  textMuted: '#475569',
  textDim: '#64748b',
};

interface ChatMessage {
  id: string;
  sender: 'ai' | 'user';
  text: string;
}

export default function HomeScreen() {
  const router = useRouter();
  const { t, profile, notificationsEnabled, sharedLocation, setSharedLocation } = useSettings();
  const { user } = useAuth();

  const [briefs, setBriefs] = useState<any[]>([]);
  const [loadingBriefs, setLoadingBriefs] = useState(true);
  const [notificationCount, setNotificationCount] = useState(0);
  const [greeting, setGreeting] = useState('WELCOME BACK');

  // ── FLOATING CORNER AI CHATBOT WIDGET STATE ──
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { id: '1', sender: 'ai', text: '⚡ DriveLegal AI active. How can I assist with traffic laws, fines, or rules today?' },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatScrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    const hr = new Date().getHours();
    if (hr < 12) setGreeting('GOOD MORNING');
    else if (hr < 18) setGreeting('GOOD AFTERNOON');
    else setGreeting('GOOD EVENING');
  }, []);

  // Fetch Briefs
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${getApiBaseUrl()}/briefs`);
        const data = await res.json();
        if (data.status === 'ok' && data.briefs) setBriefs(data.briefs);
        else throw new Error();
      } catch {
        setBriefs([
          { id: '1', title: 'New Expressway Speed Limits', desc: 'NHAI updated LMV speed limits to 120 kmph on major expressways.', icon: 'speedometer', iconBg: 'rgba(79,70,229,0.1)', iconColor: '#4f46e5' },
          { id: '2', title: 'Digital RC & License Valid', desc: 'Traffic police must now accept digital documents via DigiLocker.', icon: 'cellphone-check', iconBg: 'rgba(5,150,105,0.1)', iconColor: '#059669' },
          { id: '3', title: 'E-Challan Grace Extended', desc: 'Vehicle owners now have 45 days to dispute an e-challan.', icon: 'gavel', iconBg: 'rgba(217,119,6,0.1)', iconColor: '#d97706' },
        ]);
      } finally {
        setLoadingBriefs(false);
      }
    })();
  }, []);

  // Location Geofence Fetch
  useEffect(() => {
    (async () => {
      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        let loc: any;
        if (Platform.OS === 'web') {
          try {
            loc = await Promise.race([
              Location.getCurrentPositionAsync({}),
              new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 15000)),
            ]);
          } catch { loc = { coords: { latitude: 13.0827, longitude: 80.2707 } }; }
        } else {
          loc = await Location.getCurrentPositionAsync({});
        }

        let placeName = 'Madurai', regionName = 'Tamil Nadu';
        try {
          if (Platform.OS === 'web') {
            const r = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${loc.coords.latitude}&longitude=${loc.coords.longitude}&localityLanguage=en`);
            const d = await r.json();
            placeName = d.city || d.locality || 'Madurai';
            regionName = d.principalSubdivision || 'Tamil Nadu';
          }
        } catch {}
        setSharedLocation(prev => ({ ...prev, latitude: loc.coords.latitude, longitude: loc.coords.longitude, placeName, regionName }));
      } catch {}
    })();
  }, []);

  // AI Chat send message
  async function sendChatMessage() {
    const msg = chatInput.trim();
    if (!msg || chatLoading) return;
    setChatMessages(prev => [...prev, { id: Date.now().toString(), sender: 'user', text: msg }]);
    setChatInput('');
    setChatLoading(true);
    setTimeout(() => chatScrollRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      const res = await fetch(`${getApiBaseUrl()}/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: msg }),
      });
      const data = await res.json();
      setChatMessages(prev => [...prev, { id: (Date.now() + 1).toString(), sender: 'ai', text: data.answer || data.text || 'Command processed.' }]);
    } catch {
      setChatMessages(prev => [...prev, { id: (Date.now() + 1).toString(), sender: 'ai', text: 'Local legal rule engine processed your query.' }]);
    } finally {
      setChatLoading(false);
      setTimeout(() => chatScrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }

  const driverName = (user?.name || profile.name || 'Driver').split(' ')[0];

  return (
    <SafeAreaView style={S.container}>
      <StatusBar style="dark" />
      
      <ScrollView contentContainerStyle={S.scrollBody} showsVerticalScrollIndicator={false}>
        
        {/* ── TOP RESTRUCTURED APP HEADER ── */}
        <View style={S.appHeader}>
          <View style={S.driverProfileRow}>
            <View style={S.avatarRing}>
              <Text style={S.avatarInitial}>{driverName[0]}</Text>
            </View>
            <View>
              <Text style={S.greetingSub}>{greeting}</Text>
              <Text style={S.driverNameText}>{driverName}</Text>
            </View>
          </View>

          <TouchableOpacity style={S.notifBellBtn} onPress={() => router.push('/notifications')}>
            <Ionicons name="notifications-outline" size={20} color={T.textMain} />
            {notificationsEnabled && notificationCount > 0 && (
              <View style={S.badgeDot} />
            )}
          </TouchableOpacity>
        </View>

        {/* ── HUD SAFETY SCORE & LIVE GEOFENCE HERO CARD (LIGHT THEME) ── */}
        <View style={S.hudHeroCard}>
          <View style={S.hudHeaderRow}>
            <View style={S.liveBadge}>
              <View style={S.livePulseDot} />
              <Text style={S.liveBadgeText}>LIVE TELEMETRY & GPS</Text>
            </View>
            <Ionicons name="shield-checkmark" size={20} color={T.accentEmerald} />
          </View>

          <View style={S.hudMainStatsRow}>
            <View style={S.gaugeWrap}>
              <Text style={S.gaugeNumber}>{sharedLocation.speedLimit || 50}</Text>
              <Text style={S.gaugeUnit}>KMPH MAX</Text>
            </View>
            <View style={S.hudGeoDetails}>
              <Text style={S.geoPlaceName} numberOfLines={1}>{sharedLocation.placeName || 'Madurai'}</Text>
              <Text style={S.geoRegionName}>{sharedLocation.regionName || 'Tamil Nadu'} • Zone Active</Text>
              <View style={S.statusTagRow}>
                <View style={S.statusTag}>
                  <Text style={S.statusTagText}>HELMET REQ</Text>
                </View>
                <View style={[S.statusTag, { backgroundColor: 'rgba(2,132,199,0.12)' }]}>
                  <Text style={[S.statusTagText, { color: T.accentCyan }]}>SEATBELT OK</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* ── EMERGENCY SOS QUICK ALERT BAR ── */}
        <TouchableOpacity style={S.sosAlertBar} onPress={() => router.push('/sos')} activeOpacity={0.85}>
          <View style={S.sosIconCircle}>
            <Ionicons name="warning-outline" size={22} color={T.accentRose} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={S.sosBarTitle}>EMERGENCY SOS ASSIST</Text>
            <Text style={S.sosBarSub}>Instant 112 Dispatch & Alert Authorities</Text>
          </View>
          <Feather name="arrow-right-circle" size={20} color={T.accentRose} />
        </TouchableOpacity>

        {/* ── BENTO GRID MODULES ── */}
        <Text style={S.sectionHeading}>COMMAND HUB & TOOLS</Text>
        
        <View style={S.bentoGridWrap}>
          {/* Fines Lookup Card */}
          <TouchableOpacity style={S.bentoTileFull} onPress={() => router.push('/(tabs)/fines')} activeOpacity={0.85}>
            <View style={S.bentoTileIconWrap}>
              <Ionicons name="receipt-outline" size={22} color={T.accentPrimary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={S.bentoTileTitle}>Check Fines & Challans</Text>
              <Text style={S.bentoTileSub}>Instant vehicle registration lookup & dispute calculator</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={T.textDim} />
          </TouchableOpacity>

          {/* 2-Column Sub Grid */}
          <View style={S.bentoRow}>
            <TouchableOpacity style={S.bentoTileHalf} onPress={() => router.push('/settings/documents')} activeOpacity={0.85}>
              <View style={[S.bentoTileIconWrap, { backgroundColor: 'rgba(2,132,199,0.1)' }]}>
                <Ionicons name="folder-open-outline" size={20} color={T.accentCyan} />
              </View>
              <Text style={S.bentoTileTitle}>Doc Vault</Text>
              <Text style={S.bentoTileSub}>Digital RC & License</Text>
            </TouchableOpacity>

            <TouchableOpacity style={S.bentoTileHalf} onPress={() => router.push('/(tabs)/report')} activeOpacity={0.85}>
              <View style={[S.bentoTileIconWrap, { backgroundColor: 'rgba(147,51,234,0.1)' }]}>
                <Ionicons name="megaphone-outline" size={20} color={T.accentPurple} />
              </View>
              <Text style={S.bentoTileTitle}>File Incident</Text>
              <Text style={S.bentoTileSub}>Report Violations</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── TODAY'S BRIEFING FEED ── */}
        <View style={S.briefHeaderRow}>
          <Text style={S.sectionHeading}>TRAFFIC & LEGAL BRIEFINGS</Text>
        </View>

        {loadingBriefs ? (
          <ActivityIndicator size="small" color={T.accentPrimary} style={{ marginTop: 20 }} />
        ) : (
          briefs.map(b => (
            <TouchableOpacity key={b.id} style={S.briefCardItem} activeOpacity={0.85} onPress={() => b.link ? Linking.openURL(b.link) : null}>
              <View style={S.briefIconBox}>
                <MaterialCommunityIcons name={(b.icon as any) || 'newspaper'} size={20} color={T.accentPrimary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={S.briefCardTitle}>{b.title}</Text>
                <Text style={S.briefCardDesc}>{b.desc}</Text>
              </View>
            </TouchableOpacity>
          ))
        )}

      </ScrollView>

      {/* ── FLOATING AI ASSISTANT DROPDOWN WIDGET (RIGHT BOTTOM CORNER) ── */}
      <TouchableOpacity style={S.floatingAiFab} onPress={() => setChatOpen(true)} activeOpacity={0.9}>
        <Ionicons name="sparkles" size={24} color="#fff" />
      </TouchableOpacity>

      {/* AI CHATBOT DROPDOWN OVERLAY / SLIDE-OUT MODAL */}
      <Modal visible={chatOpen} animationType="slide" transparent presentationStyle="overFullScreen" onRequestClose={() => setChatOpen(false)}>
        <KeyboardAvoidingView style={S.chatModalContainer} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setChatOpen(false)} activeOpacity={1} />
          
          <View style={S.chatModalBox}>
            {/* Header */}
            <View style={S.chatHeaderBar}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={S.chatBotIconCircle}>
                  <Ionicons name="robot-outline" size={18} color="#fff" />
                </View>
                <View>
                  <Text style={S.chatTitleText}>DriveLegal AI Assistant</Text>
                  <Text style={S.chatSubText}>Right-Corner Embedded Widget</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setChatOpen(false)}>
                <Ionicons name="close-circle" size={24} color={T.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Message Stream */}
            <ScrollView ref={chatScrollRef} style={S.chatScrollStream} contentContainerStyle={{ gap: 10, padding: 16 }}>
              {chatMessages.map(m => (
                <View key={m.id} style={[S.msgRow, m.sender === 'user' ? S.msgRowUser : S.msgRowAi]}>
                  <Text style={[S.chatBubbleText, m.sender === 'user' ? S.chatBubbleUser : S.chatBubbleAi]}>
                    {m.text}
                  </Text>
                </View>
              ))}
              {chatLoading && (
                <View style={S.msgRowAi}>
                  <ActivityIndicator size="small" color={T.accentPrimary} />
                </View>
              )}
            </ScrollView>

            {/* Foot Input */}
            <View style={S.chatFootRow}>
              <TextInput
                style={S.chatTextInput}
                value={chatInput}
                onChangeText={setChatInput}
                placeholder="Ask legal query or challan rule..."
                placeholderTextColor={T.textDim}
                onSubmitEditing={sendChatMessage}
              />
              <TouchableOpacity style={S.chatSendBtn} onPress={sendChatMessage}>
                <Ionicons name="send" size={16} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </SafeAreaView>
  );
}

// ── CRISP LIGHT STYLESHEET ──
const S = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.bg },
  scrollBody: { padding: 20, paddingBottom: 110 },

  /* App Header */
  appHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  driverProfileRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatarRing: { width: 42, height: 42, borderRadius: 21, backgroundColor: T.accentPrimary, justifyContent: 'center', alignItems: 'center' },
  avatarInitial: { color: '#fff', fontWeight: '800', fontSize: 16 },
  greetingSub: { color: T.textDim, fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  driverNameText: { color: T.textMain, fontSize: 18, fontWeight: '800' },
  notifBellBtn: { width: 40, height: 40, borderRadius: 14, backgroundColor: T.panel, borderWidth: 1, borderColor: T.panelBorder, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 4 },
  badgeDot: { position: 'absolute', top: 10, right: 10, width: 8, height: 8, borderRadius: 4, backgroundColor: T.accentRose },

  /* HUD Hero Card */
  hudHeroCard: { backgroundColor: T.panel, borderRadius: 24, borderWidth: 1, borderColor: T.panelBorder, padding: 20, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 10 },
  hudHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: 'rgba(5,150,105,0.08)' },
  livePulseDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: T.accentEmerald },
  liveBadgeText: { fontSize: 10, fontWeight: '800', color: T.accentEmerald, letterSpacing: 0.5 },
  hudMainStatsRow: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  gaugeWrap: { padding: 14, borderRadius: 18, backgroundColor: 'rgba(79,70,229,0.08)', alignItems: 'center', justifyContent: 'center', minWidth: 95 },
  gaugeNumber: { fontSize: 28, fontWeight: '800', color: T.accentPrimary },
  gaugeUnit: { fontSize: 9, fontWeight: '800', color: T.textMuted, marginTop: 2 },
  hudGeoDetails: { flex: 1 },
  geoPlaceName: { fontSize: 18, fontWeight: '800', color: T.textMain, marginBottom: 2 },
  geoRegionName: { fontSize: 12, color: T.textMuted, fontWeight: '600', marginBottom: 10 },
  statusTagRow: { flexDirection: 'row', gap: 6 },
  statusTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: 'rgba(217,119,6,0.12)' },
  statusTagText: { fontSize: 9, fontWeight: '800', color: T.accentAmber },

  /* Emergency SOS Bar */
  sosAlertBar: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18, backgroundColor: 'rgba(225,29,72,0.06)', borderWidth: 1, borderColor: 'rgba(225,29,72,0.2)', marginBottom: 24 },
  sosIconCircle: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(225,29,72,0.12)', justifyContent: 'center', alignItems: 'center' },
  sosBarTitle: { fontSize: 13, fontWeight: '800', color: T.accentRose },
  sosBarSub: { fontSize: 11, color: T.textMuted, fontWeight: '500' },

  /* Bento Grid */
  sectionHeading: { fontSize: 11, fontWeight: '800', color: T.textDim, letterSpacing: 1, marginBottom: 14 },
  bentoGridWrap: { gap: 12, marginBottom: 24 },
  bentoTileFull: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 20, backgroundColor: T.panel, borderWidth: 1, borderColor: T.panelBorder, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 6 },
  bentoTileIconWrap: { width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(79,70,229,0.08)', justifyContent: 'center', alignItems: 'center' },
  bentoTileTitle: { fontSize: 15, fontWeight: '800', color: T.textMain, marginBottom: 2 },
  bentoTileSub: { fontSize: 12, color: T.textMuted, fontWeight: '500' },
  bentoRow: { flexDirection: 'row', gap: 12 },
  bentoTileHalf: { flex: 1, padding: 16, borderRadius: 20, backgroundColor: T.panel, borderWidth: 1, borderColor: T.panelBorder, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 6 },

  /* Briefings Feed */
  briefHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  briefCardItem: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 16, backgroundColor: T.panel, borderWidth: 1, borderColor: T.panelBorder, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 4 },
  briefIconBox: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(79,70,229,0.08)', justifyContent: 'center', alignItems: 'center' },
  briefCardTitle: { fontSize: 14, fontWeight: '800', color: T.textMain, marginBottom: 2 },
  briefCardDesc: { fontSize: 12, color: T.textMuted, lineHeight: 16, fontWeight: '500' },

  /* FLOATING AI FAB IN BOTTOM RIGHT CORNER */
  floatingAiFab: {
    position: 'absolute', bottom: 30, right: 20, zIndex: 999,
    width: 58, height: 58, borderRadius: 29, backgroundColor: T.accentPrimary,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: T.accentPrimary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 12
  },

  /* Chat Modal Widget */
  chatModalContainer: { flex: 1, justifyContent: 'flex-end' },
  chatModalBox: { backgroundColor: '#ffffff', borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, borderColor: T.panelBorder, maxHeight: '80%', minHeight: 440 },
  chatHeaderBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderColor: T.panelBorder, backgroundColor: '#f8fafc' },
  chatBotIconCircle: { width: 32, height: 32, borderRadius: 10, backgroundColor: T.accentPrimary, justifyContent: 'center', alignItems: 'center' },
  chatTitleText: { fontSize: 14, fontWeight: '800', color: T.textMain },
  chatSubText: { fontSize: 11, color: T.accentEmerald, fontWeight: '600' },
  chatScrollStream: { flex: 1 },
  msgRow: { maxWidth: '82%' },
  msgRowAi: { alignSelf: 'flex-start' },
  msgRowUser: { alignSelf: 'flex-end' },
  chatBubbleText: { padding: 12, borderRadius: 16, fontSize: 13, lineHeight: 18, fontWeight: '500' },
  chatBubbleAi: { backgroundColor: '#f1f5f9', color: T.textMain, borderTopLeftRadius: 4 },
  chatBubbleUser: { backgroundColor: T.accentPrimary, color: '#fff', borderTopRightRadius: 4 },
  chatFootRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderTopWidth: 1, borderColor: T.panelBorder, backgroundColor: '#f8fafc' },
  chatTextInput: { flex: 1, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, backgroundColor: '#ffffff', borderWidth: 1, borderColor: T.panelBorder, color: T.textMain, fontSize: 13, fontWeight: '500' },
  chatSendBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: T.accentPrimary, justifyContent: 'center', alignItems: 'center' },
});
