import { useCallback, useEffect, useRef } from "react";

import { setAudioContext } from "../context/audioContextRegistry";
import { SpatialAudioEngine } from "../core/spatialAudioEngine";
import { toVolumeState } from "../core/volume";
import type {
  PlayPayloadForEvent,
  SoundConfig,
  SpatialAudioEngineOptions,
  VolumeStoreApi,
} from "../types";

/**
 * Options for {@link useSpatialAudioEngine}.
 */
type UseSpatialAudioEngineOptions<
  TConfigs extends Record<string, SoundConfig<TCategory>>,
  TCategory extends string = string,
> = {
  /** Map of event id → {@link SoundConfig} passed to the engine. */
  soundConfigs: TConfigs;
  /** Optional buffer override for events without `src` / `srces`. */
  resolveBuffer?: SpatialAudioEngineOptions<TConfigs, TCategory>["resolveBuffer"];
  /**
   * Volume store API (`getState` + `subscribe`).
   * Used internally for play-time gain and live updates on currently playing sounds.
   */
  volumeStore: VolumeStoreApi<TCategory>;
  /** Called when a file-backed buffer fails to load or decode. */
  onLoadError?: SpatialAudioEngineOptions<TConfigs, TCategory>["onLoadError"];
};

/**
 * Return value of {@link useSpatialAudioEngine}.
 *
 * @typeParam TConfigs - Map of event id → {@link SoundConfig}.
 */
type UseSpatialAudioEngineResult<
  TConfigs extends Record<string, SoundConfig>,
> = {
  /**
   * Plays a configured event through the live engine (no-op before activation / after unmount).
   *
   * @param event - Event id present in `soundConfigs`.
   * @param data - Optional payload for buffer resolution and spatial `worldPosition`.
   */
  play: <E extends keyof TConfigs & string>(
    event: E,
    data?: PlayPayloadForEvent<TConfigs, E>
  ) => Promise<void>;
  /**
   * Preloads file-backed buffers. Omit `events` to preload every key in `soundConfigs`.
   */
  preload: (events?: readonly (keyof TConfigs & string)[]) => Promise<void>;
  /**
   * `true` when the AudioContext exists and has been activated
   * (already running, or resumed after a user gesture).
   */
  isReady: boolean;
};

/**
 * Creates a browser {@link AudioContext}, preferring the standard constructor
 * and falling back to legacy `webkitAudioContext` when needed.
 *
 * @throws If neither constructor is available.
 */
const createBrowserAudioContext = (): AudioContext => {
  const AudioContextCtor =
    window.AudioContext ||
    ("webkitAudioContext" in window
      ? (window.webkitAudioContext as typeof AudioContext)
      : undefined);

  if (!AudioContextCtor) {
    throw new Error("Web Audio API is not supported in this browser");
  }

  return new AudioContextCtor();
};

/**
 * React lifecycle wrapper around {@link SpatialAudioEngine}.
 *
 * Creates and closes an {@link AudioContext}, registers it via
 * {@link setAudioContext} for listener sync, resumes on first user gesture when
 * suspended, and reapplies live volumes whenever {@link VolumeStoreApi} changes.
 *
 * @typeParam TConfigs - Map of event id → {@link SoundConfig}.
 * @typeParam TCategory - Consumer-defined volume category string union.
 * @param options - Engine wiring and volume store.
 * @returns Stable `play` / `preload` callbacks and readiness flag.
 */
export const useSpatialAudioEngine = <
  const TConfigs extends Record<string, SoundConfig<TCategory>>,
  TCategory extends string = string,
>({
  soundConfigs,
  resolveBuffer,
  volumeStore,
  onLoadError,
}: UseSpatialAudioEngineOptions<
  TConfigs,
  TCategory
>): UseSpatialAudioEngineResult<TConfigs> => {
  const engineRef = useRef<SpatialAudioEngine<TConfigs, TCategory> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const isActivatedRef = useRef(false);
  const volumeStoreRef = useRef(volumeStore);
  volumeStoreRef.current = volumeStore;

  useEffect(() => {
    let audioContext: AudioContext;

    try {
      audioContext = createBrowserAudioContext();
    } catch (error) {
      console.error("Failed to initialize audio context:", error);
      return;
    }

    audioContextRef.current = audioContext;
    setAudioContext(audioContext);

    const engine = new SpatialAudioEngine(audioContext, {
      soundConfigs,
      resolveBuffer,
      onLoadError,
      getVolumeState: () =>
        toVolumeState(volumeStoreRef.current.getState()),
    });
    engineRef.current = engine;

    const unsubscribeVolume = volumeStore.subscribe(() => {
      engine.applyLiveVolumes();
    });
    engine.applyLiveVolumes();

    if (audioContext.state === "suspended") {
      const activateAudio = async () => {
        try {
          await audioContext.resume();
          isActivatedRef.current = true;
          engine.setActivated(true);
        } catch (error) {
          console.warn("Could not activate audio context:", error);
        }
      };

      const handleInteraction = () => {
        void activateAudio();
        document.removeEventListener("click", handleInteraction);
        document.removeEventListener("keydown", handleInteraction);
        document.removeEventListener("touchstart", handleInteraction);
      };

      document.addEventListener("click", handleInteraction, { once: true });
      document.addEventListener("keydown", handleInteraction, { once: true });
      document.addEventListener("touchstart", handleInteraction, {
        once: true,
      });
    } else {
      isActivatedRef.current = true;
      engine.setActivated(true);
    }

    return () => {
      unsubscribeVolume();
      engine.dispose();
      engineRef.current = null;
      setAudioContext(null);
      audioContextRef.current = null;

      if (audioContext.state !== "closed") {
        audioContext.close().catch(console.error);
      }
    };
  }, [soundConfigs, resolveBuffer, volumeStore, onLoadError]);

  const play = useCallback(
    async <E extends keyof TConfigs & string>(
      event: E,
      data?: PlayPayloadForEvent<TConfigs, E>
    ) => {
      await engineRef.current?.play(event, data);
    },
    []
  );

  const preload = useCallback(
    async (events?: readonly (keyof TConfigs & string)[]) => {
      await engineRef.current?.preload(events);
    },
    []
  );

  return {
    play,
    preload,
    isReady: isActivatedRef.current && audioContextRef.current !== null,
  };
};
