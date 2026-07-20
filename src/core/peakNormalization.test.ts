import { describe, expect, it, vi } from "vitest";

import {
  DEFAULT_NORMALIZE_TARGET_PEAK,
  getBufferPeak,
  getNormalizationGain,
  getNormalizationGainForConfig,
  resolveNormalizeTarget,
  warmBufferPeak,
} from "./peakNormalization";

const createBuffer = (
  channelData: Float32Array[],
  overrides?: Partial<AudioBuffer>
): AudioBuffer =>
  ({
    numberOfChannels: channelData.length,
    length: channelData[0]?.length ?? 0,
    sampleRate: 44100,
    duration: (channelData[0]?.length ?? 0) / 44100,
    getChannelData: (channel: number) => channelData[channel],
    ...overrides,
  } as unknown as AudioBuffer);

describe("peakNormalization", () => {
  it("resolveNormalizeTarget returns default for true", () => {
    expect(resolveNormalizeTarget(true)).toBe(DEFAULT_NORMALIZE_TARGET_PEAK);
    expect(DEFAULT_NORMALIZE_TARGET_PEAK).toBeCloseTo(0.8913, 3);
  });

  it("resolveNormalizeTarget accepts custom targetPeak in (0, 1]", () => {
    expect(resolveNormalizeTarget({ targetPeak: 0.5 })).toBe(0.5);
    expect(resolveNormalizeTarget({ targetPeak: 1 })).toBe(1);
  });

  it("resolveNormalizeTarget rejects invalid targets", () => {
    expect(resolveNormalizeTarget(false)).toBeNull();
    expect(resolveNormalizeTarget(undefined)).toBeNull();
    expect(resolveNormalizeTarget({ targetPeak: 0 })).toBeNull();
    expect(resolveNormalizeTarget({ targetPeak: -0.1 })).toBeNull();
    expect(resolveNormalizeTarget({ targetPeak: 1.1 })).toBeNull();
    expect(resolveNormalizeTarget({ targetPeak: Number.NaN })).toBeNull();
    expect(
      resolveNormalizeTarget({ targetPeak: Number.POSITIVE_INFINITY })
    ).toBeNull();
  });

  it("getNormalizationGain attenuates peaks above target", () => {
    const buffer = createBuffer([new Float32Array([0.8, -0.4])]);
    expect(getNormalizationGain(buffer, 0.4)).toBeCloseTo(0.5);
  });

  it("getNormalizationGain boosts peaks below target", () => {
    const buffer = createBuffer([new Float32Array([0.2, -0.1])]);
    expect(getNormalizationGain(buffer, 0.8)).toBeCloseTo(4);
  });

  it("getNormalizationGain uses default target for normalize true configs", () => {
    const buffer = createBuffer([new Float32Array([1])]);
    const gain = getNormalizationGainForConfig(buffer, {
      category: "sfx",
      src: "/a.wav",
      normalize: true,
    });
    expect(gain).toBeCloseTo(DEFAULT_NORMALIZE_TARGET_PEAK);
  });

  it("getNormalizationGain uses louder channel in stereo buffers", () => {
    const buffer = createBuffer([
      new Float32Array([0.2, 0.2]),
      new Float32Array([0.8, -0.8]),
    ]);
    expect(getBufferPeak(buffer)).toBeCloseTo(0.8);
    expect(getNormalizationGain(buffer, 0.4)).toBeCloseTo(0.5);
  });

  it("returns unity gain for silence and near-silence", () => {
    const silent = createBuffer([new Float32Array([0, 0, 0])]);
    expect(getNormalizationGain(silent, 0.5)).toBe(1);
  });

  it("getNormalizationGainForConfig skips procedural configs", () => {
    const buffer = createBuffer([new Float32Array([1])]);
    expect(
      getNormalizationGainForConfig(buffer, {
        category: "sfx",
        normalize: true,
      })
    ).toBe(1);
  });

  it("caches peak measurement per buffer instance", () => {
    const getChannelData = vi.fn(() => new Float32Array([0.5]));
    const buffer = createBuffer([new Float32Array([0.5])], { getChannelData });

    expect(getBufferPeak(buffer)).toBe(0.5);
    expect(getBufferPeak(buffer)).toBe(0.5);
    expect(getChannelData).toHaveBeenCalledTimes(1);

    warmBufferPeak(buffer);
    expect(getChannelData).toHaveBeenCalledTimes(1);
  });
});
