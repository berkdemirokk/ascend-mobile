import React from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { AccessibleTouchableOpacity as TouchableOpacity } from '../AccessibleControls';
import { LT, LT_RADIUS } from '../../config/lightTheme';

export default function RedeemCodeModal({
  visible,
  onClose,
  redeeming,
  redeemCodeInput,
  setRedeemCodeInput,
  onSubmit,
}) {
  const { t } = useTranslation();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (!redeeming) onClose();
      }}
    >
      <KeyboardAvoidingView
        style={styles.redeemModalBackdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity
          accessible={false}
          activeOpacity={1}
          onPress={() => {
            if (!redeeming) onClose();
          }}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={styles.redeemModalCard}>
          <Text style={styles.redeemModalTitle}>
            {t('settings.redeemTitle', 'Davet Kodu')}
          </Text>
          <Text style={styles.redeemModalBody}>
            {t(
              'settings.redeemBody',
              'Bir arkadaşının kodunu yaz — kabul edilirse ikinize de 10 streak donduru gelir.',
            )}
          </Text>
          <TextInput
            value={redeemCodeInput}
            onChangeText={setRedeemCodeInput}
            autoCapitalize="characters"
            autoCorrect={false}
            autoFocus
            maxLength={24}
            placeholder="ASCEND-XXXX-YYYY"
            placeholderTextColor={LT.outline}
            returnKeyType="done"
            onSubmitEditing={() => onSubmit(redeemCodeInput)}
            editable={!redeeming}
            style={styles.redeemInput}
            accessibilityLabel={t('settings.redeemTitle', 'Davet Kodu')}
          />
          <View style={styles.redeemModalActions}>
            <TouchableOpacity
              accessibilityLabel={t('common.cancel', 'İptal')}
              onPress={onClose}
              disabled={redeeming}
              style={styles.redeemCancelButton}
            >
              <Text style={styles.redeemCancelText}>
                {t('common.cancel', 'İptal')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityLabel={t('settings.redeemInvite', 'Davet kodu gir')}
              onPress={() => onSubmit(redeemCodeInput)}
              disabled={redeeming || !redeemCodeInput.trim()}
              style={[
                styles.redeemSubmitButton,
                (redeeming || !redeemCodeInput.trim()) && styles.redeemSubmitDisabled,
              ]}
            >
              {redeeming ? (
                <ActivityIndicator size="small" color={LT.onPrimary} />
              ) : (
                <Text style={styles.redeemSubmitText}>
                  {t('common.confirm', 'Onayla')}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  redeemModalBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  redeemModalCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: LT_RADIUS.xl,
    padding: 20,
    backgroundColor: LT.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: LT.outlineVariant,
  },
  redeemModalTitle: {
    color: LT.onSurface,
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 8,
  },
  redeemModalBody: {
    color: LT.onSurfaceVariant,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 16,
  },
  redeemInput: {
    height: 48,
    borderRadius: LT_RADIUS.md,
    borderWidth: 1,
    borderColor: LT.outlineVariant,
    backgroundColor: LT.surfaceContainerLowest,
    paddingHorizontal: 14,
    color: LT.onSurface,
    fontSize: 15,
    fontVariant: ['tabular-nums'],
    marginBottom: 16,
  },
  redeemModalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  redeemCancelButton: {
    height: 40,
    paddingHorizontal: 16,
    borderRadius: LT_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: LT.outlineVariant,
  },
  redeemCancelText: {
    color: LT.onSurfaceVariant,
    fontSize: 14,
    fontWeight: '700',
  },
  redeemSubmitButton: {
    height: 40,
    paddingHorizontal: 20,
    borderRadius: LT_RADIUS.md,
    backgroundColor: LT.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  redeemSubmitDisabled: {
    opacity: 0.5,
  },
  redeemSubmitText: {
    color: LT.onPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
});
