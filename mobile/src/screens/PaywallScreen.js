import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StatusBar,
  StyleSheet,
  SafeAreaView,
  Linking,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { MaterialIcons } from '@expo/vector-icons';
import { useApp } from '../contexts/AppContext';
import {
  purchasePremium,
  restorePurchases,
  getAvailablePackages,
  getPurchasesDiagnostics,
} from '../services/purchases';
import { getPaywallVariant, logPaywallEvent } from '../config/paywallVariants';
import { track } from '../services/analytics';
import { useAuth } from '../contexts/AuthContext';
import { LT } from '../config/lightTheme';
import { LEGAL } from '../config/constants';

export default function PaywallScreen({ navigation }) {
  const { t } = useTranslation();
  const { setPremium } = useApp();
  const { user } = useAuth();
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [selected, setSelected] = useState('yearly');
  const [packages, setPackages] = useState({ monthly: null, yearly: null });
  const [loadingPackages, setLoadingPackages] = useState(true);
  const [variant, setVariant] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const pkgs = await getAvailablePackages();
        if (pkgs) setPackages(pkgs);
      } finally {
        setLoadingPackages(false);
      }
      try {
        const v = await getPaywallVariant();
        setVariant(v);
        logPaywallEvent(v.id, 'view');
        // Funnel event — paywall impression. Compared against `lesson_completed`
        // this tells us if users are seeing it at all (paywall trigger working),
        // and compared against actual subscriptions this gives conversion rate.
        track({
          event: 'paywall_shown',
          userId: user?.id,
          props: { variant: v?.id || null },
        });
      } catch {
        setVariant({ id: 'A' });
      }
    })();
    // user.id may not be ready on first render; we fire once on mount
    // intentionally — paywall impressions shouldn't multi-count.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const monthlyPrice = packages.monthly?.product?.priceString || '₺149,99';
  const yearlyPrice = packages.yearly?.product?.priceString || '₺999,99';
  const yearlyPerMonth = packages.yearly?.product?.price
    ? `₺${(packages.yearly.product.price / 12).toFixed(2)}`
    : '₺83,33';

  const handleSubscribe = async () => {
    if (!packages.monthly && !packages.yearly) {
      Alert.alert(
        t('paywall.notReadyTitle', 'Abonelikler hazır değil'),
        t(
          'paywall.notReadyBody',
          'App Store bağlantısı kurulamadı. İnternetini kontrol et veya birkaç dakika sonra tekrar dene.',
        ),
      );
      return;
    }
    logPaywallEvent(variant?.id || 'A', selected === 'yearly' ? 'select_yearly' : 'select_monthly');
    setIsSubscribing(true);
    try {
      const success = await purchasePremium(selected);
      if (success) {
        logPaywallEvent(variant?.id || 'A', 'purchase', { period: selected });
        setPremium(true);
        navigation.goBack();
      }
    } catch (e) {
      const msg = e?.message || '';
      let body = t('common.tryAgain');
      if (/no packages|offerings|not configured/i.test(msg)) {
        body = t(
          'paywall.notConfigured',
          'Abonelik henüz mağazada görünür değil. Lütfen birkaç dakika sonra tekrar dene.',
        );
      } else if (/network|connection|timeout/i.test(msg)) {
        body = t('paywall.networkError', 'Bağlantı hatası. İnterneti kontrol et.');
      } else if (msg) {
        body = msg;
      }
      Alert.alert(t('common.error'), body);
    } finally {
      setIsSubscribing(false);
    }
  };

  const handleRestore = async () => {
    setIsRestoring(true);
    try {
      const success = await restorePurchases();
      if (success) {
        setPremium(true);
        navigation.goBack();
      }
    } catch (e) {
      Alert.alert(t('common.error'), e?.message || t('common.tryAgain'));
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      {/* Background glow */}
      <View style={styles.bgGlow} pointerEvents="none" />

      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.closeBtn}
        >
          <MaterialIcons name="close" size={22} color={LT.onSurface} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero — variant-aware */}
        <View style={styles.hero}>
          <Text style={styles.heroEmoji}>{variant?.heroEmoji || '🔥'}</Text>
          <Text style={styles.heroTitle}>
            {t(variant?.headline || 'paywall.title', 'TAM MONK MODE').toUpperCase()}
          </Text>
          <Text style={styles.heroSubtitle}>
            {t(
              variant?.subheadline || 'paywall.subtitle',
              'Bir aylık veya yıllık abonelik. 7 gün ücretsiz dene.',
            )}
          </Text>
          {variant?.showSocialProof ? (
            <View style={styles.socialProofPill}>
              <MaterialIcons name="people" size={14} color={LT.primary} />
              <Text style={styles.socialProofText}>
                {t('paywall.socialProof', '10.000+ disiplinli kullanıcı')}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Trust signals row */}
        <View style={styles.trustRow}>
          <View style={styles.trustItem}>
            <MaterialIcons name="lock" size={20} color={LT.onSurfaceVariant} />
            <Text style={styles.trustLabel}>
              {t('paywall.trustPrivate', 'GİZLİ')}
            </Text>
          </View>
          <View style={styles.trustItem}>
            <MaterialIcons name="history" size={20} color={LT.onSurfaceVariant} />
            <Text style={styles.trustLabel}>
              {t('paywall.trustCancel', 'İPTAL ET')}
            </Text>
          </View>
          <View style={styles.trustItem}>
            <MaterialIcons name="article" size={20} color={LT.onSurfaceVariant} />
            <Text style={styles.trustLabel}>
              {t('paywall.trustNoTrack', 'İZLEME YOK')}
            </Text>
          </View>
        </View>

        {/* Features */}
        <View style={styles.features}>
          <FeatureRow
            icon="block"
            iconColor={LT.primary}
            label={t('paywall.feature1', 'Sınırsız kalpler')}
          />
          <FeatureRow
            icon="workspace-premium"
            iconColor={LT.primaryContainer}
            label={t('paywall.feature2', 'Tüm yolların kilidi açık')}
          />
          <FeatureRow
            icon="block"
            iconColor={LT.primary}
            label={t('paywall.feature3', 'Reklamsız deneyim')}
          />
          <FeatureRow
            icon="sync"
            iconColor={LT.primaryContainer}
            label={t('paywall.feature4', 'Cihazlar arası senkron')}
          />
          <FeatureRow
            icon="auto-awesome"
            iconColor={LT.primary}
            label={t('paywall.feature5', 'Premium başarılar')}
          />
        </View>

        {/* Price cards */}
        {loadingPackages ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={LT.primaryContainer} />
            <Text style={styles.loadingText}>
              {t('paywall.loadingPrices', 'Fiyatlar yükleniyor...')}
            </Text>
          </View>
        ) : !packages.monthly && !packages.yearly ? (
          <View style={styles.errorBox}>
            <MaterialIcons name="warning" size={32} color={LT.primary} />
            <Text style={styles.errorTitle}>
              {t('paywall.notReadyTitle', 'Abonelikler yüklenemedi')}
            </Text>
            <Text style={styles.errorBody}>
              {t(
                'paywall.notReadyBodyShort',
                'Mağaza bağlantısı kurulamadı. Birkaç dakika sonra tekrar dene.',
              )}
            </Text>
            {(() => {
              const diag = getPurchasesDiagnostics();
              const detail = diag.lastOfferingsError || diag.lastInitError;
              if (!detail) return null;
              return (
                <Text style={styles.errorDetail} numberOfLines={2}>
                  {detail}
                </Text>
              );
            })()}
            <TouchableOpacity
              onPress={async () => {
                setLoadingPackages(true);
                try {
                  const pkgs = await getAvailablePackages();
                  if (pkgs) setPackages(pkgs);
                } finally {
                  setLoadingPackages(false);
                }
              }}
              style={styles.retryBtn}
            >
              <Text style={styles.retryText}>
                {t('common.tryAgain', 'Tekrar dene')}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.priceCards}>
            {/* Yearly */}
            <TouchableOpacity
              onPress={() => setSelected('yearly')}
              activeOpacity={0.85}
              style={[
                styles.priceCard,
                styles.priceCardYearly,
                selected === 'yearly' && styles.priceCardYearlyActive,
              ]}
            >
              <View style={styles.bestValueBadge}>
                <Text style={styles.bestValueText}>
                  {t(variant?.bestValueBadge || 'paywall.bestValue', 'EN İYİ FİYAT')}
                </Text>
              </View>
              <Text style={styles.pricePeriodYearly}>
                {t('paywall.yearly', 'YILLIK').toUpperCase()}
              </Text>
              <Text style={styles.priceAmountYearly}>{yearlyPrice}</Text>
              <Text style={styles.pricePerMonthYearly}>{yearlyPerMonth} / ay</Text>
            </TouchableOpacity>

            {/* Monthly */}
            <TouchableOpacity
              onPress={() => setSelected('monthly')}
              activeOpacity={0.85}
              style={[
                styles.priceCard,
                styles.priceCardMonthly,
                selected === 'monthly' && styles.priceCardMonthlyActive,
              ]}
            >
              <Text style={styles.pricePeriod}>
                {t('paywall.monthly', 'AYLIK').toUpperCase()}
              </Text>
              <Text style={styles.priceAmount}>{monthlyPrice}</Text>
              <Text style={styles.pricePerMonth}>
                {t('paywall.billedMonthly', 'Her ay faturalandırılır')}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* CTA */}
        <TouchableOpacity
          onPress={handleSubscribe}
          disabled={isSubscribing || isRestoring}
          activeOpacity={0.9}
          style={styles.ctaShadow}
        >
          <View
            style={[
              styles.ctaButton,
              (isSubscribing || isRestoring) && { opacity: 0.6 },
            ]}
          >
            {isSubscribing ? (
              <ActivityIndicator color={LT.onPrimary} />
            ) : (
              <Text style={styles.ctaText}>
                {t(variant?.ctaText || 'paywall.ctaTrial', '7 gün ücretsiz başla')}
              </Text>
            )}
          </View>
        </TouchableOpacity>

        {/* Footer */}
        <Text style={styles.footerNote}>
          {t(
            'paywall.autoRenew',
            'Abonelik otomatik olarak yenilenir. İstediğin zaman ayarlardan veya App Store hesabından iptal edebilirsin.',
          )}
        </Text>

        {/* Legal links — required by Apple Guideline 3.1.2 */}
        <View style={styles.legalRow}>
          <TouchableOpacity
            onPress={() => Linking.openURL(LEGAL.PRIVACY_URL).catch(() => {})}
            activeOpacity={0.7}
          >
            <Text style={styles.legalLink}>
              {t('paywall.privacyPolicy', 'Gizlilik Politikası')}
            </Text>
          </TouchableOpacity>
          <Text style={styles.legalSep}>·</Text>
          <TouchableOpacity
            onPress={() => Linking.openURL(LEGAL.TERMS_URL).catch(() => {})}
            activeOpacity={0.7}
          >
            <Text style={styles.legalLink}>
              {t('paywall.termsOfService', 'Kullanım Koşulları')}
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          onPress={handleRestore}
          disabled={isSubscribing || isRestoring}
          style={styles.restoreBtn}
        >
          {isRestoring ? (
            <ActivityIndicator color={LT.primary} size="small" />
          ) : (
            <Text style={styles.restoreText}>
              {t('settings.restorePurchases', 'Satın Alımları Geri Yükle')}
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function FeatureRow({ icon, iconColor, label }) {
  return (
    <View style={styles.featureRow}>
      <MaterialIcons name={icon} size={22} color={iconColor} />
      <Text style={styles.featureLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: LT.background },

  bgGlow: {
    position: 'absolute',
    bottom: -120,
    left: '50%',
    marginLeft: -200,
    width: 400,
    height: 240,
    borderRadius: 200,
    backgroundColor: 'rgba(227, 18, 18, 0.08)',
    opacity: 0.5,
  },

  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: LT.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },

  content: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    alignItems: 'center',
  },

  // Hero
  hero: {
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 24,
  },
  heroEmoji: {
    fontSize: 60,
    marginBottom: 12,
    textShadowColor: 'rgba(227, 18, 18, 0.25)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 15,
  },
  heroTitle: {
    color: LT.onSurface,
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -1,
    marginBottom: 6,
    textAlign: 'center',
  },
  heroSubtitle: {
    color: LT.onSurfaceVariant,
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
  socialProofPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(227, 18, 18, 0.08)',
    borderColor: 'rgba(232, 188, 182, 0.6)',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    marginTop: 12,
  },
  socialProofText: {
    color: LT.primary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
  },

  // Trust signals
  trustRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    maxWidth: 384,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: LT.outlineVariant,
    marginBottom: 24,
  },
  trustItem: {
    alignItems: 'center',
    gap: 4,
  },
  trustLabel: {
    color: LT.onSurfaceVariant,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
  },

  // Features
  features: {
    width: '100%',
    maxWidth: 420,
    gap: 12,
    marginBottom: 24,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: LT.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: 'rgba(232, 188, 182, 0.5)',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  featureLabel: {
    color: LT.onSurface,
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },

  // Loading / error
  loadingBox: {
    paddingVertical: 32,
    alignItems: 'center',
    gap: 12,
    width: '100%',
    maxWidth: 420,
  },
  loadingText: { color: LT.onSurfaceVariant, fontSize: 13 },

  errorBox: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: LT.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: LT.outlineVariant,
    borderRadius: 14,
    padding: 20,
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  errorTitle: {
    color: LT.onSurface,
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
  },
  errorBody: {
    color: LT.onSurfaceVariant,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 8,
  },
  errorDetail: {
    color: LT.onSurfaceVariant,
    fontSize: 11,
    textAlign: 'center',
    fontStyle: 'italic',
    opacity: 0.7,
    marginBottom: 8,
    paddingHorizontal: 8,
  },
  retryBtn: {
    backgroundColor: LT.primaryContainer,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryText: { color: LT.onPrimary, fontSize: 13, fontWeight: '800' },

  // Price cards
  priceCards: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    maxWidth: 420,
    marginBottom: 24,
  },
  priceCard: {
    flex: 1,
    borderRadius: 18,
    padding: 18,
    paddingTop: 22,
    alignItems: 'center',
    minHeight: 130,
  },
  // Yearly = solid red bg
  priceCardYearly: {
    backgroundColor: LT.primaryContainer,
    borderWidth: 2,
    borderColor: LT.primaryContainer,
    shadowColor: LT.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
  },
  priceCardYearlyActive: {
    borderColor: LT.primary,
    borderWidth: 3,
    shadowOpacity: 0.28,
  },
  // Monthly = white bg, thin black border
  priceCardMonthly: {
    backgroundColor: LT.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: LT.onSurface,
  },
  priceCardMonthlyActive: {
    borderColor: LT.primary,
    borderWidth: 3,
  },
  bestValueBadge: {
    position: 'absolute',
    top: -10,
    right: -6,
    backgroundColor: '#000000',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  bestValueText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  // Monthly text
  pricePeriod: {
    color: LT.onSurfaceVariant,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  priceAmount: {
    color: LT.onSurface,
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: -0.8,
  },
  pricePerMonth: {
    color: LT.onSurfaceVariant,
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
    textAlign: 'center',
  },
  // Yearly text (white on red)
  pricePeriodYearly: {
    color: LT.onPrimary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  priceAmountYearly: {
    color: LT.onPrimary,
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: -0.8,
  },
  pricePerMonthYearly: {
    color: LT.onPrimary,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
    textAlign: 'center',
    opacity: 0.9,
  },

  // CTA
  ctaShadow: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 18,
    shadowColor: LT.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.32,
    shadowRadius: 20,
    marginBottom: 16,
  },
  ctaButton: {
    height: 64,
    borderRadius: 18,
    backgroundColor: LT.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    color: LT.onPrimary,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.3,
  },

  footerNote: {
    color: LT.onSurfaceVariant,
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
    maxWidth: 320,
    marginBottom: 8,
  },
  legalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
    marginBottom: 4,
  },
  legalLink: {
    color: LT.primary,
    fontSize: 11,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  legalSep: {
    color: LT.outline,
    fontSize: 11,
    fontWeight: '700',
  },
  restoreBtn: {
    paddingVertical: 12,
  },
  restoreText: {
    color: LT.primary,
    fontSize: 12,
    fontWeight: '700',
    textDecorationLine: 'underline',
    textDecorationColor: 'rgba(183, 0, 6, 0.4)',
  },
});
