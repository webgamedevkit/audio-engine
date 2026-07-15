import { afterEach, describe, expect, it, vi } from "vitest";

import { clearAudioBufferCache } from "./bufferLoader";
import { SpatialAudioEngine } from "./spatialAudioEngine";
import type { SoundConfig, VolumeState } from "../types";

type TestCategory = "sfx";

const soundConfigs = {
  explosion: { category: "sfx", src: "/boom.wav", spatial: false },
  tower_shot: {
    category: "sfx",
    srces: { cannon: "/c.wav", laser: "/l.wav" },
    spatial: false,
  },
} as const satisfies Record<string, SoundConfig<TestCategory>>;

const volumeState: VolumeState<TestCategory> = {
  masterVolume: 100,
  categoryVolumes: { sfx: 100 },
  muted: false,
};

const createMockAudioContext = () => {
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

  return {
    audioContext: {
      destination: { connect: vi.fn(), disconnect: vi.fn() },
      createGain,
      createBufferSource,
      createPanner: vi.fn(),
      decodeAudioData: vi.fn(async () => ({
        duration: 0.1,
        length: 100,
        numberOfChannels: 1,
        sampleRate: 44100,
        getChannelData: () => new Float32Array(100),
      })),
    } as unknown as AudioContext,
    createBufferSource,
  };
};

describe("SpatialAudioEngine internal loading", () => {
  afterEach(() => {
    clearAudioBufferCache();
    vi.restoreAllMocks();
  });

  it("plays using config src without resolveBuffer", async () => {
    const fetchMock = vi.fn(async () => ({
      arrayBuffer: async () => new ArrayBuffer(8),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const { audioContext, createBufferSource } = createMockAudioContext();
    const engine = new SpatialAudioEngine<typeof soundConfigs, TestCategory>(
      audioContext,
      {
        soundConfigs,
        getVolumeState: () => volumeState,
      }
    );

    engine.setActivated(true);
    await engine.play("explosion");

    expect(fetchMock).toHaveBeenCalledWith("/boom.wav");
    expect(createBufferSource).toHaveBeenCalled();
  });

  it("plays srces variant via srcKey", async () => {
    const fetchMock = vi.fn(async (url: string) => ({
      arrayBuffer: async () => new ArrayBuffer(8),
      url,
    }));
    vi.stubGlobal("fetch", fetchMock);

    const { audioContext } = createMockAudioContext();
    const engine = new SpatialAudioEngine<typeof soundConfigs, TestCategory>(
      audioContext,
      {
        soundConfigs,
        getVolumeState: () => volumeState,
      }
    );

    engine.setActivated(true);
    await engine.play("tower_shot", { srcKey: "laser" });

    expect(fetchMock).toHaveBeenCalledWith("/l.wav");
  });

  it("preload warms cache so play does not fetch again", async () => {
    const fetchMock = vi.fn(async () => ({
      arrayBuffer: async () => new ArrayBuffer(8),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const { audioContext } = createMockAudioContext();
    const engine = new SpatialAudioEngine<typeof soundConfigs, TestCategory>(
      audioContext,
      {
        soundConfigs,
        getVolumeState: () => volumeState,
      }
    );

    await engine.preload(["explosion"]);
    fetchMock.mockClear();

    engine.setActivated(true);
    await engine.play("explosion");

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
