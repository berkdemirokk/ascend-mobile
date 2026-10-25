export const INITIAL_URL_TIMEOUT_MS = 1500;

export async function resolveInitialUrl(getInitialUrl, timeoutMs = INITIAL_URL_TIMEOUT_MS) {
  let timeoutId;
  try {
    const url = await Promise.race([
      getInitialUrl(),
      new Promise((resolve) => {
        timeoutId = setTimeout(() => resolve(null), timeoutMs);
      }),
    ]);
    return typeof url === 'string' ? url : null;
  } catch (error) {
    console.warn('[navigation] getInitialURL failed:', error?.message);
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}
