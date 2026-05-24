import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Linking,
} from 'react-native';
import { LT } from '../config/lightTheme';
import { LEGAL } from '../config/constants';
import { logError } from '../services/analytics';
import i18n from '../i18n';

const RAPID_CRASH_WINDOW_MS = 60_000;
const RAPID_CRASH_THRESHOLD = 3;

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null, recentCrashes: [] };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info);
    const now = Date.now();
    const recent = (this.state.recentCrashes || []).filter(
      (t) => now - t < RAPID_CRASH_WINDOW_MS,
    );
    recent.push(now);
    this.setState({ info, recentCrashes: recent });
    // Log to Supabase for post-mortem. Best-effort, fire-and-forget —
    // never let the logging path itself crash the already-crashed
    // render tree. Sentry integration was removed pending org setup.
    try {
      logError({
        error,
        source: 'ErrorBoundary',
      });
    } catch {}
  }

  handleReset = () => {
    this.setState({ error: null, info: null });
  };

  handleContact = () => {
    const email = LEGAL?.SUPPORT_EMAIL;
    if (!email) return;
    const subject = encodeURIComponent('Ascend — Crash report');
    const body = encodeURIComponent(
      `Crash detail:\n${this.state.error?.message || 'unknown'}\n\nWhat I was doing:\n`,
    );
    Linking.openURL(`mailto:${email}?subject=${subject}&body=${body}`).catch(() => {});
  };

  render() {
    if (!this.state.error) return this.props.children;

    const inLoop =
      (this.state.recentCrashes?.length || 0) >= RAPID_CRASH_THRESHOLD;

    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.icon}>⚠️</Text>
          <Text style={styles.title}>{i18n.t('error.title')}</Text>
          <Text style={styles.subtitle}>{i18n.t('error.subtitle')}</Text>

          {inLoop ? (
            <Text style={styles.loopWarn}>{i18n.t('error.loopWarn')}</Text>
          ) : null}

          {/* Always show the error message — even in TestFlight/release.
              Without this, the user just sees "something went wrong" and
              can't tell us what crashed. Apple allows debug info in the
              fallback UI, and the cost of a 4-line gray box is tiny
              compared to the value of getting a real bug report. */}
          {this.state.error?.message ? (
            <View style={styles.devBox}>
              <Text style={styles.devLabel}>{i18n.t('error.devLabel')}</Text>
              <Text style={styles.devText} selectable>
                {String(this.state.error?.message)}
              </Text>
              {this.state.info?.componentStack ? (
                <Text
                  style={[styles.devText, { marginTop: 8, opacity: 0.7 }]}
                  numberOfLines={6}
                  selectable
                >
                  {String(this.state.info.componentStack)
                    .split('\n')
                    .slice(0, 6)
                    .join('\n')}
                </Text>
              ) : null}
            </View>
          ) : null}

          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={this.handleReset}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryBtnText}>{i18n.t('error.tryAgain')}</Text>
          </TouchableOpacity>

          {inLoop ? (
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={this.handleContact}
              activeOpacity={0.7}
            >
              <Text style={styles.secondaryBtnText}>
                {i18n.t('error.contactSupport')}
              </Text>
            </TouchableOpacity>
          ) : null}
        </ScrollView>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: LT.background },
  scroll: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  icon: { fontSize: 64, marginBottom: 24 },
  title: {
    color: LT.onSurface,
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 10,
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  subtitle: {
    color: LT.onSurfaceVariant,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 16,
    fontWeight: '500',
  },
  loopWarn: {
    color: LT.primary,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  devBox: {
    width: '100%',
    backgroundColor: LT.surfaceContainerLowest,
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: LT.primary,
    marginBottom: 24,
  },
  devLabel: {
    color: LT.primary,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  devText: {
    color: LT.onSurface,
    fontSize: 12,
    fontFamily: 'Menlo',
  },
  primaryBtn: {
    backgroundColor: LT.primary,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 14,
    minWidth: 220,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryBtnText: {
    color: LT.onPrimary,
    fontWeight: '900',
    fontSize: 16,
    letterSpacing: 0.3,
  },
  secondaryBtn: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  secondaryBtnText: {
    color: LT.onSurfaceVariant,
    fontWeight: '700',
    fontSize: 13,
    textDecorationLine: 'underline',
  },
});
