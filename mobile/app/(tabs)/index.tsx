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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { useSettings } from '../../hooks/useSettings';
import { useCamera } from '../../hooks/useCamera';
import { useAuth } from '../../hooks/useAuth';
import { getApiBaseUrl } from '../../lib/api';

// ─── Colors ───────────────────────────────────────────────────────────────
const C = {
  bg:         '#07070f',
  bg2:        '#0d0d1a',
  surface:    'rgba(255,255,255,0.05)',
  surfaceH:   'rgba(255,255,255,0.09)',
  border:     'rgba(255,255,255,0.08)',
  borderH:    'rgba(255,255,255,0.16)',
  text:       '#f1f5f9',
  muted:      '#94a3b8',
  dim:        '#475569',
  accent:     '#6366f1',
  accent2:    '#8b5cf6',
  danger:     '#ef4444',
  success:    '#10b981',
  warning:    '#f59e0b',
  blue:       '#3b82f6',
};

// ─── Chat message type ───────────────────────────────────────────────────
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
  const [address, setAddress] = useState('Fetching Location...');
  const [region, setRegion] = useState('Locating...');
  const [greetingTime, setGreetingTime] = useState('GOOD MORNING');

  // ── Chat state ──────────────────────────────────────────────────────────
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { id: '1', sender: 'ai', text: '👋 Hi! I\'m your DriveLegal AI. Ask me about traffic rules, fines, or legal rights.' },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatScrollRef = useRef<ScrollView>(null);
  const fabScale = useRef(new Animated.Value(1)).current;

  // ── Greeting ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreetingTime('GOOD MORNING');
    else if (hour < 17) setGreetingTime('GOOD AFTERNOON');
    else if (hour < 21) setGreetingTime('GOOD EVENING');
    else setGreetingTime('HI, NIGHT OWL');
  }, []);

  // ── Briefs ───────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const response = await fetch(`${getApiBaseUrl()}/briefs`);
        const data = await response.json();
        if (data.status === 'ok' && data.briefs) {
          setBriefs(data.briefs);
        } else throw new Error('bad data');
      } catch {
        setBriefs([
          { id: '1', title: 'New Expressway Speed Limits', desc: 'NHAI updated LMV speed limits to 120 kmph on major expressways.', icon: 'speedometer', iconBg: 'rgba(99,102,241,0.15)', iconColor: '#6366f1' },
          { id: '2', title: 'Digital RC & License Valid', desc: 'Traffic police must now accept digital documents via DigiLocker.', icon: 'cellphone-check', iconBg: 'rgba(16,185,129,0.15)', iconColor: '#10b981' },
          { id: '3', title: 'E-Challan Grace Extended', desc: 'Vehicle owners now have 45 days to dispute an e-challan.', icon: 'gavel', iconBg: 'rgba(245,158,11,0.15)', iconColor: '#f59e0b' },
        ]);
      } finally { setLoadingBriefs(false); }
    })();
  }, []);

  // ── Notifications count ───────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${getApiBaseUrl()}/notifications`, { signal: AbortSignal.timeout(8000) });
        if (res.ok) {
          const data = await res.json();
          if (data.status === 'ok' && Array.isArray(data.notifications)) {
            setNotificationCount(data.notifications.length);
          }
        }
      } catch {}
    })();
  }, []);

  // ── Location ─────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') { setAddress('Location Denied'); return; }
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
        let placeName = 'Unknown Location', regionName = 'Tamil Nadu';
        try {
          if (Platform.OS === 'web') {
            const r = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${loc.coords.latitude}&longitude=${loc.coords.longitude}&localityLanguage=en`);
            const d = await r.json();
            placeName = d.city || d.locality || 'Unknown Location';
            regionName = d.principalSubdivision || 'Tamil Nadu';
          } else {
            const g = await Location.reverseGeocodeAsync(loc.coords);
            if (g.length > 0) { const p = g[0]; placeName = [p.street, p.city].filter(Boolean).join(', ') || 'Unknown'; regionName = p.region || 'Tamil Nadu'; }
          }
        } catch {}
        setAddress(placeName); setRegion(regionName);
        const p = placeName.toLowerCase();
        let speedLimit = 50, zoneType = 'general';
        const IITM = { minLat: 12.985, maxLat: 13.01, minLon: 80.223, maxLon: 80.25 };
        if (loc.coords.latitude >= IITM.minLat && loc.coords.latitude <= IITM.maxLat && loc.coords.longitude >= IITM.minLon && loc.coords.longitude <= IITM.maxLon) { speedLimit = 20; zoneType = 'campus_zone'; }
        else if (p.includes('school') || p.includes('college')) { speedLimit = 30; zoneType = 'school_zone'; }
        else if (p.includes('hospital')) { speedLimit = 30; zoneType = 'hospital_zone'; }
        else if (p.includes('express') || p.includes('highway')) { speedLimit = 80; }
        setSharedLocation(prev => ({ ...prev, latitude: loc.coords.latitude, longitude: loc.coords.longitude, placeName, regionName, speedLimit, zoneType }));
      } catch { setAddress('Chennai'); setRegion('Tamil Nadu'); }
    })();
  }, []);

  // ── Chat logic ────────────────────────────────────────────────────────────
  function pulseFab() {
    Animated.sequence([
      Animated.spring(fabScale, { toValue: 0.88, useNativeDriver: true }),
      Animated.spring(fabScale, { toValue: 1, useNativeDriver: true }),
    ]).start();
  }

  async function sendChatMessage() {
    const msg = chatInput.trim();
    if (!msg || chatLoading) return;
    const userMsg: ChatMessage = { id: Date.now().toString(), sender: 'user', text: msg };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setChatLoading(true);
    setTimeout(() => chatScrollRef.current?.scrollToEnd({ animated: true }), 100);
    try {
      const res = await fetch(`${getApiBaseUrl()}/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: msg, history: [] }),
      });
      const data = await res.json();
      const aiReply = data.answer || data.text || "I'm unable to respond right now.";
      setChatMessages(prev => [...prev, { id: (Date.now() + 1).toString(), sender: 'ai', text: aiReply }]);
    } catch {
      setChatMessages(prev => [...prev, { id: (Date.now() + 1).toString(), sender: 'ai', text: "Sorry, I can't reach the server right now." }]);
    } finally {
      setChatLoading(false);
      setTimeout(() => chatScrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }

  const name = (user?.name || profile.name || 'Driver').split(' ')[0];
  const isSpecialZone = sharedLocation.zoneType && sharedLocation.zoneType !== 'general';

  return (
    <SafeAreaView style={S.root}>
      <StatusBar style="light" />
      <ScrollView style={S.scroll} contentContainerStyle={S.content} showsVerticalScrollIndicator={false}>

        {/* ── Top Header ── */}
        <View style={S.header}>
          <View style={S.headerLeft}>
            <View style={S.logoBadge}>
              <Text style={S.logoText}>DL</Text>
            </View>
            <View>
              <Text style={S.greetLabel}>{greetingTime}</Text>
              <Text style={S.greetName} numberOfLines={1}>{name}</Text>
            </View>
          </View>
          <TouchableOpacity style={S.bellBtn} onPress={() => router.push('/notifications')}>
            <Ionicons name="notifications-outline" size={20} color={C.text} />
            {notificationsEnabled && notificationCount > 0 && (
              <View style={S.bellBadge}>
                <Text style={S.bellBadgeText}>{notificationCount > 9 ? '9+' : String(notificationCount)}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* ── Location Card ── */}
        <View style={S.locationCard}>
          <View style={S.locationCardGlow} />
          <View style={S.locationHeader}>
            <Ionicons name="location" size={14} color={C.accent} />
            <Text style={S.locationLabel}>LIVE LOCATION</Text>
          </View>
          <Text style={S.locationPlace} numberOfLines={1}>{sharedLocation.placeName || address}</Text>
          <Text style={S.locationRegion}>{sharedLocation.regionName || region}</Text>
          <View style={S.pillsRow}>
            <View style={S.pill}>
              <Text style={S.pillLabel}>SPEED LIMIT</Text>
              <Text style={S.pillVal}><Text style={S.pillValAccent}>{sharedLocation.speedLimit || '—'}</Text>{sharedLocation.speedLimit ? ' kmph' : ''}</Text>
            </View>
            <View style={[S.pill, isSpecialZone && S.pillDanger]}>
              <Text style={[S.pillLabel, isSpecialZone && { color: '#fca5a5' }]}>ZONE TYPE</Text>
              <Text style={[S.pillVal, isSpecialZone && { color: C.danger }]}>
                {sharedLocation.zoneType === 'general' ? 'General' : (sharedLocation.zoneType || 'General').replace('_', ' ').toUpperCase()}
              </Text>
            </View>
          </View>
        </View>

        {/* ── SOS Banner ── */}
        <TouchableOpacity style={S.sosBanner} onPress={() => router.push('/sos')} activeOpacity={0.85}>
          <View style={S.sosIconWrap}>
            <Ionicons name="warning" size={20} color={C.danger} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={S.sosTitle}>{t('sos_title') || 'Emergency SOS'}</Text>
            <Text style={S.sosSub}>{t('sos_subtitle') || 'Tap to call emergency services'}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="rgba(239,68,68,0.5)" />
        </TouchableOpacity>

        {/* ── Quick Actions ── */}
        <Text style={S.sectionTitle}>Quick Actions</Text>
        <View style={S.actionsGrid}>
          <TouchableOpacity style={[S.actionCard, S.actionAccent]} onPress={() => { pulseFab(); setChatOpen(true); }} activeOpacity={0.85}>
            <View style={S.actionIconWrap}>
              <Ionicons name="chatbubble-ellipses-outline" size={20} color="#fff" />
            </View>
            <Text style={S.actionTitleLight}>{t('ask_title') || 'Ask AI'}</Text>
            <Text style={S.actionSubLight}>{t('ask_subtitle') || 'Legal assistant'}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={S.actionCard} onPress={() => router.push('/(tabs)/fines')} activeOpacity={0.85}>
            <View style={[S.actionIconWrap, { backgroundColor: 'rgba(245,158,11,0.15)' }]}>
              <Ionicons name="document-text-outline" size={20} color={C.warning} />
            </View>
            <Text style={S.actionTitle}>{t('challan_title') || 'Fines & Rules'}</Text>
            <Text style={S.actionSub}>{t('challan_subtitle') || 'Check challans'}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={S.actionCard} onPress={() => router.push('/settings/documents')} activeOpacity={0.85}>
            <View style={[S.actionIconWrap, { backgroundColor: 'rgba(59,130,246,0.15)' }]}>
              <Ionicons name="folder-outline" size={20} color={C.blue} />
            </View>
            <Text style={S.actionTitle}>{t('vault_title') || 'Doc Vault'}</Text>
            <Text style={S.actionSub}>{t('vault_subtitle') || 'Store documents'}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={S.actionCard} onPress={() => router.push('/(tabs)/report')} activeOpacity={0.85}>
            <View style={[S.actionIconWrap, { backgroundColor: 'rgba(139,92,246,0.15)' }]}>
              <Ionicons name="megaphone-outline" size={20} color={C.accent2} />
            </View>
            <Text style={S.actionTitle}>{t('report_title') || 'Report'}</Text>
            <Text style={S.actionSub}>{t('report_subtitle') || 'File incident'}</Text>
          </TouchableOpacity>
        </View>

        {/* ── Today's Brief ── */}
        <View style={S.briefHeader}>
          <Text style={S.sectionTitle}>Today's Brief</Text>
          <TouchableOpacity><Text style={S.seeAll}>See all →</Text></TouchableOpacity>
        </View>

        {loadingBriefs ? (
          <ActivityIndicator size="small" color={C.accent} style={{ marginTop: 20 }} />
        ) : (
          briefs.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={S.briefCard}
              onPress={() => item.link ? Linking.openURL(item.link).catch(() => {}) : null}
              activeOpacity={0.8}
            >
              <View style={[S.briefIcon, { backgroundColor: item.iconBg || 'rgba(99,102,241,0.15)' }]}>
                <MaterialCommunityIcons name={(item.icon as any) || 'newspaper'} size={18} color={item.iconColor || C.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={S.briefCardTitle} numberOfLines={1}>{item.title}</Text>
                <Text style={S.briefCardDesc} numberOfLines={2}>{item.desc}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={C.dim} style={{ marginTop: 2 }} />
            </TouchableOpacity>
          ))
        )}

        <View style={{ height: 24 }} />
      </ScrollView>

      {/* ── Floating AI Chat FAB ── */}
      <Animated.View style={[S.fab, { transform: [{ scale: fabScale }] }]}>
        <TouchableOpacity
          style={S.fabInner}
          onPress={() => { pulseFab(); setChatOpen(true); }}
          activeOpacity={0.9}
        >
          <Ionicons name="chatbubble-ellipses" size={24} color="#fff" />
        </TouchableOpacity>
      </Animated.View>

      {/* ── Chat Modal ── */}
      <Modal visible={chatOpen} animationType="slide" transparent presentationStyle="overFullScreen" onRequestClose={() => setChatOpen(false)}>
        <KeyboardAvoidingView
          style={S.chatOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableOpacity style={S.chatDismiss} onPress={() => setChatOpen(false)} activeOpacity={1} />
          <View style={S.chatPanel}>
            {/* Chat Header */}
            <View style={S.chatHeader}>
              <View style={S.chatAvatar}>
                <Ionicons name="sparkles" size={18} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={S.chatName}>DriveLegal AI</Text>
                <Text style={S.chatStatus}>● Online</Text>
              </View>
              <TouchableOpacity onPress={() => setChatOpen(false)} style={S.chatClose}>
                <Ionicons name="close" size={20} color={C.muted} />
              </TouchableOpacity>
            </View>

            {/* Messages */}
            <ScrollView
              ref={chatScrollRef}
              style={S.chatMessages}
              contentContainerStyle={{ padding: 16, gap: 12 }}
              showsVerticalScrollIndicator={false}
            >
              {chatMessages.map((msg) => (
                <View key={msg.id} style={[S.chatMsg, msg.sender === 'user' ? S.chatMsgUser : S.chatMsgAi]}>
                  <Text style={[S.chatBubble, msg.sender === 'user' ? S.chatBubbleUser : S.chatBubbleAi]}>
                    {msg.text}
                  </Text>
                </View>
              ))}
              {chatLoading && (
                <View style={S.chatMsgAi}>
                  <View style={[S.chatBubble, S.chatBubbleAi, { flexDirection: 'row', gap: 6 }]}>
                    <ActivityIndicator size="small" color={C.accent} />
                    <Text style={{ color: C.muted, fontSize: 13 }}>Thinking…</Text>
                  </View>
                </View>
              )}
            </ScrollView>

            {/* Suggestions */}
            {chatMessages.length === 1 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={S.suggestRow} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
                {['What are my legal rights?', 'How to dispute a challan?', 'Speed limits in school zones?'].map((s) => (
                  <TouchableOpacity key={s} style={S.suggestionChip} onPress={() => { setChatInput(s); }}>
                    <Text style={S.suggestionText}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {/* Input */}
            <View style={S.chatInputRow}>
              <TextInput
                style={S.chatInput}
                value={chatInput}
                onChangeText={setChatInput}
                placeholder="Ask anything about traffic law…"
                placeholderTextColor={C.dim}
                multiline
                returnKeyType="send"
                onSubmitEditing={sendChatMessage}
                blurOnSubmit
                {...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {})}
              />
              <TouchableOpacity style={S.chatSendBtn} onPress={sendChatMessage} disabled={chatLoading}>
                <Ionicons name="send" size={16} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  root:         { flex: 1, backgroundColor: C.bg },
  scroll:       { flex: 1 },
  content:      { padding: 20, paddingBottom: 100 },

  // Header
  header:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  headerLeft:   { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  logoBadge:    { width: 38, height: 38, borderRadius: 11, backgroundColor: C.accent, justifyContent: 'center', alignItems: 'center' },
  logoText:     { color: '#fff', fontWeight: '800', fontSize: 13 },
  greetLabel:   { fontSize: 10, fontWeight: '700', color: C.dim, letterSpacing: 0.8 },
  greetName:    { fontSize: 16, fontWeight: '700', color: C.text },
  bellBtn:      { width: 40, height: 40, borderRadius: 20, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, justifyContent: 'center', alignItems: 'center' },
  bellBadge:    { position: 'absolute', top: 6, right: 6, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: C.danger, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3 },
  bellBadgeText:{ color: '#fff', fontSize: 9, fontWeight: '700' },

  // Location
  locationCard: { backgroundColor: C.surface, borderRadius: 20, borderWidth: 1, borderColor: C.border, padding: 20, marginBottom: 16, overflow: 'hidden' },
  locationCardGlow: { position: 'absolute', top: -40, left: -40, width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(99,102,241,0.08)' },
  locationHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  locationLabel:  { fontSize: 10, fontWeight: '700', color: C.accent, letterSpacing: 0.8 },
  locationPlace:  { fontSize: 22, fontWeight: '800', color: C.text, marginBottom: 4 },
  locationRegion: { fontSize: 13, color: C.muted, marginBottom: 18 },
  pillsRow:       { flexDirection: 'row', gap: 10 },
  pill:           { flex: 1, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: C.border },
  pillDanger:     { backgroundColor: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.2)' },
  pillLabel:      { color: C.dim, fontSize: 10, fontWeight: '700', letterSpacing: 0.5, marginBottom: 4 },
  pillVal:        { color: C.text, fontSize: 14, fontWeight: '700' },
  pillValAccent:  { color: C.warning, fontSize: 18, fontWeight: '800' },

  // SOS
  sosBanner: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, backgroundColor: 'rgba(239,68,68,0.08)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(239,68,68,0.18)', marginBottom: 28 },
  sosIconWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(239,68,68,0.15)', justifyContent: 'center', alignItems: 'center' },
  sosTitle:   { fontSize: 15, fontWeight: '700', color: '#fca5a5', marginBottom: 2 },
  sosSub:     { fontSize: 12, color: 'rgba(239,68,68,0.7)' },

  // Section titles
  sectionTitle: { fontSize: 16, fontWeight: '700', color: C.text, marginBottom: 14 },

  // Actions grid
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 28 },
  actionCard:  { width: '47%', backgroundColor: C.surface, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: C.border },
  actionAccent:{ background: undefined, backgroundColor: C.accent, borderColor: 'rgba(99,102,241,0.4)' },
  actionIconWrap: { width: 40, height: 40, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  actionTitle:      { fontSize: 15, fontWeight: '700', color: C.text, marginBottom: 3 },
  actionTitleLight: { fontSize: 15, fontWeight: '700', color: '#fff', marginBottom: 3 },
  actionSub:        { fontSize: 12, color: C.muted },
  actionSubLight:   { fontSize: 12, color: 'rgba(255,255,255,0.7)' },

  // Briefs
  briefHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  seeAll:      { fontSize: 13, color: C.accent, fontWeight: '600' },
  briefCard:   { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, backgroundColor: C.surface, borderRadius: 16, borderWidth: 1, borderColor: C.border, marginBottom: 10 },
  briefIcon:   { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  briefCardTitle: { fontSize: 14, fontWeight: '700', color: C.text, marginBottom: 3 },
  briefCardDesc:  { fontSize: 12, color: C.muted, lineHeight: 17 },

  // FAB
  fab:      { position: 'absolute', bottom: 90, right: 20, zIndex: 100 },
  fabInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: C.accent, justifyContent: 'center', alignItems: 'center', shadowColor: C.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 12, elevation: 10 },

  // Chat modal
  chatOverlay:  { flex: 1, justifyContent: 'flex-end' },
  chatDismiss:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  chatPanel:    { backgroundColor: '#0d0d1a', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderColor: C.border, maxHeight: '80%', minHeight: 400 },
  chatHeader:   { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderBottomWidth: 1, borderColor: C.border, backgroundColor: 'rgba(99,102,241,0.08)' },
  chatAvatar:   { width: 36, height: 36, borderRadius: 18, backgroundColor: C.accent, justifyContent: 'center', alignItems: 'center' },
  chatName:     { fontSize: 14, fontWeight: '700', color: C.text },
  chatStatus:   { fontSize: 11, color: C.success },
  chatClose:    { padding: 6 },
  chatMessages: { flexGrow: 0 },
  chatMsg:      { maxWidth: '82%' },
  chatMsgAi:    { alignSelf: 'flex-start' },
  chatMsgUser:  { alignSelf: 'flex-end' },
  chatBubble:   { padding: 12, borderRadius: 16, fontSize: 13, lineHeight: 19 } as any,
  chatBubbleAi:   { backgroundColor: 'rgba(255,255,255,0.06)', color: C.text, borderTopLeftRadius: 4 } as any,
  chatBubbleUser: { backgroundColor: C.accent, color: '#fff', borderTopRightRadius: 4 } as any,
  suggestRow:   { maxHeight: 42, marginVertical: 8 },
  suggestionChip: { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: C.surface, borderRadius: 20, borderWidth: 1, borderColor: C.border },
  suggestionText: { fontSize: 12, color: C.muted, fontWeight: '500' },
  chatInputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, padding: 12, borderTopWidth: 1, borderColor: C.border },
  chatInput:    { flex: 1, backgroundColor: C.surface, borderRadius: 20, borderWidth: 1, borderColor: C.border, paddingHorizontal: 16, paddingVertical: 10, color: C.text, fontSize: 14, maxHeight: 80 },
  chatSendBtn:  { width: 40, height: 40, borderRadius: 20, backgroundColor: C.accent, justifyContent: 'center', alignItems: 'center' },
});
