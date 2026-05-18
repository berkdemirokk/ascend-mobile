// FriendCodeScreen — anonymous discipline-partner pairing.
//
// Three rendered states:
//   1. Unpaired (no code yet): "Bir disiplin ortağı bul." → button generates
//      a 6-char code, then shows it large + share/copy CTAs. Also a
//      "...veya kod gir" input so the user can redeem someone else's code.
//   2. Unpaired (has pending code): shows the same generated-code view
//      restored on mount.
//   3. Paired: shows partner's anonUsername, partner's currentStreak (fire
//      emoji), and the SHARED streak (min of both — a partnership is only
//      as strong as the weaker side). Red secondary "Ortağı çöz" below.
//
// Brand constraints: stoic, anonymous. No "friend", only "disiplin ortağı".
// No real names. No chat. No comments. Just visibility of one partner.

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  StatusBar,
  ActivityIndicator,
  TextInput,
  Alert,
  Share,
  Keyboard,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { MaterialIcons } from '@expo/vector-icons';

import { useApp } from '../contexts/AppContext';
import {
  generateFriendCode,
  getMyPendingCode,
  normalizeFriendCode,
} from '../services/friendCodes';
import { hapticImpactLight, hapticSuccess } from '../services/haptics';
import { LT, LT_SPACING, LT_RADIUS } from '../config/lightTheme';

