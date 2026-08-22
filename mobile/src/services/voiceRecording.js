// Lightweight voice-recording wrapper around expo-audio.
// Used during the Reflection step so users can speak their thoughts instead
// of typing — emotional friction is much lower for voice journals.
//
// Recording is local-only: the audio file URI is stored alongside the text
// reflection in AsyncStorage / cloudSync. We never upload audio to a backend.

import {
  createAudioPlayer,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from 'expo-audio';

const resetPlaybackAudioMode = async () => {
  try {
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
  } catch {}
};

export const isRecordingAvailable = async () => true;

export const requestMicPermission = async () => {
  try {
    const result = await requestRecordingPermissionsAsync();
    return result?.granted === true;
  } catch {
    return false;
  }
};

export const startRecording = async (recorder) => {
  if (!recorder) return false;
  if (recorder.isRecording) return true;
  const granted = await requestMicPermission();
  if (!granted) return false;
  let started = false;
  try {
    await setAudioModeAsync({
      allowsRecording: true,
      playsInSilentMode: true,
    });
    await recorder.prepareToRecordAsync();
    recorder.record();
    started = true;
    return true;
  } catch (e) {
    console.warn('[voice] startRecording error:', e?.message);
    return false;
  } finally {
    if (!started) await resetPlaybackAudioMode();
  }
};

/**
 * Stop the current recording and return the local file URI.
 */
export const stopRecording = async (recorder) => {
  if (!recorder) return null;
  try {
    await recorder.stop();
    const uri = recorder.uri;
    return uri || null;
  } catch (e) {
    console.warn('[voice] stopRecording error:', e?.message);
    return null;
  } finally {
    await resetPlaybackAudioMode();
  }
};

export const cancelRecording = async (recorder) => {
  if (!recorder) return;
  try {
    if (recorder.isRecording) await recorder.stop();
  } catch {
    // Cleanup still needs to restore playback mode when stop fails.
  } finally {
    await resetPlaybackAudioMode();
  }
};

/**
 * Play a previously recorded URI. Returns the Sound instance so the caller
 * can stop it later — null if playback fails.
 */
export const playRecording = async (uri) => {
  if (!uri) return null;
  try {
    const player = createAudioPlayer({ uri });
    let removed = false;
    const remove = () => {
      if (removed) return;
      removed = true;
      try { player.remove(); } catch {}
    };
    player.addListener('playbackStatusUpdate', (status) => {
      if (status?.didJustFinish) remove();
    });
    player.play();
    return {
      stopAsync: async () => player.pause(),
      unloadAsync: async () => remove(),
    };
  } catch (e) {
    console.warn('[voice] playRecording error:', e?.message);
    return null;
  }
};
