import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { MaterialIcons } from '@react-native-vector-icons/material-icons/static';
import { AccessibleTouchableOpacity as TouchableOpacity } from '../AccessibleControls';
import { LT } from '../../config/lightTheme';

function UpsellFeature({ icon, color, title }) {
  return (
    <View style={styles.upsellFeature}>
      <View style={[styles.upsellFeatureIcon, { backgroundColor: LT.surfaceContainerLow, borderColor: LT.outlineVariant }]}>
        <MaterialIcons name={icon} size={20} color={color} />
      </View>
      <Text style={styles.upsellFeatureText}>{title}</Text>
    </View>
  );
}

export default function UpsellStep({ t, onSubscribe }) {
  return (
    <ScrollView
      contentContainerStyle={styles.upsellContent}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.upsellEmoji}>🔥</Text>
      <Text style={styles.upsellTitle}>
        {t('onboarding.upsellTitle', 'İvmeni yarıda kesme')}
      </Text>

      <View style={styles.priceBlock}>
        <Text style={styles.priceAmount}>
          {t('onboarding.priceMonthly', '7 gün ücretsiz deneme')}
        </Text>
        <Text style={styles.priceTrial}>
          {t(
            'onboarding.priceTrial',
            'Net fiyat ve dönem App Store fiyatları yüklendiğinde gösterilir. Satın almadan önce onaylarsın.',
          )}
        </Text>
      </View>

      <View style={styles.upsellFeatures}>
        <UpsellFeature
          icon="favorite"
          color={LT.primary}
          title={t('onboarding.upsellF1', 'Sınırsız kalpler')}
        />
        <UpsellFeature
          icon="workspace-premium"
          color={LT.primaryContainer}
          title={t('onboarding.upsellF2', 'Tüm 5 yolun kilidi açık')}
        />
        <UpsellFeature
          icon="block"
          color={LT.tertiary}
          title={t('onboarding.upsellF3', 'Reklamsız deneyim')}
        />
        <UpsellFeature
          icon="auto-awesome"
          color={LT.primary}
          title={t('onboarding.upsellF4', 'Premium başarılar')}
        />
      </View>

      <TouchableOpacity
        onPress={onSubscribe}
        activeOpacity={0.9}
        style={styles.upsellCtaWrap}
      >
        <View style={styles.upsellCta}>
          <MaterialIcons name="auto-awesome" size={18} color={LT.onPrimary} />
          <Text style={styles.upsellCtaText}>
            {t('onboarding.upsellCta', 'Teklifi gör')}
          </Text>
        </View>
      </TouchableOpacity>

      <Text style={styles.upsellDisclaimer}>
        {t(
          'onboarding.upsellDisclaimer',
          'Satın alma başlamadan önce fiyat, dönem ve otomatik yenileme bilgisi aynı ekranda gösterilir.',
        )}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  upsellContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
    alignItems: 'center',
  },
  upsellEmoji: {
    fontSize: 56,
    marginBottom: 12,
    textShadowColor: 'rgba(183, 0, 6, 0.3)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 14,
  },
  upsellTitle: {
    color: LT.primary,
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 0,
    textAlign: 'center',
    marginBottom: 14,
  },
  priceBlock: {
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 12,
  },
  priceAmount: {
    color: LT.onSurface,
    fontSize: 38,
    fontWeight: '900',
    letterSpacing: 0,
    marginBottom: 6,
    textAlign: 'center',
  },
  priceTrial: {
    color: LT.onSurfaceVariant,
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 17,
  },
  upsellFeatures: {
    width: '100%',
    gap: 10,
    marginBottom: 24,
  },
  upsellFeature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: LT.surfaceContainerLowest,
    borderColor: LT.outlineVariant,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  upsellFeatureIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  upsellFeatureText: {
    color: LT.onSurface,
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  upsellCtaWrap: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: LT.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
    marginBottom: 12,
    backgroundColor: LT.primary,
  },
  upsellCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    backgroundColor: LT.primary,
  },
  upsellCtaText: {
    color: LT.onPrimary,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  upsellDisclaimer: {
    color: LT.onSurfaceVariant,
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
    paddingHorizontal: 12,
  },
});
