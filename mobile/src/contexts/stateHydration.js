import { initialState, MAX_HEARTS, normalizeAnonUsername } from './appStateConstants';

const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isText = (value) => typeof value === 'string';
const isNumber = (value) => typeof value === 'number' && Number.isFinite(value);
const isTimestamp = (value) => isNumber(value) && value >= 0 && value <= 8.64e15;
const safeKey = (key) => !['__proto__', 'constructor', 'prototype'].includes(key);
const strings = (value) => Array.isArray(value) ? [...new Set(value.filter(isText))] : [];
const dictionary = (value, accepts) => Object.fromEntries(
  Object.entries(isRecord(value) ? value : {}).filter(([key, entry]) => safeKey(key) && accepts(entry)),
);
const counts = (value) => Object.fromEntries(
  Object.entries(dictionary(value, isNumber)).map(([key, entry]) => [key, Math.max(0, Math.floor(entry))]),
);

function pathProgress(value) {
  return Object.fromEntries(Object.entries(dictionary(value, isRecord)).map(([key, entry]) => [key, {
    completed: strings(entry.completed),
    reflections: dictionary(entry.reflections, isText),
    reflectionAudio: dictionary(entry.reflectionAudio, isText),
    quizCorrect: counts(entry.quizCorrect),
  }]));
}

function assessment(value) {
  if (!isRecord(value) || !isTimestamp(value.ts) || !isRecord(value.scores)) return null;
  const scores = dictionary(value.scores, (score) => isNumber(score) && score >= 1 && score <= 10);
  return Object.keys(scores).length ? { ts: value.ts, scores } : null;
}

function profile(value) {
  if (!isRecord(value)) return null;
  return {
    ...dictionary(value, isText),
    goals: strings(value.goals),
    answers: dictionary(value.answers, isText),
  };
}

// AsyncStorage and cloud JSON are untrusted snapshots, including older versions.
// Repair fields independently so a corrupt field cannot erase unrelated progress.
// Missing keys stay missing so cloud merges preserve their existing semantics.
export function sanitizePersistedState(payload) {
  if (!isRecord(payload)) return {};
  const output = {};
  for (const key of Object.keys(initialState)) {
    if (key.startsWith('_') || !Object.prototype.hasOwnProperty.call(payload, key)) continue;
    const value = payload[key];
    const fallback = initialState[key];
    if (key === 'pathProgress') output[key] = pathProgress(value);
    else if (key === 'lessonHistory') output[key] = counts(value);
    else if (key === 'pathPledges') output[key] = dictionary(value, isText);
    else if (key === 'userProfile') output[key] = profile(value);
    else if (key === 'baselineAssessment' || key === 'latestAssessment') output[key] = assessment(value);
    else if (key === 'assessmentHistory') {
      output[key] = (Array.isArray(value) ? value : []).map(assessment).filter(Boolean).slice(-12);
    } else if (key === 'dailyDeckHistory') {
      output[key] = (Array.isArray(value) ? value : [])
        .filter((entry) => isRecord(entry) && isText(entry.deckId) && isTimestamp(entry.ts))
        .map((entry) => ({
          deckId: entry.deckId,
          ts: entry.ts,
          date: isText(entry.date) ? entry.date : '',
          response: isText(entry.response) ? entry.response : '',
          actionCommitted: entry.actionCommitted === true,
        })).slice(-60);
    } else if (Array.isArray(fallback)) output[key] = strings(value);
    else if (typeof fallback === 'boolean') output[key] = typeof value === 'boolean' ? value : fallback;
    else if (typeof fallback === 'number') {
      const minimum = key === 'level' ? 1 : 0;
      output[key] = isNumber(value) ? Math.max(minimum, Math.floor(value)) : fallback;
      if (key === 'hearts') output[key] = Math.min(MAX_HEARTS, output[key]);
    } else if (typeof fallback === 'string') output[key] = isText(value) && value ? value : fallback;
    else output[key] = isText(value) ? value : null;
  }
  if (Object.prototype.hasOwnProperty.call(output, 'anonUsername')) {
    output.anonUsername = normalizeAnonUsername(output.anonUsername);
  }
  return output;
}
