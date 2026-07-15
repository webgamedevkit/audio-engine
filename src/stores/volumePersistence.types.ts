import type { VolumeState } from "../types";

/** Serializable volume snapshot written by persistence backends. */
export type VolumePersistedState<TCategory extends string = string> = Pick<
  VolumeState<TCategory>,
  "masterVolume" | "categoryVolumes" | "muted"
>;

/** Consumer-defined load/save contract for volume persistence. */
export type VolumePersistence<TCategory extends string = string> = {
  /** Unique id passed to Zustand persist (must be stable per store). */
  key: string;
  /** Return saved volumes, or `null` when nothing is stored yet. May be async. */
  load: () =>
    | VolumePersistedState<TCategory>
    | null
    | Promise<VolumePersistedState<TCategory> | null>;
  /** Called after each volume/mute change with the partialized snapshot. May be async. */
  save: (state: VolumePersistedState<TCategory>) => void | Promise<void>;
  /** Clears stored volumes. Used by Zustand `persist.clearStorage()`. May be async. */
  remove?: () => void | Promise<void>;
};
