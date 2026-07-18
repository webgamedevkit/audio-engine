import { loadAudioBuffer } from "./bufferLoader";
import {
  configRequestsNormalization,
  warmBufferPeak,
} from "./peakNormalization";
import type { SoundConfig } from "../types";

type ResolveBufferFn = (
  ctx: AudioContext,
  event: string,
  data?: unknown
) => Promise<AudioBuffer | null>;

type OnLoadErrorFn = (event: string, url: string, error: unknown) => void;

/**
 * Collects all file URLs declared on a {@link SoundConfig}.
 */
export const collectUrlsFromConfig = (config: SoundConfig): string[] => {
  const urls: string[] = [];
  if (config.src) {
    urls.push(config.src);
  }
  if (config.srces) {
    urls.push(...Object.values(config.srces));
  }
  return urls;
};

/**
 * Picks a URL from a `srces` map using an explicit `srcKey` or a random variant.
 */
export const pickSrcesUrl = (
  srces: Record<string, string>,
  srcKey?: string
): string | null => {
  if (srcKey !== undefined) {
    const url = srces[srcKey];
    if (!url) {
      console.warn(`Unknown srcKey "${srcKey}"`);
      return null;
    }
    return url;
  }

  const keys = Object.keys(srces);
  if (keys.length === 0) {
    return null;
  }

  const randomKey = keys[Math.floor(Math.random() * keys.length)];
  if (!randomKey) {
    return null;
  }
  return srces[randomKey] ?? null;
};

/**
 * Resolves the asset URL for a config and optional play payload.
 */
export const resolveAssetUrl = (
  config: SoundConfig,
  data?: unknown
): string | null => {
  if (config.src) {
    return config.src;
  }

  if (config.srces) {
    const srcKey =
      data && typeof data === "object" && "srcKey" in data
        ? (data as { srcKey?: string }).srcKey
        : undefined;
    return pickSrcesUrl(config.srces, srcKey);
  }

  return null;
};

/**
 * Resolves an {@link AudioBuffer} for playback using config-driven loading,
 * with an optional procedural / custom override.
 */
export const resolveSoundBuffer = async (
  audioContext: AudioContext,
  event: string,
  config: SoundConfig,
  resolveBuffer: ResolveBufferFn | undefined,
  onLoadError: OnLoadErrorFn | undefined,
  data?: unknown
): Promise<AudioBuffer | null> => {
  const url = resolveAssetUrl(config, data);

  if (url) {
    try {
      return await loadAudioBuffer(audioContext, url, url);
    } catch (error) {
      onLoadError?.(event, url, error);
      return null;
    }
  }

  if (config.srces) {
    return null;
  }

  if (resolveBuffer) {
    try {
      return await resolveBuffer(audioContext, event, data);
    } catch (error) {
      console.error(`Failed to resolve buffer for ${event}:`, error);
      return null;
    }
  }

  console.warn(`No audio source for event: ${event}`);
  return null;
};

/**
 * Preloads file-backed buffers for the given events (or all config keys when omitted).
 */
export const preloadSoundConfigs = async (
  audioContext: AudioContext,
  configs: Record<string, SoundConfig>,
  events: readonly string[] | undefined,
  onLoadError: OnLoadErrorFn | undefined
): Promise<void> => {
  const eventList = events ?? Object.keys(configs);
  const urlEntries = new Map<string, boolean>();

  for (const event of eventList) {
    const config = configs[event];
    if (!config) {
      continue;
    }
    const wantsPeakWarm = configRequestsNormalization(config);
    for (const url of collectUrlsFromConfig(config)) {
      urlEntries.set(url, urlEntries.get(url) || wantsPeakWarm);
    }
  }

  await Promise.all(
    [...urlEntries.entries()].map(async ([url, warmPeak]) => {
      try {
        const buffer = await loadAudioBuffer(audioContext, url, url);
        if (warmPeak) {
          warmBufferPeak(buffer);
        }
      } catch (error) {
        const event =
          eventList.find((e) => {
            const config = configs[e];
            return config && collectUrlsFromConfig(config).includes(url);
          }) ??
          eventList[0] ??
          "unknown";
        onLoadError?.(event, url, error);
      }
    })
  );
};
