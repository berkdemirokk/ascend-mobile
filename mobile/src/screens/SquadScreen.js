// SquadScreen — Squad MVP UI.
//
// Three states:
//   1. Offline / no auth → Empty card asking user to sign in.
//   2. No squad yet     → Create or Join CTAs.
//   3. In a squad       → Collective streak + member list + share + leave.
//
// The collective-streak number is the WHOLE POINT of squads. It sits in
// a hero card at the top, identical visual rhythm to the user's personal
// streak elsewhere — so it FEELS like "the streak that counts now".
//
// Privacy stance: no real names ever surface. Members are shown by
// anon_display_name (auto-generated "Silent Monk #3742" style). No
// messaging, no comparison, no shaming. Just shared accountability.
//
// Loss-aversion: when today is missing from any member, the chain
// breaks at midnight unless every member completes a lesson. That's
// the entire mechanic.
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  Alert,
  Share,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { MaterialIcons } from '@expo/vector-icons';

import { useApp } from '../contexts/AppContext';
import { useAuth } from '../contexts/AuthContext';
import { LT, LT_RADIUS } from '../config/lightTheme';
import {
  createSquad,
  joinSquadByCode,
  getMySquad,
  leaveSquad,
  computeCollectiveStreak,
} from '../services/squad';

const todayStr = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
};

