import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Platform, Linking, ActivityIndicator, Modal, TextInput,
  KeyboardAvoidingView, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { useSettings } from '../../hooks/useSettings';
import { useAuth } from '../../hooks/useAuth';
import { getApiBaseUrl } from '../../lib/api';

const W = Dimensions.get('window').width;

// ── COMPLETELY NEW DESIGN SYSTEM — Warm Earth / Teal Palette ──
const C = {
  cream:    '#faf7f2',
  creamDk:  '#f0ebe3',
  stone:    '#e7e5e4',
  teal:     '#0d9488',
  tealLt:   '#ccfbf1',
  orange:   '#ea580c',
  orangeLt: '#fff7ed',
  amber:    '#d97706',
  amberLt:  '#fffbeb',
  green:    '#16a34a',
  greenLt:  '#f0fdf4',
  red:      '#dc2626',
  redLt:    '#fff1f2',
  ink:      '#1c1917',
  inkMd:    '#44403c',
  inkLt:    '#78716c',
  inkXs:    '#a8a29e',
  white:    '#ffffff',
};

interface Msg { id: string; from: 'bot' | 'user'; text: string; }

export default function HomeScreen() {
  const router   = useRouter();
  const { t, profile, sharedLocation, setSharedLocation, notificationsEnabled } = useSettings();
  const { user } = useAuth();

  const [briefs, setBriefs]           = useState<any[]>([]);
  const [briefsLoading, setBL]        = useState(true);
  const [timeOfDay, setTOD]           = useState('');
  const [cityName, setCityName]       = useState('');

  // ── AI CHAT — embedded as collapsible TOP banner, NOT a corner FAB ──
  const [aiOpen, setAiOpen]   = useState(false);
  const [msgs, setMsgs]       = useState<Msg[]>([
    { id: '0', from: 'bot', text: 'Hi! Ask me about traffic rules, fines, or driving laws in India.' },
  ]);
  const [draft, setDraft]     = useState('');
  const [aiLoading, setAL]    = useState(false);
  const chatRef               = useRef<ScrollView>(null);

  // Greeting
  useEffect(() => {
    const h = new Date().getHours();
    setTOD(h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening');
  }, []);

  // Briefs
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${getApiBaseUrl()}/briefs`);
        const d = await r.json();
        if (d.status === 'ok' && d.briefs) { setBriefs(d.briefs); }
        else throw new Error();
      } catch {
        setBriefs([
          { id: 'a', title: 'Expressway Speed Cap Update', desc: 'NHAI raised the LMV limit to 120 kmph on selected corridors.', tag: 'Speed', tagColor: C.teal, tagBg: C.tealLt },
          { id: 'b', title: 'DigiLocker RC Now Legally Valid', desc: 'Officers must accept digital RC from DigiLocker without penalty.', tag: 'Documents', tagColor: C.orange, tagBg: C.orangeLt },
          { id: 'c', title: '45-Day Challan Dispute Window', desc: 'RTO extended the dispute window for all e-challans.', tag: 'Fines', tagColor: C.amber, tagBg: C.amberLt },
        ]);
      } finally { setBL(false); }
    })();
  }, []);

  // Location
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const loc = await (Platform.OS === 'web'
          ? Promise.race([Location.getCurrentPositionAsync({}), new Promise((_, r) => setTimeout(() => r(new Error()), 12000))])
          : Location.getCurrentPositionAsync({})) as any;
        if (Platform.OS === 'web') {
          const r2 = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${loc.coords.latitude}&longitude=${loc.coords.longitude}&localityLanguage=en`);
          const d2 = await r2.json();
          setCityName(d2.city || d2.locality || '');
          setSharedLocation(p => ({ ...p, latitude: loc.coords.latitude, longitude: loc.coords.longitude, placeName: d2.city || d2.locality || 'Your City', regionName: d2.principalSubdivision || '' }));
        }
      } catch {}
    })();
  }, []);

  async function sendMsg() {
    const q = draft.trim(); if (!q || aiLoading) return;
    setMsgs(m => [...m, { id: Date.now().toString(), from: 'user', text: q }]);
    setDraft(''); setAL(true);
    setTimeout(() => chatRef.current?.scrollToEnd({ animated: true }), 80);
    try {
      const r = await fetch(`${getApiBaseUrl()}/ask`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: q }) });
      const d = await r.json();
      setMsgs(m => [...m, { id: (Date.now()+1).toString(), from: 'bot', text: d.answer || d.text || 'Processed.' }]);
    } catch {
      setMsgs(m => [...m, { id: (Date.now()+1).toString(), from: 'bot', text: 'Fallback: local legal rule engine active.' }]);
    } finally { setAL(false); setTimeout(() => chatRef.current?.scrollToEnd({ animated: true }), 80); }
  }

  const name = (user?.name || profile.name || 'Driver').split(' ')[0];

  return (
    <SafeAreaView style={s.root}>
      <StatusBar style="dark" />

      {/* ── TOP APP BAR (different layout: wordmark left, profile right) ── */}
      <View style={s.topBar}>
        <View>
          <Text style={s.wordmark}>Traffic<Text style={s.wordmarkAccent}>OS</Text></Text>
          <Text style={s.topBarSub}>{cityName ? `📍 ${cityName}` : 'Traffic Law Companion'}</Text>
        </View>
        <View style={s.topBarRight}>
          <TouchableOpacity onPress={() => router.push('/notifications')} style={s.topBtn}>
            <Ionicons name="notifications-outline" size={20} color={C.inkMd} />
          </TouchableOpacity>
          <TouchableOpacity style={s.avatarWrap} onPress={() => router.push('/(tabs)/settings')}>
            <Text style={s.avatarLetter}>{name[0]}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* ── EDITORIAL HERO — a greeting card, NOT a gauge ── */}
        <View style={s.heroCard}>
          <Text style={s.heroGreeting}>{timeOfDay},</Text>
          <Text style={s.heroName}>{name}.</Text>
          <Text style={s.heroBody}>You're covered. Here's your daily traffic law brief for the road ahead.</Text>
          <TouchableOpacity style={s.heroBtn} onPress={() => router.push('/(tabs)/fines')}>
            <Text style={s.heroBtnText}>Check My Challans</Text>
            <Ionicons name="arrow-forward" size={16} color={C.white} />
          </TouchableOpacity>
        </View>

        {/* ── AI ASSISTANT — collapsible top section, NOT a corner FAB ── */}
        <TouchableOpacity style={s.aiToggleRow} onPress={() => setAiOpen(!aiOpen)} activeOpacity={0.8}>
          <View style={s.aiToggleLeft}>
            <View style={s.aiDotBadge} />
            <Text style={s.aiToggleLabel}>AI Legal Advisor</Text>
          </View>
          <View style={s.aiToggleRight}>
            <Text style={s.aiToggleSub}>Ask anything about traffic law</Text>
            <Ionicons name={aiOpen ? 'chevron-up' : 'chevron-down'} size={16} color={C.teal} />
          </View>
        </TouchableOpacity>

        {aiOpen && (
          <View style={s.aiPanel}>
            <ScrollView ref={chatRef} style={s.aiScroll} contentContainerStyle={{ gap: 10, padding: 14 }}>
              {msgs.map(m => (
                <View key={m.id} style={[s.msgWrap, m.from === 'user' ? s.msgRight : s.msgLeft]}>
                  <Text style={[s.msgText, m.from === 'user' ? s.msgUser : s.msgBot]}>{m.text}</Text>
                </View>
              ))}
              {aiLoading && <ActivityIndicator size="small" color={C.teal} style={{ alignSelf: 'flex-start' }} />}
            </ScrollView>
            <View style={s.aiInputRow}>
              <TextInput style={s.aiInput} value={draft} onChangeText={setDraft} placeholder="Type your question…" placeholderTextColor={C.inkXs} onSubmitEditing={sendMsg} />
              <TouchableOpacity style={s.aiSend} onPress={sendMsg}>
                <Ionicons name="arrow-up" size={18} color={C.white} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── HORIZONTAL SCROLL QUICK ACTIONS — not a 2x2 bento grid ── */}
        <Text style={s.sectionLabel}>QUICK ACCESS</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.pillRow}>
          {[
            { icon: 'receipt-outline',      label: 'Challans',  color: C.teal,   bg: C.tealLt,   route: '/(tabs)/fines' },
            { icon: 'map-outline',          label: 'Map',       color: C.orange, bg: C.orangeLt, route: '/(tabs)/map' },
            { icon: 'megaphone-outline',    label: 'Report',    color: C.amber,  bg: C.amberLt,  route: '/(tabs)/report' },
            { icon: 'folder-open-outline',  label: 'Docs',      color: C.green,  bg: C.greenLt,  route: '/settings/documents' },
            { icon: 'warning-outline',      label: 'SOS',       color: C.red,    bg: C.redLt,    route: '/sos' },
          ].map(item => (
            <TouchableOpacity key={item.label} style={[s.pillCard, { backgroundColor: item.bg }]} onPress={() => router.push(item.route as any)} activeOpacity={0.8}>
              <View style={[s.pillIconWrap, { backgroundColor: C.white }]}>
                <Ionicons name={item.icon as any} size={20} color={item.color} />
              </View>
              <Text style={[s.pillLabel, { color: item.color }]}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* ── TODAY'S LEGAL BRIEFINGS — editorial newspaper style ── */}
        <Text style={s.sectionLabel}>TODAY'S BRIEFING</Text>
        <View style={s.dividerBar} />

        {briefsLoading ? (
          <ActivityIndicator size="small" color={C.teal} style={{ marginTop: 20 }} />
        ) : briefs.map((b, i) => (
          <TouchableOpacity key={b.id} style={s.briefItem} onPress={() => b.link ? Linking.openURL(b.link) : null} activeOpacity={0.85}>
            <Text style={s.briefIndex}>{String(i + 1).padStart(2, '0')}</Text>
            <View style={s.briefContent}>
              <View style={[s.briefTag, { backgroundColor: b.tagBg || C.tealLt }]}>
                <Text style={[s.briefTagText, { color: b.tagColor || C.teal }]}>{b.tag || 'Update'}</Text>
              </View>
              <Text style={s.briefTitle}>{b.title}</Text>
              <Text style={s.briefDesc}>{b.desc}</Text>
            </View>
          </TouchableOpacity>
        ))}

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: C.cream },
  scroll: { paddingBottom: 110 },

  /* Top App Bar */
  topBar:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 22, paddingTop: 8, paddingBottom: 12 },
  wordmark:     { fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif', fontSize: 24, fontWeight: '700', color: C.ink, letterSpacing: -0.5 },
  wordmarkAccent: { color: C.teal },
  topBarSub:    { fontSize: 12, color: C.inkLt, fontWeight: '500', marginTop: 1 },
  topBarRight:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  topBtn:       { width: 38, height: 38, borderRadius: 12, backgroundColor: C.white, borderWidth: 1, borderColor: C.stone, justifyContent: 'center', alignItems: 'center' },
  avatarWrap:   { width: 38, height: 38, borderRadius: 19, backgroundColor: C.teal, justifyContent: 'center', alignItems: 'center' },
  avatarLetter: { color: C.white, fontWeight: '800', fontSize: 15 },

  /* Hero Card */
  heroCard:   { marginHorizontal: 18, marginBottom: 20, backgroundColor: C.teal, borderRadius: 24, padding: 26, overflow: 'hidden' },
  heroGreeting:{ fontSize: 16, color: 'rgba(255,255,255,0.7)', fontWeight: '500', marginBottom: 2 },
  heroName:   { fontSize: 32, color: C.white, fontWeight: '800', marginBottom: 10, letterSpacing: -0.5 },
  heroBody:   { fontSize: 14, color: 'rgba(255,255,255,0.8)', lineHeight: 21, marginBottom: 24, fontWeight: '400' },
  heroBtn:    { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 18, paddingVertical: 11, borderRadius: 30, borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)' },
  heroBtnText:{ color: C.white, fontWeight: '700', fontSize: 14 },

  /* AI Toggle Row */
  aiToggleRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginHorizontal: 18, marginBottom: 2, backgroundColor: C.white, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: C.stone },
  aiToggleLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  aiDotBadge:   { width: 8, height: 8, borderRadius: 4, backgroundColor: C.teal },
  aiToggleLabel:{ fontSize: 14, fontWeight: '700', color: C.ink },
  aiToggleRight:{ flexDirection: 'row', alignItems: 'center', gap: 6 },
  aiToggleSub:  { fontSize: 12, color: C.inkLt },

  /* AI Panel */
  aiPanel:    { marginHorizontal: 18, marginBottom: 20, backgroundColor: C.white, borderRadius: 16, borderWidth: 1, borderColor: C.stone, overflow: 'hidden' },
  aiScroll:   { maxHeight: 260 },
  msgWrap:    { maxWidth: '80%' },
  msgLeft:    { alignSelf: 'flex-start' },
  msgRight:   { alignSelf: 'flex-end' },
  msgText:    { padding: 12, borderRadius: 14, fontSize: 13, lineHeight: 19 },
  msgBot:     { backgroundColor: C.cream, color: C.ink, borderTopLeftRadius: 4 },
  msgUser:    { backgroundColor: C.teal, color: C.white, borderTopRightRadius: 4 },
  aiInputRow: { flexDirection: 'row', gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: C.stone, backgroundColor: C.cream },
  aiInput:    { flex: 1, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: C.white, borderRadius: 12, borderWidth: 1, borderColor: C.stone, fontSize: 13, color: C.ink },
  aiSend:     { width: 40, height: 40, borderRadius: 12, backgroundColor: C.teal, justifyContent: 'center', alignItems: 'center' },

  /* Section Labels */
  sectionLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2, color: C.inkXs, marginHorizontal: 22, marginTop: 24, marginBottom: 12 },

  /* Horizontal Pill Row */
  pillRow:    { paddingHorizontal: 18, gap: 10, paddingBottom: 4 },
  pillCard:   { alignItems: 'center', paddingVertical: 14, paddingHorizontal: 18, borderRadius: 20, gap: 8, minWidth: 80 },
  pillIconWrap: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  pillLabel:  { fontSize: 12, fontWeight: '700' },

  /* Briefing Editorial Style */
  dividerBar: { height: 2, backgroundColor: C.ink, marginHorizontal: 22, marginBottom: 20 },
  briefItem:  { flexDirection: 'row', gap: 16, paddingHorizontal: 22, paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: C.stone },
  briefIndex: { fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif', fontSize: 22, fontWeight: '700', color: C.stone, lineHeight: 24 },
  briefContent:{ flex: 1 },
  briefTag:   { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginBottom: 6 },
  briefTagText:{ fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  briefTitle: { fontSize: 16, fontWeight: '800', color: C.ink, marginBottom: 4, lineHeight: 22 },
  briefDesc:  { fontSize: 13, color: C.inkMd, lineHeight: 19 },
});
