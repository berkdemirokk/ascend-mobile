// Text-to-speech with a two-tier strategy:
//
//   1. Pre-recorded Piper TTS MP3, hosted as a GitHub Release asset.
//      Open-source neural TTS, generated once by the
//      `generate-lesson-audio` workflow and served from
//      raw GitHub URLs. The mobile app streams these on demand —
//      much more human-sounding than the default iOS Siri voice,
//      and CC-licensed/free.
//
//   2. Fallback: expo-speech (system AVSpeechSynthesizer on iOS,
//      Android TTS on Android). Used when the pre-recorded MP3
//      isn't available for that lesson/lang OR network fails OR
//      the audio file 404s (e.g. on a fresh lesson the workflow
//      hasn't generated yet).
//
// The fallback is what keeps the user from ever hearing silence —
// even on day-one before all 250 lessons have been pre-rendered,
// "Sesli dinle" always plays SOMETHING.

import { Audio } from 'expo-av';

// Tag-versioned release URL — bump the tag (lesson-audio-v2) when we
// reshoot all the audio (e.g. switching from fahrettin → fettah voice).
// Files inside are flat: <pathId>-<lessonOrder>.mp3 (e.g.
// "dopamine-detox-1.mp3").
const AUDIO_RELEASE_BASE =
  'https://github.com/berkdemirokk/ascend-mobile/releases/download/lesson-audio-v1';

// Soft cache for the speech module so we don't import-cost it on every
// "Sesli dinle" tap.
let speech = null;
let activeListener = null;
let activeSound = null;

const loadSpeech = async () => {
  if (speech) return speech;
  try {
    const mod = await import('expo-speech');
    speech = mod.default ?? mod;
    return speech;
  } catch (e) {
    console.warn('[tts] expo-speech load failed:', e?.message || e);
    return null;
  }
};

/**
 * Try to play a pre-recorded MP3 for this lesson. Returns true if we
 * successfully started playback, false otherwise (caller falls back to
 * system TTS).
 *
 * We intentionally use the GitHub release URL directly — no proxy, no
 * caching layer. The mobile network stack caches HTTP responses; an
 * already-played lesson plays instantly the second time.
 */
const tryPlayPreRecorded = async (pathId, lessonOrder, { onDone, onError }) => {
  if (!pathId || lessonOrder == null) return false;
  // Stop anything previously playing first.
  if (activeSound) {
    try {
      await activeSound.unloadAsync();
    } catch {}
    activeSound = null;
  }
  const url = `${AUDIO_RELEASE_BASE}/${pathId}-${lessonOrder}.mp3`;
  try {
    const { sound } = await Audio.Sound.createAsync(
      { uri: url },
      // Speech audio benefits from a higher base volume than UI sfx;
      // ducks fine over background music either way.
      { shouldPlay: true, volume: 1.0 },
    );
    activeSound = sound;
    activeListener = { onDone, onError };
    sound.setOnPlaybackStatusUpdate((status) => {
      if (!status) return;
      // didJustFinish covers natural-end. error covers mid-stream failures.
      if (status.didJustFinish) {
        activeListener?.onDone?.();
        activeListener = null;
        sound.unloadAsync().catch(() => {});
        if (activeSound === sound) activeSound = null;
      } else if (status.error) {
        activeListener?.onError?.(new Error(status.error));
        activeListener = null;
        sound.unloadAsync().catch(() => {});
        if (activeSound === sound) activeSound = null;
      }
    });
    return true;
  } catch (e) {
    // Most common reason: 404 because the workflow hasn't generated
    // this lesson yet, or the user is offline. Either way the caller
    // falls back to system TTS so playback isn't silent.
    console.warn(
      '[tts] pre-recorded fetch failed, falling back to system TTS:',
      e?.message || e,
    );
    return false;
  }
};

/**
 * Speak a teaching paragraph. When `pathId` + `lessonOrder` are
 * supplied AND we have a pre-recorded MP3 for that lesson on GitHub,
 * we'll play that. Otherwise we fall back to system TTS so the
 * user always hears SOMETHING when they tap "Sesli dinle."
 *
 * @param {string} text
 * @param {Object} [opts]
 * @param {string} [opts.lang]         BCP-47 tag passed to system TTS
 * @param {string} [opts.pathId]       e.g. "dopamine-detox"
 * @param {number|string} [opts.lessonOrder]  the 1-indexed lesson number
 * @param {() => void} [opts.onDone]
 * @param {(err: Error) => void} [opts.onError]
 */
export const speak = async (
  text,
  { lang, pathId, lessonOrder, onDone, onError } = {},
) => {
  if (!text || typeof text !== 'string') return false;

  // Tier 1: pre-recorded Piper TTS MP3 from GitHub release. Only
  // attempted for Turkish for now — the audio generation workflow
  // currently runs against lessons.tr.json.
  if (pathId && lessonOrder != null && (!lang || lang.startsWith('tr'))) {
    const ok = await tryPlayPreRecorded(pathId, lessonOrder, {
      onDone,
      onError,
    });
    if (ok) return true;
  }

  // Tier 2: system TTS (iOS AVSpeechSynthesizer / Android TTS).
  const S = await loadSpeech();
  if (!S || typeof S.speak !== 'function') {
    onError?.(new Error('tts unavailable'));
    return false;
  }
  try {
    if (typeof S.stop === 'function') await S.stop();
    activeListener = { onDone, onError };
    S.speak(text, {
      language: lang,
      rate: 1.0,
      pitch: 1.0,
      onDone: () => {
        activeListener?.onDone?.();
        activeListener = null;
      },
      onStopped: () => {
        activeListener?.onDone?.();
        activeListener = null;
      },
      onError: (err) => {
        activeListener?.onError?.(err);
        activeListener = null;
      },
    });
    return true;
  } catch (e) {
    console.warn('[tts] speak error:', e?.message || e);
    onError?.(e);
    return false;
  }
};

/**
 * Stop any current playback — covers both the pre-recorded MP3 sound
 * AND any in-flight system TTS utterance.
 */
export const stop = async () => {
  // Stop the pre-recorded sound, if any.
  if (activeSound) {
    try {
      await activeSound.unloadAsync();
    } catch {}
    activeSound = null;
  }
  activeListener = null;
  // Stop system TTS.
  if (speech && typeof speech.stop === 'function') {
    try {
      await speech.stop();
    } catch (e) {
      console.warn('[tts] stop error:', e?.message || e);
      return false;
    }
  }
  return true;
};

export const isSpeakingAsync = async () => {
  // We're "speaking" if either tier is active. The system-TTS check
  // is async; the sound check is sync.
  if (activeSound) return true;
  if (speech && typeof speech.isSpeakingAsync === 'function') {
    try {
      return await speech.isSpeakingAsync();
    } catch {
      return false;
    }
  }
  return false;
};
