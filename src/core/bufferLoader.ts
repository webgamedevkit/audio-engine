/** Module-level cache of decoded buffers keyed by {@link loadAudioBuffer}'s `cacheKey`. */
const soundCache: Record<string, AudioBuffer> = {};

/** In-flight load promises keyed by `cacheKey` to deduplicate concurrent fetches. */
const inFlight = new Map<string, Promise<AudioBuffer>>();

/** Incremented on {@link clearAudioBufferCache} so stale loads cannot repopulate the cache. */
let cacheGeneration = 0;

/**
 * Fetches, decodes, and caches an audio file as an {@link AudioBuffer}.
 *
 * On cache hit, returns the existing buffer without another network request.
 * Concurrent requests for the same `cacheKey` share a single in-flight promise.
 * On failure, logs and rethrows the original error.
 *
 * @param audioContext - Context used for `decodeAudioData`.
 * @param url - Absolute or relative URL of the audio asset.
 * @param cacheKey - Cache key (defaults to `url`; use a stable key when the same asset is aliased).
 * @returns Decoded buffer.
 * @throws When fetching or decoding fails.
 */
export const loadAudioBuffer = async (
  audioContext: AudioContext,
  url: string,
  cacheKey: string = url
): Promise<AudioBuffer> => {
  if (soundCache[cacheKey]) {
    return soundCache[cacheKey];
  }

  const pending = inFlight.get(cacheKey);
  if (pending) {
    return pending;
  }

  const generation = cacheGeneration;

  let promise!: Promise<AudioBuffer>;
  promise = (async () => {
    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const decoded = await audioContext.decodeAudioData(arrayBuffer);
      if (generation === cacheGeneration) {
        soundCache[cacheKey] = decoded;
      }
      return decoded;
    } catch (error) {
      console.error(`Failed to load audio buffer from ${url}:`, error);
      throw error;
    } finally {
      if (inFlight.get(cacheKey) === promise) {
        inFlight.delete(cacheKey);
      }
    }
  })();

  inFlight.set(cacheKey, promise);
  return promise;
};

/**
 * Clears the module-level decoded-buffer cache and in-flight load map.
 * Call when unloading a pack of assets or during tests.
 */
export const clearAudioBufferCache = () => {
  cacheGeneration++;
  for (const key of Object.keys(soundCache)) {
    delete soundCache[key];
  }
  inFlight.clear();
};
