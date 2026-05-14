// YourWhyCard — pinned Home card showing the user's self-stated "why."
// Highest-leverage emotional re-engagement surface; the user reads
// their own past commitment every time they open the app.
//
// Two states:
//   - Empty:  prompt to write a why ("Why are you doing this?")
//   - Filled: shows the why text in quotes, edit on tap
//
// Editing happens in a small inline modal — single TextInput, 280 chars
// max, save/cancel. Persisted via useApp().setUserWhy.

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TextInput,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { LT, LT_RADIUS, LT_SPACING } from '../config/lightTheme';
import { hapticImpactLight } from '../services/haptics';

const MAX_LENGTH = 280;

export default function YourWhyCard({ userWhy, onSave }) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(userWhy || '');

  const openEditor = () => {
    hapticImpactLight();
    setDraft(userWhy || '');
    setEditing(true);
  };

  const handleSave = () => {
    onSave?.(draft.trim());
    setEditing(false);
  };

  const isEmpty = !userWhy;

  return (
    <>
      <TouchableOpacity
        onPress={openEditor}
        activeOpacity={0.9}
        style={[styles.card, isEmpty && styles.cardEmpty]}
      >
        <View style={styles.iconBox}>
          <MaterialIcons
            name={isEmpty ? 'add-circle-outline' : 'format-quote'}
            size={20}
            color={isEmpty ? LT.onSurfaceVariant : LT.primaryContainer}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>
            {t('yourWhy.label', 'NEDEN BURDASIN')}
          </Text>
          <Text
            style={[styles.body, isEmpty && styles.bodyPlaceholder]}
            numberOfLines={3}
          >
            {userWhy ||
              t(
                'yourWhy.empty',
                'Bir cümleyle yaz — açıldığında her gün bunu göreceksin.',
              )}
          </Text>
        </View>
        <MaterialIcons name="edit" size={16} color={LT.onSurfaceVariant} />
      </TouchableOpacity>

      <Modal
        visible={editing}
        animationType="slide"
        transparent
        onRequestClose={() => setEditing(false)}
      >
        <SafeAreaView style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ flex: 1, justifyContent: 'flex-end' }}
          >
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>
                {t('yourWhy.modalTitle', 'Neden burdasın?')}
              </Text>
              <Text style={styles.modalSub}>
                {t(
                  'yourWhy.modalSub',
                  'Bir cümle yeter. Zayıf anlarda kendine bunu hatırlatacaksın.',
                )}
              </Text>
              <TextInput
                style={styles.input}
                value={draft}
                onChangeText={setDraft}
                placeholder={t(
                  'yourWhy.placeholder',
                  'Örn: Telefon bağımlılığımı kırmak ve hayatımı geri almak için.',
                )}
                placeholderTextColor={LT.outline}
                maxLength={MAX_LENGTH}
                multiline
                autoFocus
                returnKeyType="done"
                blurOnSubmit
              />
              <Text style={styles.counter}>
                {draft.length}/{MAX_LENGTH}
              </Text>
              <View style={styles.modalActions}>
                <TouchableOpacity
                  onPress={() => setEditing(false)}
                  activeOpacity={0.7}
                  style={[styles.modalBtn, styles.modalBtnSecondary]}
                >
                  <Text style={styles.modalBtnSecondaryText}>
                    {t('common.cancel', 'İptal')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSave}
                  activeOpacity={0.85}
                  style={[styles.modalBtn, styles.modalBtnPrimary]}
                >
                  <Text style={styles.modalBtnPrimaryText}>
                    {t('common.save', 'Kaydet')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: LT.surfaceContainerLowest,
    borderRadius: LT_RADIUS.lg,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginHorizontal: LT_SPACING.containerMargin,
    marginBottom: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: LT.outlineVariant,
  },
  cardEmpty: {
    borderStyle: 'dashed',
  },
  iconBox: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.6,
    color: LT.onSurfaceVariant,
    marginBottom: 2,
  },
  body: {
    fontSize: 14,
    fontWeight: '700',
    color: LT.onSurface,
    lineHeight: 19,
  },
  bodyPlaceholder: {
    fontWeight: '500',
    color: LT.onSurfaceVariant,
    fontStyle: 'italic',
  },
  // Edit modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  modalCard: {
    backgroundColor: LT.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 28,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: LT.onSurface,
    marginBottom: 4,
  },
  modalSub: {
    fontSize: 13,
    fontWeight: '500',
    color: LT.onSurfaceVariant,
    marginBottom: 16,
  },
  input: {
    backgroundColor: LT.surfaceContainerLowest,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: LT.outlineVariant,
    padding: 14,
    fontSize: 15,
    fontWeight: '500',
    color: LT.onSurface,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  counter: {
    alignSelf: 'flex-end',
    marginTop: 6,
    fontSize: 11,
    color: LT.outline,
    fontWeight: '700',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalBtnPrimary: {
    backgroundColor: LT.primaryContainer,
  },
  modalBtnPrimaryText: {
    color: LT.onPrimary,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  modalBtnSecondary: {
    backgroundColor: LT.surfaceContainerLow,
  },
  modalBtnSecondaryText: {
    color: LT.onSurface,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
});
