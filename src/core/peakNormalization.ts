import type { SoundConfig } from "../types";

/** Default peak target for `normalize: true` — approximately −1 dBFS. */
export const DEFAULT_NORMALIZE_TARGET_PEAK = 10 ** (-1 / 20);

type NormalizeConfig = boolean | { targetPeak: number } | undefined;

const peakCache = new WeakMap<AudioBuffer, number>();

/**
 * Parses a sound config's `normalize` field into a linear peak target, or `null` to skip.
 */
export const resolveNormalizeTarget = (
  normalize: NormalizeConfig
): number | null => {
  if (normalize === true) {
    return DEFAULT_NORMALIZE_TARGET_PEAK;
  }

  if (normalize && typeof normalize === "object") {
    const { targetPeak } = normalize;
    if (
      typeof targetPeak === "number" &&
      Number.isFinite(targetPeak) &&
      targetPeak > 0 &&
      targetPeak <= 1
    ) {
      return targetPeak;
    }
  }

  return null;
};

/** Whether the config loads audio from `src` / `srces` rather than `resolveBuffer`. */
export const isFileBackedSoundConfig = (config: SoundConfig): boolean =>
  Boolean(config.src ?? config.srces);

/** Whether normalization should run for this config. */
export const configRequestsNormalization = (config: SoundConfig): boolean =>
  isFileBackedSoundConfig(config) &&
  resolveNormalizeTarget(config.normalize) !== null;

const measureBufferPeak = (buffer: AudioBuffer): number => {
  let peak = 0;

  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const data = buffer.getChannelData(channel);
    for (const element of data) {
      const abs = Math.abs(element);
      if (abs > peak) {
        peak = abs;
      }
    }
  }

  return peak;
};

/**
 * Returns the absolute peak across all channels, scanning once per buffer instance.
 */
export const getBufferPeak = (buffer: AudioBuffer): number => {
  const cached = peakCache.get(buffer);
  if (cached !== undefined) {
    return cached;
  }

  const peak = measureBufferPeak(buffer);
  peakCache.set(buffer, peak);
  return peak;
};

/** Ensures the peak cache is populated for a decoded buffer (e.g. during preload). */
export const warmBufferPeak = (buffer: AudioBuffer): void => {
  getBufferPeak(buffer);
};

/**
 * Computes playback gain multiplier from a measured peak and target.
 * Silence or non-finite peaks resolve to unity gain.
 */
export const getNormalizationGain = (
  buffer: AudioBuffer,
  targetPeak: number
): number => {
  const measuredPeak = getBufferPeak(buffer);
  if (!Number.isFinite(measuredPeak) || measuredPeak === 0) {
    return 1;
  }

  return targetPeak / measuredPeak;
};

/**
 * Resolves normalization gain for a file-backed config, or `1` when normalization is off.
 */
export const getNormalizationGainForConfig = (
  buffer: AudioBuffer,
  config: SoundConfig
): number => {
  if (!isFileBackedSoundConfig(config)) {
    return 1;
  }

  const target = resolveNormalizeTarget(config.normalize);
  if (target === null) {
    return 1;
  }

  return getNormalizationGain(buffer, target);
};
