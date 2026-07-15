import type { PersistStorage } from "zustand/middleware";

import type {
  VolumePersistence,
  VolumePersistedState,
} from "./volumePersistence.types";

/**
 * True when persisted category keys match the configured category list
 * (same set of names, ignoring order).
 */
export const categoriesMatch = (
  persisted: Record<string, number> | undefined,
  categories: readonly string[]
): boolean => {
  if (!persisted || typeof persisted !== "object") {
    return false;
  }

  const persistedKeys = Object.keys(persisted).sort((a, b) =>
    a.localeCompare(b)
  );
  const configuredKeys = [...categories].sort((a, b) => a.localeCompare(b));

  if (persistedKeys.length !== configuredKeys.length) {
    return false;
  }

  return persistedKeys.every((key, index) => key === configuredKeys[index]);
};

/** Adapts {@link VolumePersistence} to Zustand's `PersistStorage` interface. */
export const toPersistStorage = <TCategory extends string>(
  persist: VolumePersistence<TCategory>,
  categories: readonly string[]
): PersistStorage<VolumePersistedState<TCategory>> => ({
  getItem: async () => {
    const loaded = await persist.load();

    if (!loaded || !categoriesMatch(loaded.categoryVolumes, categories)) {
      return null;
    }

    return { state: loaded };
  },
  setItem: async (_name, value) => {
    await persist.save(value.state);
  },
  removeItem: async () => {
    await persist.remove?.();
  },
});

type VolumeStoreReader = {
  getState: () => VolumePersistedState<string> & Record<string, unknown>;
};

type VolumeStoreWriter<TCategory extends string> = {
  setState: (
    partial:
      | Partial<VolumePersistedState<TCategory>>
      | ((
          state: VolumePersistedState<TCategory>
        ) => Partial<VolumePersistedState<TCategory>>)
  ) => void;
};

/** Reads the current serializable volume snapshot from a store. */
export const getVolumePersistedState = <TCategory extends string>(
  store: VolumeStoreReader
): VolumePersistedState<TCategory> => {
  const { masterVolume, categoryVolumes, muted } = store.getState();
  return {
    masterVolume,
    categoryVolumes: categoryVolumes as Record<TCategory, number>,
    muted,
  };
};

/**
 * Applies a persisted snapshot to a store using the same merge rules as
 * {@link createAudioVolumeStore}'s persist middleware.
 */
export const hydrateVolumeStore = <TCategory extends string>(
  store: VolumeStoreWriter<TCategory>,
  data: Partial<VolumePersistedState<TCategory>> | null | undefined,
  categories: readonly TCategory[],
  initialCategoryVolumes: Record<TCategory, number>
): void => {
  if (!data || !categoriesMatch(data.categoryVolumes, categories)) {
    return;
  }

  store.setState({
    ...(data.masterVolume !== undefined
      ? { masterVolume: data.masterVolume }
      : {}),
    categoryVolumes: {
      ...initialCategoryVolumes,
      ...data.categoryVolumes,
    },
    ...(data.muted !== undefined ? { muted: data.muted } : {}),
  });
};

export const parsePersistedState = <TCategory extends string>(
  raw: string | null
): VolumePersistedState<TCategory> | null => {
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as VolumePersistedState<TCategory>;
  } catch {
    return null;
  }
};
