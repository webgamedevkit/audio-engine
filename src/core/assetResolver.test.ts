import { afterEach, describe, expect, it, vi } from "vitest";

import {
  collectUrlsFromConfig,
  pickSrcesUrl,
  preloadSoundConfigs,
  resolveAssetUrl,
  resolveSoundBuffer,
} from "./assetResolver";
import { clearAudioBufferCache } from "./bufferLoader";
import type { SoundConfig } from "../types";

const createMockAudioContext = () =>
  ({
    decodeAudioData: vi.fn(async () => ({
      duration: 0.1,
      length: 100,
      numberOfChannels: 1,
      sampleRate: 44100,
      getChannelData: () => new Float32Array(100),
    })),
  }) as unknown as AudioContext;

const mockBuffer = {
  duration: 0.1,
  length: 100,
  numberOfChannels: 1,
  sampleRate: 44100,
  getChannelData: () => new Float32Array(100),
} as unknown as AudioBuffer;

describe("assetResolver", () => {
  afterEach(() => {
    clearAudioBufferCache();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("collectUrlsFromConfig gathers src and all srces values", () => {
    const config: SoundConfig = {
      category: "sfx",
      src: "/single.wav",
      srces: { a: "/a.wav", b: "/b.wav" },
    };

    expect(collectUrlsFromConfig(config)).toEqual([
      "/single.wav",
      "/a.wav",
      "/b.wav",
    ]);
  });

  it("resolveAssetUrl returns src when present", () => {
    expect(
      resolveAssetUrl({ category: "sfx", src: "/boom.wav" })
    ).toBe("/boom.wav");
  });

  it("resolveAssetUrl returns srces entry for srcKey", () => {
    expect(
      resolveAssetUrl(
        { category: "sfx", srces: { cannon: "/c.wav", laser: "/l.wav" } },
        { srcKey: "laser" }
      )
    ).toBe("/l.wav");
  });

  it("pickSrcesUrl returns null for unknown srcKey", () => {
    expect(
      pickSrcesUrl({ cannon: "/c.wav" }, "missing")
    ).toBeNull();
  });

  it("resolveSoundBuffer loads file-backed src", async () => {
    const audioContext = createMockAudioContext();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        arrayBuffer: async () => new ArrayBuffer(8),
      }))
    );

    const buffer = await resolveSoundBuffer(
      audioContext,
      "explosion",
      { category: "sfx", src: "/boom.wav" },
      undefined,
      undefined,
      undefined
    );

    expect(buffer).not.toBeNull();
  });

  it("resolveSoundBuffer falls back to resolveBuffer override", async () => {
    const audioContext = createMockAudioContext();
    const override = vi.fn(async () => mockBuffer);

    const buffer = await resolveSoundBuffer(
      audioContext,
      "ui_click",
      { category: "sfx", spatial: false },
      override,
      undefined,
      undefined
    );

    expect(override).toHaveBeenCalledWith(
      audioContext,
      "ui_click",
      undefined
    );
    expect(buffer).toBe(mockBuffer);
  });

  it("resolveSoundBuffer calls onLoadError when fetch fails", async () => {
    const audioContext = createMockAudioContext();
    const onLoadError = vi.fn();
    const networkError = new Error("network");
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(networkError)));

    const buffer = await resolveSoundBuffer(
      audioContext,
      "explosion",
      { category: "sfx", src: "/boom.wav" },
      undefined,
      onLoadError,
      undefined
    );

    expect(buffer).toBeNull();
    expect(onLoadError).toHaveBeenCalledWith(
      "explosion",
      "/boom.wav",
      networkError
    );
  });

  it("preloadSoundConfigs loads all urls for selected events", async () => {
    const audioContext = createMockAudioContext();
    const fetchMock = vi.fn(async () => ({
      arrayBuffer: async () => new ArrayBuffer(8),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const configs = {
      explosion: { category: "sfx", src: "/boom.wav" },
      tower_shot: {
        category: "sfx",
        srces: { cannon: "/c.wav", laser: "/l.wav" },
      },
      ui_click: { category: "sfx", spatial: false },
    } satisfies Record<string, SoundConfig>;

    await preloadSoundConfigs(
      audioContext,
      configs,
      ["explosion", "tower_shot"],
      undefined
    );

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
