import { afterEach, describe, expect, it, vi } from "vitest";

import { clearAudioBufferCache, loadAudioBuffer } from "./bufferLoader";

const createMockAudioContext = () =>
  ({
    decodeAudioData: vi.fn(async (arrayBuffer: ArrayBuffer) => ({
      duration: 0.1,
      length: 100,
      numberOfChannels: 1,
      sampleRate: 44100,
      getChannelData: () => new Float32Array(100),
      _source: arrayBuffer,
    })),
  }) as unknown as AudioContext;

describe("loadAudioBuffer", () => {
  afterEach(() => {
    clearAudioBufferCache();
    vi.restoreAllMocks();
  });

  it("deduplicates concurrent loads for the same cache key", async () => {
    const audioContext = createMockAudioContext();
    const fetchMock = vi.fn(async () => ({
      arrayBuffer: async () => new ArrayBuffer(8),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const [first, second] = await Promise.all([
      loadAudioBuffer(audioContext, "/assets/a.wav"),
      loadAudioBuffer(audioContext, "/assets/a.wav"),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(first).toBe(second);
  });

  it("returns cached buffer without fetching again", async () => {
    const audioContext = createMockAudioContext();
    const fetchMock = vi.fn(async () => ({
      arrayBuffer: async () => new ArrayBuffer(8),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const first = await loadAudioBuffer(audioContext, "/assets/a.wav");
    const second = await loadAudioBuffer(audioContext, "/assets/a.wav");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(first).toBe(second);
  });
});
