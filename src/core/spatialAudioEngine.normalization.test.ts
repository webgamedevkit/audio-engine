import { afterEach, describe, expect, it, vi } from "vitest";

import { clearAudioBufferCache } from "./bufferLoader";
import { DEFAULT_NORMALIZE_TARGET_PEAK } from "./peakNormalization";
import { SpatialAudioEngine } from "./spatialAudioEngine";
import type { SoundConfig, VolumeState } from "../types";

type TestCategory = "sfx";

const volumeState: VolumeState<TestCategory> = {
  masterVolume: 100,
  categoryVolumes: { sfx: 100 },
  muted: false,
};

const createMockAudioContext = (bufferPeak = 0.5) => {
  const decodedBuffer = {
    duration: 0.1,
    length: 4,
    numberOfChannels: 1,
    sampleRate: 44100,
    getChannelData: () => new Float32Array([bufferPeak, bufferPeak * 0.5, 0, 0]),
  } as unknown as AudioBuffer;

  const gainNodes: Array<{ gain: { value: number } }> = [];

  const createGain = vi.fn(() => {
    const node = {
      gain: { value: 1 },
      connect: vi.fn(),
      disconnect: vi.fn(),
    };
    gainNodes.push(node);
    return node;
  });

  const createBufferSource = vi.fn(() => ({
    buffer: null as AudioBuffer | null,
    playbackRate: { value: 1 },
    loop: false,
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    onended: null as (() => void) | null,
  }));

  return {
    audioContext: {
      destination: { connect: vi.fn(), disconnect: vi.fn() },
      createGain,
      createBufferSource,
      createPanner: vi.fn(),
      decodeAudioData: vi.fn(async () => decodedBuffer),
    } as unknown as AudioContext,
    createGain,
    gainNodes,
    decodedBuffer,
  };
};

describe("SpatialAudioEngine normalization", () => {
  afterEach(() => {
    clearAudioBufferCache();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("applies normalization gain on play for file-backed configs", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        arrayBuffer: async () => new ArrayBuffer(8),
      }))
    );

    const soundConfigs = {
      footstep: {
        category: "sfx",
        src: "/foot.wav",
        spatial: false,
        normalize: true,
      },
    } as const satisfies Record<string, SoundConfig<TestCategory>>;

    const { audioContext, gainNodes } = createMockAudioContext(0.5);
    const engine = new SpatialAudioEngine<typeof soundConfigs, TestCategory>(
      audioContext,
      {
        soundConfigs,
        getVolumeState: () => volumeState,
      }
    );

    engine.setActivated(true);
    await engine.play("footstep");

    expect(gainNodes[0]?.gain.value).toBeCloseTo(
      DEFAULT_NORMALIZE_TARGET_PEAK / 0.5
    );
  });

  it("applyLiveVolumes preserves normalizationGain", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        arrayBuffer: async () => new ArrayBuffer(8),
      }))
    );

    const soundConfigs = {
      footstep: {
        category: "sfx",
        src: "/foot.wav",
        spatial: false,
        normalize: { targetPeak: 0.4 },
      },
    } as const satisfies Record<string, SoundConfig<TestCategory>>;

    const { audioContext, gainNodes } = createMockAudioContext(0.8);
    let state = volumeState;

    const engine = new SpatialAudioEngine<typeof soundConfigs, TestCategory>(
      audioContext,
      {
        soundConfigs,
        getVolumeState: () => state,
      }
    );

    engine.setActivated(true);
    await engine.play("footstep");

    const expectedNormalizedGain = 0.4 / 0.8;
    expect(gainNodes[0]?.gain.value).toBeCloseTo(expectedNormalizedGain);

    state = {
      masterVolume: 50,
      categoryVolumes: { sfx: 50 },
      muted: false,
    };
    engine.applyLiveVolumes();

    expect(gainNodes[0]?.gain.value).toBeCloseTo(0.25 * expectedNormalizedGain);
  });

  it("ignores normalize on procedural resolveBuffer configs", async () => {
    const soundConfigs = {
      synth: { category: "sfx", spatial: false, normalize: true },
    } as const satisfies Record<string, SoundConfig<TestCategory>>;

    const { audioContext, gainNodes } = createMockAudioContext(1);
    const engine = new SpatialAudioEngine<typeof soundConfigs, TestCategory>(
      audioContext,
      {
        soundConfigs,
        getVolumeState: () => volumeState,
        resolveBuffer: async () =>
          ({
            duration: 0.1,
            length: 1,
            numberOfChannels: 1,
            sampleRate: 44100,
            getChannelData: () => new Float32Array([1]),
          }) as unknown as AudioBuffer,
      }
    );

    engine.setActivated(true);
    await engine.play("synth");

    expect(gainNodes[0]?.gain.value).toBe(1);
  });
});
