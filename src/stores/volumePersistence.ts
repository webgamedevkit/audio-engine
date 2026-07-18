import type { PersistStorage } from "zustand/middleware";

import { MAX_VOLUME, MIN_VOLUME } from "../core/volume";
import type {
  VolumePersistence,
  VolumePersistedState,
} from "./volumePersistence.types";

const isValidVolume = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= MIN_VOLUME &&
  value <= MAX_VOLUME;

const hasValidSnapshotValues = (data: unknown): boolean => {
  if (!data || typeof data !== "object") {
    return false;
  }

  const record = data as Record<string, unknown>;

  if (record.masterVolume !== undefined && !isValidVolume(record.masterVolume)) {
    return false;
  }

  if (record.muted !== undefined && typeof record.muted !== "boolean") {
    return false;
  }

  if (record.categoryVolumes !== undefined) {
    if (
      typeof record.categoryVolumes !== "object" ||
      record.categoryVolumes === null
    ) {
      return false;
    }

    for (const value of Object.values(
      record.categoryVolumes as Record<string, unknown>
    )) {
      if (!isValidVolume(value)) {
        return false;
      }
    }
  }

  return true;
};

/** Validates a persisted volume snapshot before hydration or merge. */
export const validateVolumePersistedState = <TCategory extends string>(
  data: unknown,
  categories: readonly string[]
): Partial<VolumePersistedState<TCategory>> | null => {
  if (!data || typeof data !== "object") {
    return null;
  }

  const record = data as Record<string, unknown>;
  const result: Partial<VolumePersistedState<TCategory>> = {};

  if (record.masterVolume !== undefined) {
    if (!isValidVolume(record.masterVolume)) {
      return null;
    }
    result.masterVolume = record.masterVolume;
  }

  if (record.muted !== undefined) {
    if (typeof record.muted !== "boolean") {
      return null;
    }
    result.muted = record.muted;
  }

  if (record.categoryVolumes === undefined) {
    return null;
  }

  if (
    typeof record.categoryVolumes !== "object" ||
    record.categoryVolumes === null ||
    !categoriesMatch(record.categoryVolumes as Record<string, number>, categories)
  ) {
    return null;
  }

  const categoryVolumes = record.categoryVolumes as Record<string, unknown>;
  for (const category of categories) {
    if (!isValidVolume(categoryVolumes[category])) {
      return null;
    }
  }

  result.categoryVolumes = {
    ...categoryVolumes,
  } as Record<TCategory, number>;

  return result;
};

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
    const validated = validateVolumePersistedState<TCategory>(loaded, categories);

    if (!validated?.categoryVolumes) {
      return null;
    }

    return { state: validated as VolumePersistedState<TCategory> };
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
    categoryVolumes: {
      ...categoryVolumes,
    } as Record<TCategory, number>,
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
  const validated = validateVolumePersistedState<TCategory>(data, categories);
  if (!validated?.categoryVolumes) {
    return;
  }

  store.setState({
    ...(validated.masterVolume !== undefined
      ? { masterVolume: validated.masterVolume }
      : {}),
    categoryVolumes: {
      ...initialCategoryVolumes,
      ...validated.categoryVolumes,
    },
    ...(validated.muted !== undefined ? { muted: validated.muted } : {}),
  });
};

export const parsePersistedState = <TCategory extends string>(
  raw: string | null
): VolumePersistedState<TCategory> | null => {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!hasValidSnapshotValues(parsed)) {
      return null;
    }

    const record = parsed as Record<string, unknown>;
    if (
      record.categoryVolumes === undefined ||
      record.masterVolume === undefined ||
      record.muted === undefined
    ) {
      return null;
    }

    return parsed as VolumePersistedState<TCategory>;
  } catch {
    return null;
  }
};
