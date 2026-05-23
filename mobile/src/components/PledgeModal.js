// Commitment Device modal. The retention audit's #7 finding: a written,
// self-authored sentence raises adherence ~30% even if the user never
// re-reads it (behavioral economics, sometimes called the "public
// pledge effect" — though here it stays private).
//
// We surface it the first time a user opens HomeScreen with an active
// path that doesn't yet have a pledge. Cannot be dismissed without
// either writing something OR explicitly tapping "Skip" — making the
// skip a deliberate choice raises completion vs. a silent X button.

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { MaterialIcons } from '@expo/vector-icons';
import { LT } from '../config/lightTheme';

const MIN_LENGTH = 8; // anything shorter is almost certainly noise
const MAX_LENGTH = 140; // one tweet — forces a single sentence

export default function PledgeModal({
  visible,
  pathTitle,
  onSubmit,
  onSkip,
}) {
  const { t } = useTranslation();
  const [text, setText] = useState('');

  // Reset draft whenever the modal re-opens. Stale text from a
  // previous open (different path, dismissed earlier) would surprise
  // the user.
  useEffect(() => {
    if (visible) setText('');
  }, [visible]);

  const trimmed = text.trim();
  const canSubmit = trimmed.length >= MIN_LENGTH;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onSkip}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable
          style={styles.backdrop}
          onPress={() => {}} // explicit no-op; can't dismiss by tapping outside
        />
        <View style={styles.card}>
          <Text style={styles.label}>
            {t('pledge.label', 'TAAHHÜT')}
          </Text>
          <Text style={styles.title}>
            {t('pledge.title', '{{path}} yoluna ne için söz veriyorsun?', {
              path: pathTitle || t('pledge.thisPath', 'Bu yola'),
            })}
          </Text>
          <Text style={styles.help}>
            {t(
              'pledge.help',
              'Tek cümle. Kimseyi bilgilendirmiyoruz — sadece sen göreceksin. Yine de yazmak fark yaratır.',
            )}
          </Text>

          <TextInput
            style={styles.input}
            value={text}
            onChangeText={(v) => setText(v.slice(0, MAX_LENGTH))}
            multiline
            placeholder={t(
              'pledge.placeholder',
              'Örnek: Bu yolu 30 gün boyunca her gün yapacağım çünkü kendime sözüm var.',
            )}
            placeholderTextColor={LT.onSurfaceVariant}
            autoFocus
            maxLength={MAX_LENGTH}
          />
          <Text style={styles.counter}>
            {trimmed.length}/{MAX_LENGTH}
          </Text>

          <TouchableOpacity
            style={[styles.submit, !canSubmit && styles.submitDisabled]}
            onPress={() => canSubmit && onSubmit(trimmed)}
            activeOpacity={canSubmit ? 0.85 : 1}
          >
            <Text
              style={[
                styles.submitText,
                !canSubmit && styles.submitTextDisabled,
              ]}
            >
              {t('pledge.submit', 'SÖZÜMÜ VERDİM')}
            </Text>
            <MaterialIcons
              name="arrow-forward"
              size={18}
              color={canSubmit ? LT.onPrimary : LT.onSurfaceVariant}
            />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onSkip}
            style={styles.skip}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.skipText}>
              {t('pledge.skip', 'Şimdilik geç')}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  card: {
    backgroundColor: LT.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 32,
  },
  label: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.6,
    color: LT.primary,
    marginBottom: 6,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: LT.onSurface,
    lineHeight: 26,
    marginBottom: 8,
  },
  help: {
    fontSize: 13,
    fontWeight: '500',
    color: LT.onSurfaceVariant,
    lineHeight: 18,
    marginBottom: 16,
  },
  input: {
    minHeight: 96,
    borderWidth: 1,
    borderColor: LT.outlineVariant,
    borderRadius: 14,
    padding: 12,
    fontSize: 15,
    color: LT.onSurface,
    backgroundColor: LT.surfaceContainerLowest,
    textAlignVertical: 'top',
  },
  counter: {
    alignSelf: 'flex-end',
    fontSize: 11,
    color: LT.onSurfaceVariant,
    marginTop: 4,
    marginBottom: 14,
  },
  submit: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: LT.primary,
    borderRadius: 14,
    paddingVertical: 14,
  },
  submitDisabled: {
    backgroundColor: LT.surfaceContainer,
  },
  submitText: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.6,
    color: LT.onPrimary,
  },
  submitTextDisabled: {
    color: LT.onSurfaceVariant,
  },
  skip: {
    alignSelf: 'center',
    marginTop: 12,
    padding: 6,
  },
  skipText: {
    fontSize: 12,
    fontWeight: '600',
    color: LT.onSurfaceVariant,
    textDecorationLine: 'underline',
  },
});
