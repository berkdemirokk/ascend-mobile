// Lightweight voice-recording wrapper around expo-av.
// Used during the Reflection step so users can speak their thoughts instead
// of typing — emotional friction is much lower for voice journals.
//
// Recording is local-only: the audio file URI is stored alongside the text
// reflection in AsyncStorage / cloudSync. We never upload audio to a backend.

let Audio = null;
let recording = null;

async function loadAudio() {
  if (Audio) return Audio;
  try {
    const mod = await import('expo-av');
    Audio = mod.Audio;
    return Audio;
  } catch (e) {
    console.warn('[voice] expo-av load failed:', e?.message);
    return null;
  }
}

export const isRecordingAvailable = async () => {
  const A = await loadAudio();
  return !!A?.Recording;
};

export const requestMicPermission = async () => {
  const A = await loadAudio();
  if (!A) return false;
  try {
    const result = await A.requestPermissionsAsync();
    return result?.status === 'granted';
  } catch {
    return false;
  }
};

export const startRecording = async () => {
  const A = await loadAudio();
  if (!A) return false;
  if (recording) return true; // already recording
  const granted = await requestMicPermission();
  if (!granted) return false;
  try {
    await A.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });
    const r = new A.Recording();
    await r.prepareToRecordAsync(A.RecordingOptionsPresets.HIGH_QUALITY);
    await r.startAsync();
    recording = r;
    return true;
  } catch (e) {
    console.warn('[voice] startRecording error:', e?.message);
    recording = null;
    return false;
  }
};

/**
 * Stop the current recording and return the local file URI.
 */
export const stopRecording = async () => {
  if (!recording) return null;
  try {
    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    recording = null;
    // Reset audio mode so playback elsewhere isn't muted by recording session.
    if (Audio) {
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
        });
      } catch {}
    }
    return uri || null;
  } catch (e) {
    console.warn('[voice] stopRecording error:', e?.message);
    recording = null;
    return null;
  }
};

export const cancelRecording = async () => {
  if (!recording) return;
  try {
    await recording.stopAndUnloadAsync();
  } catch {}
  recording = null;
};

/**
 * Play a previously recorded URI. Returns the Sound instance so the caller
 * can stop it later — null if playback fails.
 */
export const playRecording = async (uri) => {
  if (!uri) return null;
  const A = await loadAudio();
  if (!A) return null;
  try {
    const { sound } = await A.Sound.createAsync({ uri });
    await sound.playAsync();
    return sound;
  } catch (e) {
    console.warn('[voice] playRecording error:', e?.message);
    return null;
  }
};
