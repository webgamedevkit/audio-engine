import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createAudioVolumeStore } from "./createAudioVolumeStore";
import {
  getVolumePersistedState,
  hydrateVolumeStore,
} from "./volumePersistence";
import { localStoragePersist } from "./webStoragePersist";

const CATEGORIES = ["sfx", "music"] as const;
type TestCategory = (typeof CATEGORIES)[number];

describe("createAudioVolumeStore", () => {
  describe("without persist", () => {
    it("does not call save callbacks", () => {
      const save = vi.fn();

      const store = createAudioVolumeStore({
        categories: CATEGORIES,
        persist: undefined,
      });

      store.getState().setMasterVolume(80);

      expect(save).not.toHaveBeenCalled();
      expect(store.getState().masterVolume).toBe(80);
      expect("persist" in store).toBe(false);
    });

    it("resets to defaults on each new store instance", () => {
      const store = createAudioVolumeStore({
        categories: CATEGORIES,
        defaultMasterVolume: 70,
      });

      store.getState().setMasterVolume(10);
      expect(store.getState().masterVolume).toBe(10);

      const freshStore = createAudioVolumeStore({
        categories: CATEGORIES,
        defaultMasterVolume: 70,
      });

      expect(freshStore.getState().masterVolume).toBe(70);
    });
  });

  describe("with custom persist callbacks", () => {
    it("loads on init and saves on each change", async () => {
      let saved: ReturnType<
        typeof getVolumePersistedState<TestCategory>
      > | null = {
        masterVolume: 25,
        categoryVolumes: { sfx: 30, music: 40 },
        muted: true,
      };

      const store = createAudioVolumeStore({
        categories: CATEGORIES,
        persist: {
          key: "test-audio",
          load: () => saved,
          save: (state) => {
            saved = state;
          },
        },
      });

      await store.persist.rehydrate();

      expect(store.getState().masterVolume).toBe(25);
      expect(store.getState().categoryVolumes).toEqual({ sfx: 30, music: 40 });
      expect(store.getState().muted).toBe(true);

      store.getState().setMasterVolume(90);

      expect(saved).toEqual({
        masterVolume: 90,
        categoryVolumes: { sfx: 30, music: 40 },
        muted: true,
      });
    });

    it("ignores persisted data when categories do not match", async () => {
      const store = createAudioVolumeStore({
        categories: CATEGORIES,
        defaultMasterVolume: 55,
        persist: {
          key: "test-audio",
          load: () => ({
            masterVolume: 10,
            categoryVolumes: { sfx: 10, music: 10, voice: 10 } as Record<
              TestCategory,
              number
            > & { voice: number },
            muted: false,
          }),
          save: () => {},
        },
      });

      await store.persist.rehydrate();

      expect(store.getState().masterVolume).toBe(55);
      expect(store.getState().categoryVolumes).toEqual({ sfx: 50, music: 50 });
    });
  });

  describe("localStoragePersist", () => {
    const storage = new Map<string, string>();

    beforeEach(() => {
      storage.clear();
      vi.stubGlobal("localStorage", {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => {
          storage.set(key, value);
        },
        removeItem: (key: string) => {
          storage.delete(key);
        },
      });
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("round-trips volume state through localStorage", async () => {
      const store = createAudioVolumeStore({
        categories: CATEGORIES,
        persist: localStoragePersist("my-app-audio"),
      });

      await store.persist.rehydrate();

      store.getState().setCategoryVolume("sfx", 88);
      store.getState().setMuted(true);

      const reloaded = createAudioVolumeStore({
        categories: CATEGORIES,
        persist: localStoragePersist("my-app-audio"),
      });

      await reloaded.persist.rehydrate();

      expect(reloaded.getState().categoryVolumes.sfx).toBe(88);
      expect(reloaded.getState().muted).toBe(true);
    });
  });
});

describe("getVolumePersistedState", () => {
  it("returns the current serializable snapshot", () => {
    const store = createAudioVolumeStore({ categories: CATEGORIES });

    store.getState().setMasterVolume(42);
    store.getState().toggleMute();

    expect(getVolumePersistedState(store)).toEqual({
      masterVolume: 42,
      categoryVolumes: { sfx: 50, music: 50 },
      muted: true,
    });
  });
});

describe("hydrateVolumeStore", () => {
  it("applies persisted data with the same merge rules as persist middleware", () => {
    const store = createAudioVolumeStore({
      categories: CATEGORIES,
      defaultCategoryVolumes: { sfx: 60, music: 70 },
    });

    hydrateVolumeStore(
      store,
      {
        masterVolume: 15,
        categoryVolumes: { sfx: 20, music: 70 },
        muted: true,
      },
      CATEGORIES,
      store.initialCategoryVolumes
    );

    expect(store.getState()).toMatchObject({
      masterVolume: 15,
      categoryVolumes: { sfx: 20, music: 70 },
      muted: true,
    });
  });

  it("ignores data when categories do not match", () => {
    const store = createAudioVolumeStore({
      categories: CATEGORIES,
      defaultMasterVolume: 80,
    });

    hydrateVolumeStore(
      store,
      {
        masterVolume: 10,
        categoryVolumes: { sfx: 10 } as unknown as Record<TestCategory, number>,
        muted: true,
      },
      CATEGORIES,
      store.initialCategoryVolumes
    );

    expect(store.getState().masterVolume).toBe(80);
    expect(store.getState().muted).toBe(false);
  });
});
