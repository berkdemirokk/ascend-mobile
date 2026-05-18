// Custom Goal Card — the user's self-defined personal goal, sitting
// alongside the curriculum. Deeper personalization than path selection
// alone: the user names their own monster ("Stop scrolling at 11pm",
// "Wake at 6am", "Run 3x/week") and gets a one-tap daily check-in
// with a visual progress bar toward their target.
//
// Two states:
//   1. Setup prompt — when no customGoal exists. Shows the eyebrow,
//      hook copy, and "Set my goal" CTA that opens the modal editor.
//   2. Active tracking — shows goal text, days completed / target,
//      a progress bar, and either a "Done today" CTA (not yet
//      checked in) or a completed pill ("✓ Done today").

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { LT } from '../config/lightTheme';
import { hapticImpactLight, hapticSuccess } from '../services/haptics';

const TARGET_OPTIONS = [30, 60, 90];

const todayStr = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
};

export default function CustomGoalCard({
  customGoal, // { text, targetDays, checkIns, lastCheckInDate } | null
  onSave,     // (goal: { text, targetDays }) => void
  onCheckIn,  // () => void — idempotent per day
  onClear,    // () => void
}) {
  const { t } = useTranslation();
  const [editorOpen, setEditorOpen] = useState(false);
  const [draftText, setDraftText] = useState(customGoal?.text || '');
  const [draftTarget, setDraftTarget] = useState(
    customGoal?.targetDays || 30,
  );

  const today = todayStr();
  const completedToday = customGoal?.lastCheckInDate === today;
  const completedCount = useMemo(
    () => Object.values(customGoal?.checkIns || {}).filter(Boolean).length,
    [customGoal],
  );
  const targetDays = customGoal?.targetDays || 30;
  const pct = Math.min(100, Math.round((completedCount / targetDays) * 100));

  const openEditor = (forEdit = false) => {
    setDraftText(forEdit ? customGoal?.text || '' : '');
    setDraftTarget(forEdit ? customGoal?.targetDays || 30 : 30);
    setEditorOpen(true);
  };

  const handleSave = () => {
    const text = String(draftText || '').trim();
    if (text.length < 3) return;
    hapticImpactLight();
    onSave?.({ text, targetDays: draftTarget });
    setEditorOpen(false);
  };

  const handleCheckIn = () => {
    if (completedToday) return;
    hapticSuccess();
    onCheckIn?.();
  };

  // ── EMPTY STATE — prompt the user to set their goal ───────────────────
  if (!customGoal) {
    return (
      <>
        <TouchableOpacity
          onPress={() => openEditor(false)}
          activeOpacity={0.9}
          style={styles.promptCard}
        >
          <View style={styles.promptIconWrap}>
            <MaterialIcons name="flag" size={20} color={LT.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.promptEyebrow}>
              {t('customGoal.eyebrow', 'YOUR OWN GOAL')}
            </Text>
            <Text style={styles.promptTitle}>
              {t(
                'customGoal.promptTitle',
                'What discipline are you really building?',
              )}
            </Text>
            <Text style={styles.promptSub}>
              {t(
                'customGoal.promptSub',
                'Name it. Track it daily. The app adapts to you.',
              )}
            </Text>
          </View>
          <MaterialIcons name="add" size={20} color={LT.onSurfaceVariant} />
        </TouchableOpacity>
        {renderEditor()}
      </>
    );
  }

  // ── ACTIVE STATE — show goal + progress + check-in ────────────────────
  return (
    <>
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>
              {t('customGoal.activeEyebrow', 'MY DAILY GOAL')}
            </Text>
            <Text style={styles.goalText} numberOfLines={2}>
              {customGoal.text}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => openEditor(true)}
            style={styles.editBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <MaterialIcons name="edit" size={16} color={LT.onSurfaceVariant} />
          </TouchableOpacity>
        </View>

        <View style={styles.progressRow}>
          <Text style={styles.progressLabel}>
            {t('customGoal.progress', '{{done}} / {{target}} days', {
              done: completedCount,
              target: targetDays,
            })}
          </Text>
          <Text style={styles.progressPct}>{pct}%</Text>
        </View>
        <View style={styles.barTrack}>
          <View style={[styles.barFill, { width: `${pct}%` }]} />
        </View>

        {completedToday ? (
          <View style={styles.doneRow}>
            <MaterialIcons name="check-circle" size={18} color={LT.success} />
            <Text style={styles.doneText}>
              {t('customGoal.doneToday', 'Done today — keep walking.')}
            </Text>
          </View>
        ) : (
          <TouchableOpacity
            onPress={handleCheckIn}
            activeOpacity={0.85}
            style={styles.checkInBtn}
          >
            <Text style={styles.checkInText}>
              {t('customGoal.checkInCta', 'I DID IT TODAY')}
            </Text>
          </TouchableOpacity>
        )}
      </View>
      {renderEditor()}
    </>
  );

  function renderEditor() {
    return (
      <Modal
        visible={editorOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setEditorOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}
        >
          <ScrollView
            contentContainerStyle={styles.modalScroll}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {t('customGoal.editorTitle', 'Your personal goal')}
                </Text>
                <TouchableOpacity
                  onPress={() => setEditorOpen(false)}
                  style={styles.modalClose}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <MaterialIcons name="close" size={20} color={LT.onSurface} />
                </TouchableOpacity>
              </View>

              <Text style={styles.modalSub}>
                {t(
                  'customGoal.editorSub',
                  'Name the discipline you are building. Specific beats vague.',
                )}
              </Text>

              <TextInput
                style={styles.input}
                placeholder={t(
                  'customGoal.placeholder',
                  'e.g. Wake at 6 AM every morning',
                )}
                placeholderTextColor={LT.onSurfaceVariant}
                value={draftText}
                onChangeText={setDraftText}
                maxLength={80}
                multiline
              />

              <Text style={styles.fieldLabel}>
                {t('customGoal.targetLabel', 'TARGET HORIZON')}
              </Text>
              <View style={styles.targetRow}>
                {TARGET_OPTIONS.map((d) => (
                  <TouchableOpacity
                    key={d}
                    onPress={() => setDraftTarget(d)}
                    activeOpacity={0.85}
                    style={[
                      styles.targetBtn,
                      draftTarget === d && styles.targetBtnActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.targetBtnText,
                        draftTarget === d && styles.targetBtnTextActive,
                      ]}
                    >
                      {t('customGoal.daysFmt', '{{count}} days', { count: d })}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                onPress={handleSave}
                activeOpacity={0.9}
                style={[
                  styles.saveBtn,
                  draftText.trim().length < 3 && styles.saveBtnDisabled,
                ]}
                disabled={draftText.trim().length < 3}
              >
                <Text style={styles.saveBtnText}>
                  {customGoal
                    ? t('customGoal.saveEdit', 'Save changes')
                    : t('customGoal.saveCreate', 'Set my goal')}
                </Text>
              </TouchableOpacity>

              {customGoal ? (
                <TouchableOpacity
                  onPress={() => {
                    onClear?.();
                    setEditorOpen(false);
                  }}
                  style={styles.clearBtn}
                >
                  <Text style={styles.clearBtnText}>
                    {t('customGoal.clear', 'Remove goal')}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    );
  }
}

const styles = StyleSheet.create({
  // EMPTY STATE — prompt
  promptCard: {
    backgroundColor: LT.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: LT.outlineVariant,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  promptIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: LT.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  promptEyebrow: {
    color: LT.primary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  promptTitle: {
    color: LT.onSurface,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  promptSub: {
    color: LT.onSurfaceVariant,
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },

  // ACTIVE STATE
  card: {
    backgroundColor: LT.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: LT.outlineVariant,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  eyebrow: {
    color: LT.primary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  goalText: {
    color: LT.onSurface,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
    lineHeight: 22,
  },
  editBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: LT.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 6,
  },
  progressLabel: {
    color: LT.onSurfaceVariant,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  progressPct: {
    color: LT.onSurface,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  barTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: LT.surfaceContainer,
    overflow: 'hidden',
    marginBottom: 12,
  },
  barFill: {
    height: '100%',
    backgroundColor: LT.primary,
    borderRadius: 3,
  },
  checkInBtn: {
    backgroundColor: LT.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  checkInText: {
    color: LT.onPrimary,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  doneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: LT.surfaceContainerLow,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  doneText: {
    color: LT.onSurface,
    fontSize: 13,
    fontWeight: '700',
  },

  // EDITOR MODAL
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalScroll: {
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: LT.surfaceContainerLowest,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 30,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  modalTitle: {
    color: LT.onSurface,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  modalClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: LT.surfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSub: {
    color: LT.onSurfaceVariant,
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 16,
    lineHeight: 18,
  },
  input: {
    backgroundColor: LT.surfaceContainerLow,
    borderWidth: 1,
    borderColor: LT.outlineVariant,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: LT.onSurface,
    fontSize: 15,
    fontWeight: '600',
    minHeight: 64,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  fieldLabel: {
    color: LT.primary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  targetRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 22,
  },
  targetBtn: {
    flex: 1,
    backgroundColor: LT.surfaceContainerLow,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  targetBtnActive: {
    backgroundColor: LT.primaryContainer,
    borderColor: LT.primary,
  },
  targetBtnText: {
    color: LT.onSurfaceVariant,
    fontSize: 13,
    fontWeight: '800',
  },
  targetBtnTextActive: {
    color: LT.onPrimary,
  },
  saveBtn: {
    backgroundColor: LT.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: {
    color: LT.onPrimary,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  clearBtn: {
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 6,
  },
  clearBtnText: {
    color: LT.error,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
});
