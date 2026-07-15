import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { StoreApi, UseBoundStore } from "zustand";

import { MAX_VOLUME, MIN_VOLUME } from "../core/volume";
import type { VolumeState } from "../types";
import {
  categoriesMatch,
  toPersistStorage,
} from "./volumePersistence";
import type { VolumePersistence, VolumePersistedState } from "./volumePersistence.types";

/** Default volume when a category or master has no override. */
const DEFAULT_VOLUME = 50;

/**
 * Zustand store shape for category volumes, mute, and setters.
 * Extends {@link VolumeState} with mutation helpers (values clamped to {@link MIN_VOLUME}–{@link MAX_VOLUME}).
 *
 * @typeParam TCategory - Consumer-defined volume category string union.
 */
type AudioVolumeStore<TCategory extends string> = VolumeState<TCategory> & {
  /**
   * Sets the master volume (`0`–`100`, clamped).
   * @param volume - Desired master level.
   */
  setMasterVolume: (volume: number) => void;
  /**
   * Sets a category volume (`0`–`100`, clamped).
   * @param category - Category key from the configured tuple.
   * @param volume - Desired category level.
   */
  setCategoryVolume: (category: TCategory, volume: number) => void;
  /**
   * Forces muted / unmuted.
   * @param muted - `true` to silence all categories.
   */
  setMuted: (muted: boolean) => void;
  /** Toggles {@link VolumeState.muted}. */
  toggleMute: () => void;
};

/**
 * Options for {@link createAudioVolumeStore}.
 *
 * @typeParam TCategories - Readonly tuple of category name strings.
 */
type CreateAudioVolumeStoreOptions<TCategories extends readonly string[]> = {
  /**
   * Readonly category list (`as const`). Types for volumes and setters
   * are inferred from this tuple.
   */
  categories: TCategories;
  /**
   * Optional persistence config. Omit for an in-memory-only store.
   * Use {@link localStoragePersist} or a custom `{ key, load, save }` object.
   */
  persist?: VolumePersistence<TCategories[number]>;
  /**
   * Optional per-category default volumes.
   * Unspecified categories fall back to {@link DEFAULT_VOLUME}.
   */
  defaultCategoryVolumes?: Partial<Record<TCategories[number], number>>;
  /**
   * Optional initial master volume.
   * Falls back to {@link DEFAULT_VOLUME} when omitted.
   */
  defaultMasterVolume?: number;
};

/**
 * Clamps a volume to the inclusive {@link MIN_VOLUME}–{@link MAX_VOLUME} range.
 *
 * @param volume - Raw volume value from UI or persistence.
 */
const clampVolume = (volume: number) =>
  Math.max(MIN_VOLUME, Math.min(MAX_VOLUME, volume));

/**
 * Builds the initial `categoryVolumes` map from the category tuple and overrides.
 */
const buildCategoryVolumes = <TCategories extends readonly string[]>(
  categories: TCategories,
  overrides?: Partial<Record<TCategories[number], number>>
): Record<TCategories[number], number> => {
  const volumes = {} as Record<TCategories[number], number>;

  for (const category of categories) {
    volumes[category as TCategories[number]] =
      overrides?.[category as TCategories[number]] ?? DEFAULT_VOLUME;
  }

  return volumes;
};

const partializeVolumeState = <TCategory extends string>(
  state: AudioVolumeStore<TCategory>
): VolumePersistedState<TCategory> => ({
  masterVolume: state.masterVolume,
  categoryVolumes: state.categoryVolumes,
  muted: state.muted,
});

const mergePersistedVolumeState = <TCategory extends string>(
  persistedState: unknown,
  currentState: AudioVolumeStore<TCategory>,
  categories: readonly string[],
  initialCategoryVolumes: Record<TCategory, number>
): AudioVolumeStore<TCategory> => {
  const persisted = persistedState as
    | Partial<VolumePersistedState<TCategory>>
    | undefined;

  if (!persisted || !categoriesMatch(persisted.categoryVolumes, categories)) {
    return currentState;
  }

  return {
    ...currentState,
    ...persisted,
    categoryVolumes: {
      ...initialCategoryVolumes,
      ...persisted.categoryVolumes,
    },
  };
};

