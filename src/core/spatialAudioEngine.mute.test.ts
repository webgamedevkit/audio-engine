import { describe, expect, it, vi } from "vitest";

import { SpatialAudioEngine } from "./spatialAudioEngine";
import type { VolumeState } from "../types";

type TestCategory = "sfx";

const soundConfigs = {
  click: { category: "sfx", spatial: false },
  explosion: { category: "sfx", spatial: false },
} as const;

const unmutedState: VolumeState<TestCategory> = {
  masterVolume: 50,
  categoryVolumes: { sfx: 50 },
  muted: false,
};

const createMockAudioContext = () => {
  const destination = { connect: vi.fn(), disconnect: vi.fn() };

  const createGain = vi.fn(() => ({
    gain: { value: 1 },
    connect: vi.fn(),
    disconnect: vi.fn(),
  }));

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

  const audioContext = {
    destination,
    createGain,
    createBufferSource,
    createPanner: vi.fn(),
  } as unknown as AudioContext;

  return { audioContext, createGain, createBufferSource };
};

const createEngine = (
  audioContext: AudioContext,
  getVolumeState: () => VolumeState<TestCategory>
) =>
  new SpatialAudioEngine<typeof soundConfigs, TestCategory>(audioContext, {
    soundConfigs,
    resolveBuffer: async () =>
      ({
        duration: 0.1,
        length: 100,
        numberOfChannels: 1,
        sampleRate: 44100,
        getChannelData: () => new Float32Array(100),
      }) as unknown as AudioBuffer,
    getVolumeState,
  });

describe("SpatialAudioEngine mute", () => {
  it("does not play when muted before buffer resolve", async () => {
    const { audioContext, createBufferSource } = createMockAudioContext();
    const engine = createEngine(audioContext, () => ({
      ...unmutedState,
      muted: true,
    }));

    engine.setActivated(true);
    await engine.play("click");

    expect(createBufferSource).not.toHaveBeenCalled();
  });

  it("does not play when muted after buffer resolve", async () => {
    const { audioContext, createBufferSource } = createMockAudioContext();
    let muted = false;

    const engine = createEngine(audioContext, () => ({
      ...unmutedState,
      muted,
    }));

    engine.setActivated(true);

    const playPromise = engine.play("click");
    muted = true;
    await playPromise;

    expect(createBufferSource).not.toHaveBeenCalled();
  });

  it("stops active sources when applyLiveVolumes runs while muted", async () => {
    const { audioContext, createBufferSource } = createMockAudioContext();
    let muted = false;

    const engine = createEngine(audioContext, () => ({
      ...unmutedState,
      muted,
    }));

    engine.setActivated(true);
    await engine.play("click");

    const source = createBufferSource.mock.results[0]?.value as {
      start: ReturnType<typeof vi.fn>;
      stop: ReturnType<typeof vi.fn>;
      disconnect: ReturnType<typeof vi.fn>;
    };

    expect(source.start).toHaveBeenCalled();

    muted = true;
    engine.applyLiveVolumes();

    expect(source.stop).toHaveBeenCalled();
    expect(source.disconnect).toHaveBeenCalled();
  });
});