export default function FriendCodeScreen({ navigation }) {
  const { t } = useTranslation();
  const { friendPair, pairWithCode, unpairFriend, currentStreak } = useApp();

  // Mode toggle — when not paired, two columns of the same screen:
  //   • generated: the user's own code (visible after they tap "KOD OLUŞTUR")
  //   • redeem: an input + "EŞLEŞ" button to enter someone else's code
  const [myCode, setMyCode] = useState(null); // string or null
  const [generating, setGenerating] = useState(false);
  const [redeemInput, setRedeemInput] = useState('');
  const [redeemBusy, setRedeemBusy] = useState(false);
  const [redeemError, setRedeemError] = useState(null);
  const [hydrating, setHydrating] = useState(true);
  const inputRef = useRef(null);

  // On mount, hydrate any outstanding code the user already generated. This
  // makes the "show me my code" view sticky across app restarts.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pending = await getMyPendingCode();
        if (cancelled) return;
        if (pending?.code) setMyCode(pending.code);
      } catch {}
      if (!cancelled) setHydrating(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    hapticImpactLight();
    try {
      const code = await generateFriendCode();
      if (code) {
        setMyCode(code);
        hapticSuccess();
      } else {
        Alert.alert(
          t('common.error', 'Hata'),
          t('friendCode.generateFailed', 'Kod oluşturulamadı. Tekrar dene.'),
        );
      }
    } finally {
      setGenerating(false);
    }
  };

  // Share via the native sheet — works as both "copy" (the user picks
  // Copy from the share sheet) and "send to messaging app". Cleanest UX
  // without adding the expo-clipboard dep.
  const handleShare = async () => {
    if (!myCode) return;
    hapticImpactLight();
    try {
      const message = t(
        'friendCode.shareMessage',
        'Ascend Monk Mode disiplin ortağım ol. Kod: {{code}}\n\nUygulamayı aç → Profil → Disiplin Ortağı → Kod Gir.',
        { code: myCode },
      );
      await Share.share({ message, title: t('friendCode.title', 'Disiplin Ortağı') });
    } catch (e) {
      console.warn('[FriendCodeScreen] share failed:', e?.message);
    }
  };

  const handleRedeem = async () => {
    Keyboard.dismiss();
    const normalized = normalizeFriendCode(redeemInput);
    if (normalized.length !== 6) {
      setRedeemError(t('friendCode.errorInvalidLength', 'Kod 6 karakter olmalı.'));
      return;
    }
    setRedeemBusy(true);
    setRedeemError(null);
    hapticImpactLight();
    try {
      const result = await pairWithCode(normalized);
      if (result?.error) {
        // Map service error code → user-facing copy.
        const map = {
          self_pair: t('friendCode.errorSelfPair', 'Kendinle eşleşemezsin.'),
          already_paired: t('friendCode.errorAlreadyPaired', 'Zaten bir ortağın var ya da bu kodun sahibi başka birine bağlı.'),
          not_found: t('friendCode.errorNotFound', 'Kod bulunamadı veya süresi dolmuş.'),
          invalid_length: t('friendCode.errorInvalidLength', 'Kod 6 karakter olmalı.'),
          not_authenticated: t('friendCode.errorNotAuthenticated', 'Önce hesabına giriş yap.'),
          unknown: t('friendCode.errorUnknown', 'Bir sorun oluştu. Tekrar dene.'),
        };
        setRedeemError(map[result.error] || map.unknown);
      } else {
        hapticSuccess();
        setRedeemInput('');
        // Paired — screen rerenders into paired state automatically.
      }
    } finally {
      setRedeemBusy(false);
    }
  };

  const handleUnpair = () => {
    Alert.alert(
      t('friendCode.unpairConfirmTitle', 'Ortağı çöz'),
      t(
        'friendCode.unpairConfirm',
        'Disiplin ortağınla bağın kopacak. İkiniz de tekrar eşleşmek için yeni bir kod oluşturmalısınız.',
      ),
      [
        { text: t('common.cancel', 'İptal'), style: 'cancel' },
        {
          text: t('friendCode.unpairCta', 'Ortağı çöz'),
          style: 'destructive',
          onPress: async () => {
            await unpairFriend();
            hapticImpactLight();
          },
        },
      ],
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={LT.background} />

      {/* Top bar: back chevron + title */}
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          hitSlop={{ top: 12, left: 12, right: 12, bottom: 12 }}
        >
          <MaterialIcons name="arrow-back" size={22} color={LT.onSurface} />
        </TouchableOpacity>
        <Text style={styles.title}>{t('friendCode.title', 'Disiplin Ortağı')}</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {friendPair ? (
          <PairedView
            friendPair={friendPair}
            currentStreak={currentStreak}
            onUnpair={handleUnpair}
            t={t}
          />
        ) : hydrating ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={LT.primaryContainer} />
          </View>
        ) : (
          <UnpairedView
            myCode={myCode}
            generating={generating}
            onGenerate={handleGenerate}
            onShare={handleShare}
            redeemInput={redeemInput}
            setRedeemInput={(v) => {
              setRedeemError(null);
              setRedeemInput(normalizeFriendCode(v));
            }}
            redeemBusy={redeemBusy}
            redeemError={redeemError}
            onRedeem={handleRedeem}
            inputRef={inputRef}
            t={t}
          />
        )}

        <View style={{ height: 56 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Subcomponents ────────────────────────────────────────────────────────

function UnpairedView({
  myCode,
  generating,
  onGenerate,
  onShare,
  redeemInput,
  setRedeemInput,
  redeemBusy,
  redeemError,
  onRedeem,
  inputRef,
  t,
}) {
  return (
    <View>
      {/* ── Hook ──────────────────────────────────────────────────────── */}
      <View style={styles.headerBlock}>
        <View style={styles.headerPill}>
          <Text style={styles.headerPillText}>
            {t('friendCode.label', 'DİSİPLİN ORTAĞI')}
          </Text>
        </View>
        <Text style={styles.headerHook}>
          {t(
            'friendCode.hook',
            'Bir disiplin ortağı bul. Kod oluştur, paylaş.',
          )}
        </Text>
        <Text style={styles.headerSub}>
          {t(
            'friendCode.sub',
            'Konuşma yok, mesaj yok. Sadece birbirinizin streak’ini görürsünüz. Biri düşerse, diğeri anında bilir.',
          )}
        </Text>
      </View>

      {/* ── My code block ─────────────────────────────────────────────── */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>
          {t('friendCode.yourCodeLabel', 'KENDİ KODUN')}
        </Text>

        {myCode ? (
          <View style={styles.codeCard}>
            <Text style={styles.codeText} selectable>
              {formatCode(myCode)}
            </Text>
            <Text style={styles.codeValidFor}>
              {t('friendCode.codeValidFor', 'Kod 24 saat geçerli.')}
            </Text>
            <View style={styles.codeActions}>
              <TouchableOpacity
                style={styles.codeActionBtn}
                onPress={onShare}
                activeOpacity={0.85}
              >
                <MaterialIcons name="ios-share" size={16} color={LT.onPrimary} />
                <Text style={styles.codeActionBtnText}>
                  {t('friendCode.shareCta', 'PAYLAŞ')}
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.codeWaitingNote}>
              {t(
                'friendCode.pendingPair',
                'Ortağın kodu girene kadar bekleniyor...',
              )}
            </Text>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.generateBtn, generating && styles.btnDisabled]}
            onPress={onGenerate}
            disabled={generating}
            activeOpacity={0.85}
          >
            {generating ? (
              <ActivityIndicator color={LT.onPrimary} />
            ) : (
              <>
                <MaterialIcons name="vpn-key" size={18} color={LT.onPrimary} />
                <Text style={styles.generateBtnText}>
                  {t('friendCode.generateCta', 'KOD OLUŞTUR')}
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* ── Divider ───────────────────────────────────────────────────── */}
      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>
          {t('friendCode.orRedeem', 'ya da')}
        </Text>
        <View style={styles.dividerLine} />
      </View>

      {/* ── Redeem block ──────────────────────────────────────────────── */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>
          {t('friendCode.redeemLabel', 'KOD GİR')}
        </Text>
        <TextInput
          ref={inputRef}
          style={styles.codeInput}
          value={redeemInput}
          onChangeText={setRedeemInput}
          placeholder={t('friendCode.redeemPlaceholder', 'ABC234')}
          placeholderTextColor={LT.outline}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={6}
          returnKeyType="go"
          onSubmitEditing={onRedeem}
        />
        {redeemError ? (
          <Text style={styles.errorText}>{redeemError}</Text>
        ) : null}
        <TouchableOpacity
          style={[
            styles.redeemBtn,
            (redeemBusy || redeemInput.length !== 6) && styles.btnDisabled,
          ]}
          onPress={onRedeem}
          disabled={redeemBusy || redeemInput.length !== 6}
          activeOpacity={0.85}
        >
          {redeemBusy ? (
            <ActivityIndicator color={LT.onPrimary} />
          ) : (
            <Text style={styles.redeemBtnText}>
              {t('friendCode.redeemCta', 'EŞLEŞ')}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

function PairedView({ friendPair, currentStreak, onUnpair, t }) {
  // Shared streak = min of both, because a partnership is only as strong
  // as the weaker side. Loud number — the visual anchor of this screen.
  const shared = Math.min(currentStreak || 0, friendPair.partnerStreak || 0);

  return (
    <View>
      <View style={styles.headerBlock}>
        <View style={styles.pairedPill}>
          <Text style={styles.pairedPillText}>
            {t('friendCode.pairedLabel', 'EŞLEŞTİN')}
          </Text>
        </View>
        <Text style={styles.headerHook}>
          {t('friendCode.pairedTitle', 'Disiplin ortağın')}
        </Text>
      </View>

      {/* Partner card */}
      <View style={styles.partnerCard}>
        <Text style={styles.partnerName}>{friendPair.partnerName}</Text>
        <View style={styles.partnerStreakRow}>
          <Text style={styles.fireEmoji}>🔥</Text>
          <Text style={styles.partnerStreakNum}>
            {friendPair.partnerStreak || 0}
          </Text>
          <Text style={styles.partnerStreakLabel}>
            {t('friendCode.partnerStreakLabel', 'GÜN')}
          </Text>
        </View>
      </View>

      {/* Shared streak card */}
      <View style={styles.sharedCard}>
        <Text style={styles.sharedLabel}>
          {t('friendCode.sharedStreakLabel', 'ORTAK SERİ')}
        </Text>
        <View style={styles.sharedRow}>
          <Text style={styles.sharedNum}>{shared}</Text>
          <Text style={styles.sharedUnit}>
            {t('common.days', 'GÜN')}
          </Text>
        </View>
        <Text style={styles.sharedNote}>
          {t(
            'friendCode.sharedNote',
            'İkinizin de en düşük serisi. Daha düşük olan düşerse, ortak seri düşer.',
          )}
        </Text>
      </View>

      {/* Reminder of how it works */}
      <View style={styles.howCard}>
        <Text style={styles.howTitle}>
          {t('friendCode.howTitle', 'Nasıl çalışır')}
        </Text>
        <Text style={styles.howBody}>
          {t(
            'friendCode.howBody',
            'Konuşmazsın. Mesaj atmazsın. Sadece ortağının streak\'ini görürsün. Biri serini kırarsa, diğeri anında haber alır. Sen ayakta dur.',
          )}
        </Text>
      </View>

      {/* Destructive unpair */}
      <TouchableOpacity
        style={styles.unpairBtn}
        onPress={onUnpair}
        activeOpacity={0.85}
      >
        <Text style={styles.unpairBtnText}>
          {t('friendCode.unpairCta', 'Ortağı çöz')}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// Insert a space in the middle of the code so it reads as 3+3 — easier
// to dictate over voice + slightly easier to spot-check visually.
function formatCode(code) {
  if (!code || code.length !== 6) return code || '';
  return `${code.slice(0, 3)} ${code.slice(3)}`;
}

// ─── Styles ──────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: LT.background },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: LT_SPACING.containerMargin,
    paddingTop: 8,
    paddingBottom: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: LT.surfaceContainer,
  },
  title: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.3,
    color: LT.onSurface,
  },
  scrollContent: {
    paddingHorizontal: LT_SPACING.containerMargin,
    paddingTop: 16,
    paddingBottom: 24,
  },

  loadingBox: {
    paddingVertical: 64,
    alignItems: 'center',
  },

  // ── Header ─────────────────────────────────────────────────────────
  headerBlock: {
    alignItems: 'center',
    marginBottom: 28,
  },
  headerPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: LT_RADIUS.pill,
    backgroundColor: LT.primaryContainer,
    marginBottom: 12,
  },
  headerPillText: {
    color: LT.onPrimary,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2,
  },
  headerHook: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.3,
    color: LT.onSurface,
    marginBottom: 8,
    textAlign: 'center',
  },
  headerSub: {
    fontSize: 13,
    fontWeight: '500',
    color: LT.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 19,
    paddingHorizontal: 12,
  },

  // ── Section header ─────────────────────────────────────────────────
  section: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.6,
    color: LT.onSurfaceVariant,
    marginBottom: 10,
  },

  // ── Generate button ────────────────────────────────────────────────
  generateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 56,
    borderRadius: LT_RADIUS.lg,
    backgroundColor: LT.primaryContainer,
    shadowColor: LT.primaryContainer,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.32,
    shadowRadius: 12,
    elevation: 4,
  },
  generateBtnText: {
    color: LT.onPrimary,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1.6,
  },
  btnDisabled: {
    opacity: 0.55,
  },

  // ── My code card ───────────────────────────────────────────────────
  codeCard: {
    backgroundColor: LT.surfaceContainerLowest,
    borderRadius: LT_RADIUS.xl,
    borderWidth: 1.5,
    borderColor: LT.primaryContainer,
    paddingVertical: 24,
    paddingHorizontal: 18,
    alignItems: 'center',
    shadowColor: LT.primaryContainer,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 4,
  },
  codeText: {
    fontSize: 40,
    fontWeight: '900',
    letterSpacing: 6,
    color: LT.onSurface,
    fontVariant: ['tabular-nums'],
    marginBottom: 8,
  },
  codeValidFor: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: LT.onSurfaceVariant,
    marginBottom: 18,
  },
  codeActions: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  codeActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: LT_RADIUS.lg,
    backgroundColor: LT.primaryContainer,
  },
  codeActionBtnText: {
    color: LT.onPrimary,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  codeWaitingNote: {
    fontSize: 11,
    fontWeight: '600',
    color: LT.outline,
    fontStyle: 'italic',
    textAlign: 'center',
  },

  // ── Divider ────────────────────────────────────────────────────────
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: LT.outlineVariant,
  },
  dividerText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.6,
    color: LT.outline,
  },

  // ── Redeem input ───────────────────────────────────────────────────
  codeInput: {
    backgroundColor: LT.surfaceContainerLowest,
    borderRadius: LT_RADIUS.lg,
    borderWidth: 1.5,
    borderColor: LT.outlineVariant,
    paddingHorizontal: 18,
    paddingVertical: 16,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 6,
    color: LT.onSurface,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
    marginBottom: 10,
  },
  errorText: {
    fontSize: 12,
    fontWeight: '700',
    color: LT.primaryContainer,
    marginBottom: 10,
    textAlign: 'center',
  },
  redeemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    borderRadius: LT_RADIUS.lg,
    backgroundColor: LT.onSurface,
  },
  redeemBtnText: {
    color: LT.onPrimary,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1.6,
  },

  // ── Paired view ────────────────────────────────────────────────────
  pairedPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: LT_RADIUS.pill,
    backgroundColor: LT.onSurface,
    marginBottom: 12,
  },
  pairedPillText: {
    color: LT.onPrimary,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2,
  },

  partnerCard: {
    backgroundColor: LT.surfaceContainerLowest,
    borderRadius: LT_RADIUS.xl,
    borderWidth: 1,
    borderColor: LT.outlineVariant,
    paddingVertical: 22,
    paddingHorizontal: 18,
    alignItems: 'center',
    marginBottom: 14,
  },
  partnerName: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.3,
    color: LT.onSurface,
    marginBottom: 12,
  },
  partnerStreakRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  fireEmoji: { fontSize: 28 },
  partnerStreakNum: {
    fontSize: 48,
    fontWeight: '900',
    letterSpacing: -1.5,
    color: LT.primaryContainer,
    lineHeight: 50,
  },
  partnerStreakLabel: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2,
    color: LT.onSurfaceVariant,
  },

  sharedCard: {
    backgroundColor: LT.primaryContainer,
    borderRadius: LT_RADIUS.xl,
    paddingVertical: 22,
    paddingHorizontal: 18,
    alignItems: 'center',
    marginBottom: 14,
    shadowColor: LT.primaryContainer,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 6,
  },
  sharedLabel: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2,
    color: LT.onPrimary,
    opacity: 0.85,
    marginBottom: 4,
  },
  sharedRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginBottom: 8,
  },
  sharedNum: {
    fontSize: 56,
    fontWeight: '900',
    letterSpacing: -2,
    color: LT.onPrimary,
    lineHeight: 58,
  },
  sharedUnit: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 2,
    color: LT.onPrimary,
    opacity: 0.85,
  },
  sharedNote: {
    fontSize: 11,
    fontWeight: '600',
    color: LT.onPrimary,
    opacity: 0.85,
    textAlign: 'center',
    lineHeight: 16,
  },

  howCard: {
    backgroundColor: LT.surfaceContainer,
    borderRadius: LT_RADIUS.lg,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  howTitle: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.6,
    color: LT.onSurfaceVariant,
    marginBottom: 6,
  },
  howBody: {
    fontSize: 13,
    fontWeight: '500',
    color: LT.onSurface,
    lineHeight: 19,
  },

  unpairBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: LT_RADIUS.lg,
    borderWidth: 1.5,
    borderColor: LT.primaryContainer,
    backgroundColor: 'transparent',
  },
  unpairBtnText: {
    color: LT.primaryContainer,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
});
