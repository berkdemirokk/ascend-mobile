// PathCertificateCard — landscape A4-style certificate rendered off-screen,
// captured via react-native-view-shot, then shared. Designed to look good on
// LinkedIn / Instagram Stories / WhatsApp.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const PathCertificateCard = React.forwardRef(function PathCertificateCard(
  {
    pathTitle = '',
    completedDate = '',
    userName = '',
    lessonsCount = 50,
    daysCount = 0,
    title = 'Disiplin Sertifikası',
    subtitle = 'Yolu tamamladı',
    lessonsLabel = 'DERS',
    daysLabel = 'GÜN',
    appLabel = 'ASCEND',
  },
  ref,
) {
  return (
    <View ref={ref} collapsable={false} style={styles.card}>
      <LinearGradient
        colors={['#FFFFFF', '#F8F4F2']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.bg}
      >
        {/* Decorative border */}
        <View style={styles.borderOuter} />
        <View style={styles.borderInner} />

        {/* Top brand */}
        <View style={styles.topRow}>
          <View style={styles.brandDot} />
          <Text style={styles.brand}>{appLabel}</Text>
          <View style={styles.brandDot} />
        </View>

        {/* Certificate title */}
        <Text style={styles.certTitle}>{title}</Text>
        <View style={styles.divider} />
        <Text style={styles.subtitleText}>{subtitle}</Text>

        {/* User name */}
        <Text style={styles.userName} numberOfLines={1}>
          {userName || 'Disiplinci'}
        </Text>

        <Text style={styles.pathLabel}>{pathTitle}</Text>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{lessonsCount}</Text>
            <Text style={styles.statLabel}>{lessonsLabel}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{daysCount}</Text>
            <Text style={styles.statLabel}>{daysLabel}</Text>
          </View>
        </View>

        {/* Footer with date */}
        <View style={styles.footer}>
          <Text style={styles.footerDate}>{completedDate}</Text>
          <Text style={styles.footerSig}>ascend.app</Text>
        </View>
      </LinearGradient>
    </View>
  );
});

export default PathCertificateCard;

const CARD_W = 720;
const CARD_H = 480;
const RED = '#E31212';
const SILVER = '#B0B0B0';

const styles = StyleSheet.create({
  card: {
    width: CARD_W,
    height: CARD_H,
    overflow: 'hidden',
    borderRadius: 12,
  },
  bg: {
    flex: 1,
    paddingHorizontal: 56,
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  borderOuter: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    bottom: 16,
    borderWidth: 2,
    borderColor: RED,
    borderRadius: 6,
  },
  borderInner: {
    position: 'absolute',
    top: 22,
    left: 22,
    right: 22,
    bottom: 22,
    borderWidth: 0.5,
    borderColor: SILVER,
    borderRadius: 4,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 8,
  },
  brandDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: RED,
  },
  brand: {
    color: '#1A1A1A',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 8,
  },
  certTitle: {
    color: '#1A1A1A',
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: 0,
    textAlign: 'center',
    marginTop: 6,
  },
  divider: {
    width: 80,
    height: 2,
    backgroundColor: RED,
    marginVertical: 10,
  },
  subtitleText: {
    color: '#666',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  userName: {
    color: RED,
    fontSize: 42,
    fontWeight: '900',
    letterSpacing: 0,
    marginTop: 14,
    textAlign: 'center',
  },
  pathLabel: {
    color: '#1A1A1A',
    fontSize: 18,
    fontWeight: '700',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 30,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 36,
    marginTop: 8,
  },
  statBox: { alignItems: 'center' },
  statValue: {
    color: '#1A1A1A',
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 0,
  },
  statLabel: {
    color: '#666',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 36,
    backgroundColor: SILVER,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 8,
    marginTop: 8,
  },
  footerDate: {
    color: '#888',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  footerSig: {
    color: '#888',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
});