type AudioVolumeStoreHook<TCategory extends string> = UseBoundStore<
  StoreApi<AudioVolumeStore<TCategory>>
>;

type CreatedAudioVolumeStore<
  TCategory extends string,
  TCategories extends readonly string[]
> = AudioVolumeStoreHook<TCategory> & {
  categories: TCategories;
  initialCategoryVolumes: Record<TCategory, number>;
};

type PersistedAudioVolumeStore<
  TCategory extends string,
  TCategories extends readonly string[]
> = CreatedAudioVolumeStore<TCategory, TCategories> & {
  persist: {
    clearStorage: () => void;
    rehydrate: () => Promise<void> | void;
    hasHydrated: () => boolean;
  };
};

type CreateAudioVolumeStoreResult<
  TCategories extends readonly string[],
  TPersist extends VolumePersistence<TCategories[number]> | undefined
> = TPersist extends VolumePersistence<TCategories[number]>
  ? PersistedAudioVolumeStore<TCategories[number], TCategories>
  : CreatedAudioVolumeStore<TCategories[number], TCategories>;

/**
 * Creates a Zustand store for master / category volumes and mute.
 * Optionally persists via {@link VolumePersistence}.
 *
 * @param options - Category tuple, optional persistence, and default volumes.
 * @returns A Zustand hook store typed to the category tuple, with `.categories` attached.
 */
export function createAudioVolumeStore<
  TCategories extends readonly string[],
  TOptions extends CreateAudioVolumeStoreOptions<TCategories>
>(
  options: TOptions
): CreateAudioVolumeStoreResult<TCategories, TOptions["persist"]> {
  const {
    categories,
    persist: persistConfig,
    defaultCategoryVolumes,
    defaultMasterVolume = DEFAULT_VOLUME,
  } = options;
  type TCategory = TCategories[number];

  const initialCategoryVolumes = buildCategoryVolumes(
    categories,
    defaultCategoryVolumes
  );

  const storeExtras = {
    categories,
    initialCategoryVolumes,
  };

  const createState = (
    set: (
      partial:
        | Partial<AudioVolumeStore<TCategory>>
        | ((
            state: AudioVolumeStore<TCategory>
          ) => Partial<AudioVolumeStore<TCategory>>)
    ) => void
  ): AudioVolumeStore<TCategory> => ({
    masterVolume: defaultMasterVolume,
    categoryVolumes: initialCategoryVolumes,
    muted: false,

    setMasterVolume: (volume: number) => {
      set({ masterVolume: clampVolume(volume) });
    },

    setCategoryVolume: (category: TCategory, volume: number) => {
      set((state) => ({
        categoryVolumes: {
          ...state.categoryVolumes,
          [category]: clampVolume(volume),
        },
      }));
    },

    setMuted: (muted: boolean) => {
      set({ muted });
    },

    toggleMute: () => {
      set((state) => ({ muted: !state.muted }));
    },
  });

  if (persistConfig) {
    const store = create<AudioVolumeStore<TCategory>>()(
      persist((set) => createState(set), {
        name: persistConfig.key,
        storage: toPersistStorage(persistConfig, categories),
        partialize: partializeVolumeState,
        merge: (persistedState, currentState) =>
          mergePersistedVolumeState(
            persistedState,
            currentState,
            categories,
            initialCategoryVolumes
          ),
      })
    );

    return Object.assign(store, storeExtras) as CreateAudioVolumeStoreResult<
      TCategories,
      TOptions["persist"]
    >;
  }

  const store = create<AudioVolumeStore<TCategory>>()(createState);

  return Object.assign(store, storeExtras) as CreateAudioVolumeStoreResult<
    TCategories,
    TOptions["persist"]
  >;
}

export type { AudioVolumeStore };