export default function SquadScreen({ navigation }) {
  const { t } = useTranslation();
  const { user, isAuthenticated } = useAuth();
  const { anonUsername, setCurrentSquad } = useApp();
  const userId = user?.id || null;

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [squadData, setSquadData] = useState(null); // { squad, members, progressByDate }

  // Local UI state for the create / join forms.
  const [createName, setCreateName] = useState('');
  const [joinCode, setJoinCode] = useState('');

  // ── Load on mount ────────────────────────────────────────────────
  const reload = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await getMySquad(userId);
      setSquadData(data);
      // Mirror current squad to AppContext so the lesson-complete
      // side-effect knows where to post progress.
      if (setCurrentSquad) {
        setCurrentSquad(data?.squad || null);
      }
    } catch (e) {
      console.warn('[SquadScreen] load failed:', e?.message);
    } finally {
      setLoading(false);
    }
  }, [userId, setCurrentSquad]);

  useEffect(() => {
    reload();
  }, [reload]);

  // ── Create flow ──────────────────────────────────────────────────
  const handleCreate = async () => {
    if (busy) return;
    const name = createName.trim();
    if (name.length < 2) {
      Alert.alert(
        t('squad.errorTitle', 'Hata'),
        t('squad.errorNameTooShort', 'Halka adı en az 2 karakter olmalı.'),
      );
      return;
    }
    setBusy(true);
    try {
      const result = await createSquad({
        name,
        ownerUserId: userId,
        anonDisplayName: anonUsername || 'monk',
      });
      if (result?.error) {
        Alert.alert(
          t('squad.errorTitle', 'Hata'),
          mapErr(t, result.error),
        );
        return;
      }
      setCreateName('');
      await reload();
    } finally {
      setBusy(false);
    }
  };

  // ── Join flow ────────────────────────────────────────────────────
  const handleJoin = async () => {
    if (busy) return;
    const code = joinCode.trim().toUpperCase();
    if (!code || code.length < 4) {
      Alert.alert(
        t('squad.errorTitle', 'Hata'),
        t('squad.errorInvalidCode', 'Geçerli bir kod gir (örn. SQD-AB12).'),
      );
      return;
    }
    setBusy(true);
    try {
      const result = await joinSquadByCode({
        code,
        userId,
        anonDisplayName: anonUsername || 'monk',
      });
      if (result?.error) {
        Alert.alert(
          t('squad.errorTitle', 'Hata'),
          mapErr(t, result.error),
        );
        return;
      }
      if (result.alreadyMember) {
        Alert.alert(
          t('squad.alreadyMemberTitle', 'Zaten üyesin'),
          t(
            'squad.alreadyMemberBody',
            'Bu halkanın zaten üyesisin. Tekrar katılmaya gerek yok.',
          ),
        );
      }
      setJoinCode('');
      await reload();
    } finally {
      setBusy(false);
    }
  };

  // ── Share invite ─────────────────────────────────────────────────
  const handleShare = async () => {
    if (!squadData?.squad) return;
    const code = squadData.squad.code;
    const message = t(
      'squad.shareMessage',
      'Ascend halkam "{{name}}" — birlikte disiplin tutalım. Kodum: {{code}}',
      { name: squadData.squad.name, code },
    );
    try {
      await Share.share({ message });
    } catch {
      // user dismissed or share unavailable
    }
  };

  // ── Leave flow ───────────────────────────────────────────────────
  const handleLeave = () => {
    if (!squadData?.squad) return;
    Alert.alert(
      t('squad.leaveTitle', 'Halkadan ayrıl?'),
      t(
        'squad.leaveBody',
        'Halkadan ayrılırsan kollektif streak\'iniz senin için sıfırlanır. Tekrar katılmak için yeni bir kod gerekir.',
      ),
      [
        { text: t('common.cancel', 'İptal'), style: 'cancel' },
        {
          text: t('squad.leaveConfirm', 'Ayrıl'),
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await leaveSquad({
                squadId: squadData.squad.id,
                userId,
              });
              if (setCurrentSquad) setCurrentSquad(null);
              setSquadData(null);
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  // ── Derived ──────────────────────────────────────────────────────
  const collectiveStreak = useMemo(() => {
    if (!squadData) return 0;
    return computeCollectiveStreak(
      squadData.members || [],
      squadData.progressByDate || {},
    );
  }, [squadData]);

  // 14-day chain — newest on the right. Each cell green if every
  // member of the squad did >=1 lesson that day, gray otherwise.
  const chain = useMemo(() => {
    if (!squadData?.members?.length) return [];
    const memberIds = squadData.members.map((m) => m.user_id);
    const map = squadData.progressByDate || {};
    const cells = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const ds = d.toISOString().slice(0, 10);
      const day = map[ds] || {};
      const everyone = memberIds.every((id) => (day[id] || 0) >= 1);
      const me = (day[userId] || 0) >= 1;
      cells.push({ date: ds, everyone, me, isToday: i === 0 });
    }
    return cells;
  }, [squadData, userId]);

  const todayMembersDone = useMemo(() => {
    if (!squadData?.members?.length) return { done: 0, total: 0 };
    const today = todayStr();
    const day = squadData.progressByDate?.[today] || {};
    let done = 0;
    for (const m of squadData.members) {
      if ((day[m.user_id] || 0) >= 1) done += 1;
    }
    return { done, total: squadData.members.length };
  }, [squadData]);

  // ── Render ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="dark-content" />
        <Header navigation={navigation} t={t} />
        <View style={styles.center}>
          <ActivityIndicator color={LT.primaryContainer} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (!isAuthenticated || !userId) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="dark-content" />
        <Header navigation={navigation} t={t} />
        <View style={styles.center}>
          <MaterialIcons name="lock" size={48} color={LT.onSurfaceVariant} />
          <Text style={styles.lockTitle}>
            {t('squad.authRequiredTitle', 'Giriş gerekli')}
          </Text>
          <Text style={styles.lockBody}>
            {t(
              'squad.authRequiredBody',
              'Halka kurmak için hesabın olmalı. Önce giriş yap.',
            )}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Has squad → main view
  if (squadData?.squad) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="dark-content" />
        <Header navigation={navigation} t={t} />
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero — collective streak */}
          <View style={styles.heroCard}>
            <Text style={styles.heroLabel}>
              {t('squad.collectiveStreak', 'KOLLEKTİF STREAK')}
            </Text>
            <Text style={styles.heroNumber}>{collectiveStreak}</Text>
            <Text style={styles.heroDays}>
              {collectiveStreak === 1
                ? t('squad.day', 'gün')
                : t('squad.days', 'gün')}
            </Text>
            <Text style={styles.heroName}>{squadData.squad.name}</Text>
            <View style={styles.codePill}>
              <MaterialIcons name="vpn-key" size={14} color={LT.onPrimary} />
              <Text style={styles.codePillText}>{squadData.squad.code}</Text>
            </View>
          </View>

          {/* 14-day chain */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              {t('squad.last14Days', 'SON 14 GÜN')}
            </Text>
            <View style={styles.chainRow}>
              {chain.map((c, idx) => (
                <View
                  key={c.date}
                  style={[
                    styles.chainCell,
                    c.everyone && styles.chainCellAll,
                    !c.everyone && c.me && styles.chainCellMe,
                    c.isToday && styles.chainCellToday,
                  ]}
                >
                  {c.everyone && (
                    <MaterialIcons
                      name="check"
                      size={12}
                      color={LT.onPrimary}
                    />
                  )}
                </View>
              ))}
            </View>
            <Text style={styles.chainLegend}>
              {t(
                'squad.chainLegend',
                'Yeşil: herkes ders yapmış. Soluk: senin günün, başkaları eksik.',
              )}
            </Text>
          </View>

          {/* Today status */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('squad.today', 'BUGÜN')}</Text>
            <View style={styles.todayRow}>
              <Text style={styles.todayBig}>
                {todayMembersDone.done}/{todayMembersDone.total}
              </Text>
              <View style={{ flex: 1, marginLeft: 16 }}>
                <Text style={styles.todayLabel}>
                  {todayMembersDone.done === todayMembersDone.total
                    ? t('squad.todayAllDone', 'Halkadaki herkes bugün ders yaptı 🔥')
                    : t(
                        'squad.todayMissing',
                        'Halkadaki {{n}} kişi bugün henüz ders yapmadı',
                        { n: todayMembersDone.total - todayMembersDone.done },
                      )}
                </Text>
              </View>
            </View>
          </View>

          {/* Members */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              {t('squad.members', 'ÜYELER')} · {squadData.members.length}/5
            </Text>
            {squadData.members.map((m, idx) => {
              const today = todayStr();
              const doneToday =
                (squadData.progressByDate?.[today]?.[m.user_id] || 0) >= 1;
              const isMe = m.user_id === userId;
              return (
                <View
                  key={m.user_id}
                  style={[
                    styles.memberRow,
                    idx < squadData.members.length - 1 && styles.memberRowBorder,
                  ]}
                >
                  <View style={styles.memberAvatar}>
                    <MaterialIcons
                      name="self-improvement"
                      size={18}
                      color={LT.primaryContainer}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.memberName}>
                      {m.anon_display_name || 'monk'}
                      {isMe ? ` · ${t('squad.you', 'sen')}` : ''}
                    </Text>
                    <Text style={styles.memberSub}>
                      {doneToday
                        ? t('squad.memberDoneToday', 'Bugün hazır')
                        : t('squad.memberPending', 'Bugün eksik')}
                    </Text>
                  </View>
                  <MaterialIcons
                    name={doneToday ? 'check-circle' : 'radio-button-unchecked'}
                    size={22}
                    color={doneToday ? LT.success : LT.outline}
                  />
                </View>
              );
            })}
          </View>

          {/* Actions */}
          <TouchableOpacity
            onPress={handleShare}
            activeOpacity={0.7}
            style={styles.primaryBtn}
          >
            <MaterialIcons name="share" size={20} color={LT.onPrimary} />
            <Text style={styles.primaryBtnText}>
              {t('squad.invite', 'Arkadaş davet et')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleLeave}
            activeOpacity={0.7}
            style={styles.dangerBtn}
            disabled={busy}
          >
            <Text style={styles.dangerBtnText}>
              {t('squad.leave', 'Halkadan ayrıl')}
            </Text>
          </TouchableOpacity>

          <View style={{ height: 32 }} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // No squad → create / join
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />
      <Header navigation={navigation} t={t} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Intro */}
        <View style={styles.introCard}>
          <MaterialIcons
            name="groups"
            size={42}
            color={LT.primaryContainer}
          />
          <Text style={styles.introTitle}>
            {t('squad.introTitle', 'Halka — 2-5 kişilik sessiz disiplin grubu')}
          </Text>
          <Text style={styles.introBody}>
            {t(
              'squad.introBody',
              'Hiç leaderboard, hiç sohbet yok. Sadece "halkadaki herkes bugün ders yaptı mı?" — tek soru, tek streak. Birisi atlarsa zincir kırılır. Kimseyle yarışmazsın; birlikte yürürsün.',
            )}
          </Text>
        </View>

        {/* Create */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {t('squad.createTitle', 'YENİ HALKA KUR')}
          </Text>
          <TextInput
            value={createName}
            onChangeText={setCreateName}
            placeholder={t(
              'squad.namePlaceholder',
              'Halka adı (örn. "Sabah Brigadi")',
            )}
            placeholderTextColor={LT.onSurfaceVariant}
            maxLength={40}
            style={styles.input}
            editable={!busy}
          />
          <TouchableOpacity
            onPress={handleCreate}
            disabled={busy}
            activeOpacity={0.7}
            style={[styles.primaryBtn, busy && styles.btnDisabled]}
          >
            {busy ? (
              <ActivityIndicator color={LT.onPrimary} />
            ) : (
              <>
                <MaterialIcons name="add" size={20} color={LT.onPrimary} />
                <Text style={styles.primaryBtnText}>
                  {t('squad.createBtn', 'Halka oluştur')}
                </Text>
              </>
            )}
          </TouchableOpacity>
          <Text style={styles.helpText}>
            {t(
              'squad.createHelp',
              'Oluşturduktan sonra paylaşacağın 6 karakterlik kod ile 4 arkadaşını davet edebilirsin.',
            )}
          </Text>
        </View>

        {/* Join */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {t('squad.joinTitle', 'BİR HALKAYA KATIL')}
          </Text>
          <TextInput
            value={joinCode}
            onChangeText={(v) => setJoinCode(v.toUpperCase())}
            placeholder="SQD-AB12"
            placeholderTextColor={LT.onSurfaceVariant}
            maxLength={10}
            autoCapitalize="characters"
            autoCorrect={false}
            style={[styles.input, styles.codeInput]}
            editable={!busy}
          />
          <TouchableOpacity
            onPress={handleJoin}
            disabled={busy}
            activeOpacity={0.7}
            style={[styles.secondaryBtn, busy && styles.btnDisabled]}
          >
            {busy ? (
              <ActivityIndicator color={LT.primary} />
            ) : (
              <>
                <MaterialIcons
                  name="login"
                  size={20}
                  color={LT.primary}
                />
                <Text style={styles.secondaryBtnText}>
                  {t('squad.joinBtn', 'Katıl')}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────

function Header({ navigation, t }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity
        onPress={() => navigation.goBack()}
        style={styles.headerBack}
      >
        <MaterialIcons
          name="arrow-back"
          size={22}
          color={LT.onSurfaceVariant}
        />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>
        {t('squad.title', 'Halka')}
      </Text>
      <View style={{ width: 36 }} />
    </View>
  );
}

// ─── Error mapping ───────────────────────────────────────────────────
// Maps service-layer error tokens to localized user strings.
function mapErr(t, code) {
  switch (code) {
    case 'offline':
      return t('squad.errOffline', 'İnternet yok. Sonra tekrar dene.');
    case 'auth_required':
      return t('squad.errAuth', 'Önce giriş yapmalısın.');
    case 'name_too_short':
      return t('squad.errNameShort', 'Halka adı en az 2 karakter olmalı.');
    case 'invalid':
      return t('squad.errInvalidCode', 'Geçersiz kod.');
    case 'not_found':
      return t('squad.errNotFound', 'Bu kodla bir halka bulunamadı.');
    case 'full':
      return t('squad.errFull', 'Bu halka dolu (5 kişi limit).');
    case 'code_collision':
      return t(
        'squad.errCollision',
        'Sistem yoğun, bir saniye sonra tekrar dene.',
      );
    default:
      return t('squad.errGeneric', 'Bir şeyler ters gitti. Tekrar dene.');
  }
}

// ─── Styles ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: LT.background },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: LT.surfaceContainer,
    borderBottomWidth: 1,
    borderBottomColor: LT.outlineVariant,
  },
  headerBack: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    color: LT.onSurface,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.4,
    marginLeft: 4,
  },

  scroll: { padding: 20 },

  // Hero card with collective streak
  heroCard: {
    backgroundColor: LT.primary,
    borderRadius: LT_RADIUS.xl,
    padding: 28,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 6,
  },
  heroLabel: {
    color: LT.onPrimaryContainer,
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: '700',
    opacity: 0.85,
    marginBottom: 4,
  },
  heroNumber: {
    color: LT.onPrimary,
    fontSize: 80,
    fontWeight: '900',
    letterSpacing: -2,
    lineHeight: 84,
  },
  heroDays: {
    color: LT.onPrimary,
    fontSize: 14,
    fontWeight: '600',
    opacity: 0.85,
    marginTop: -4,
  },
  heroName: {
    color: LT.onPrimary,
    fontSize: 18,
    fontWeight: '700',
    marginTop: 16,
  },
  codePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: LT_RADIUS.pill,
    marginTop: 12,
    gap: 6,
  },
  codePillText: {
    color: LT.onPrimary,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
  },

  // Generic card
  card: {
    backgroundColor: LT.surfaceContainerLowest,
    borderRadius: LT_RADIUS.xl,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: LT.outlineVariant,
  },
  cardTitle: {
    color: LT.onSurfaceVariant,
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: '700',
    marginBottom: 14,
  },

  // 14-day chain
  chainRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  chainCell: {
    width: 18,
    height: 18,
    borderRadius: 4,
    backgroundColor: LT.surfaceContainer,
    borderWidth: 1,
    borderColor: LT.outlineVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chainCellAll: {
    backgroundColor: LT.primaryContainer,
    borderColor: LT.primaryContainer,
  },
  chainCellMe: {
    // I did mine, group didn't — show a small filled dot so user
    // sees their own effort acknowledged even when chain breaks.
    backgroundColor: LT.outline,
    borderColor: LT.outline,
  },
  chainCellToday: {
    borderWidth: 2,
    borderColor: LT.primary,
  },
  chainLegend: {
    color: LT.onSurfaceVariant,
    fontSize: 11,
    lineHeight: 16,
  },

  // Today status
  todayRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  todayBig: {
    color: LT.primary,
    fontSize: 42,
    fontWeight: '900',
    letterSpacing: -1,
    minWidth: 80,
  },
  todayLabel: {
    color: LT.onSurface,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },

  // Members
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  memberRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: LT.outlineVariant,
  },
  memberAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: LT.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  memberName: {
    color: LT.onSurface,
    fontSize: 15,
    fontWeight: '700',
  },
  memberSub: {
    color: LT.onSurfaceVariant,
    fontSize: 12,
    marginTop: 2,
  },

  // Intro card (no-squad state)
  introCard: {
    backgroundColor: LT.surfaceContainerLowest,
    borderRadius: LT_RADIUS.xl,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: LT.outlineVariant,
  },
  introTitle: {
    color: LT.onSurface,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 12,
    letterSpacing: -0.3,
  },
  introBody: {
    color: LT.onSurfaceVariant,
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 8,
  },

  // Form
  input: {
    backgroundColor: LT.surfaceContainer,
    borderRadius: LT_RADIUS.lg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: LT.onSurface,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: LT.outlineVariant,
  },
  codeInput: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 2,
    textAlign: 'center',
  },

  // Buttons
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: LT.primary,
    borderRadius: LT_RADIUS.lg,
    paddingVertical: 14,
    marginTop: 4,
    gap: 8,
  },
  primaryBtnText: {
    color: LT.onPrimary,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: LT.surfaceContainerLowest,
    borderRadius: LT_RADIUS.lg,
    paddingVertical: 14,
    marginTop: 4,
    gap: 8,
    borderWidth: 1.5,
    borderColor: LT.primary,
  },
  secondaryBtnText: {
    color: LT.primary,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  dangerBtn: {
    alignItems: 'center',
    paddingVertical: 16,
    marginTop: 8,
  },
  dangerBtnText: {
    color: LT.error,
    fontSize: 14,
    fontWeight: '600',
  },
  btnDisabled: { opacity: 0.5 },
  helpText: {
    color: LT.onSurfaceVariant,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 10,
  },

  // Lock state
  lockTitle: {
    color: LT.onSurface,
    fontSize: 18,
    fontWeight: '700',
    marginTop: 16,
  },
  lockBody: {
    color: LT.onSurfaceVariant,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 21,
  },
});
