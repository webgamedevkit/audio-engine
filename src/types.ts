/**
 * XYZ position in world space, used for spatial sound placement and listener orientation.
 */
export type WorldPosition = {
  /** World-space X coordinate. */
  x: number;
  /** World-space Y coordinate. */
  y: number;
  /** World-space Z coordinate. */
  z: number;
};

/** Resolves a category union from a readonly tuple. */
type CategoryUnion<T extends readonly string[]> = T[number];

/**
 * Single sound config entry shape.
 *
 * @typeParam TCategory - Consumer-defined volume category string union.
 */
export type SoundConfigShape<TCategory extends string = string> = {
  /** Volume channel this sound contributes to. */
  category: TCategory;
  /**
   * When `false`, the sound bypasses HRTF spatialization (UI / screen feedback).
   * Defaults to spatial when omitted and a `worldPosition` is present on the play payload.
   */
  spatial?: boolean;
  /** When `true`, the buffer source loops until stopped or the engine is disposed. */
  loop?: boolean;
  /** Planned fade-in duration in seconds (reserved for future use). */
  fadeIn?: number;
  /** Planned fade-out duration in seconds (reserved for future use). */
  fadeOut?: number;
  /** Single audio file URL for this event. */
  src?: string;
  /**
   * Optional map of variant name → audio file URL.
   * Pick a variant via `srcKey` on the play payload (e.g. tower type → shot sample).
   */
  srces?: Record<string, string>;
  /**
   * When `false`, playback rate stays `1`.
   * Ignored for looping sounds; defaults to enabled pitch variation when omitted.
   */
  pitchVariation?: boolean;
  /**
   * Half-range around `1.0` for randomized `playbackRate`
   * (e.g. `0.05` → about `0.95`–`1.05`).
   */
  pitchSpread?: number;
};

/**
 * Map of event id → sound config for a fixed category tuple and event union.
 */
export type SoundConfigMap<
  TCategories extends readonly string[],
  TEvents extends string
> = Record<TEvents, SoundConfigShape<CategoryUnion<TCategories>>>;

/**
 * Per-event playback configuration consumed by the spatial audio engine.
 *
 * - One type argument → single config entry (`SoundConfigShape`).
 * - Two type arguments → full event map for {@link defineSoundConfigs}.
 *
 * @typeParam TCategories - Category tuple (`typeof AUDIO_CATEGORIES`) or category union.
 * @typeParam TEvents - When provided, types a full event map. Omit for a single config entry.
 */
export type SoundConfig<
  TCategories extends readonly string[] | string = string,
  TEvents extends string = never
> = [TEvents] extends [never]
  ? TCategories extends readonly string[]
    ? SoundConfigShape<CategoryUnion<TCategories>>
    : SoundConfigShape<TCategories & string>
  : TCategories extends readonly string[]
  ? SoundConfigMap<TCategories, TEvents>
  : Record<TEvents, SoundConfigShape<TCategories & string>>;

/** Extracts literal variant keys from a config's `srces` map. */
type SrcKeysOf<C> = C extends { srces: infer S }
  ? S extends Record<string, string>
    ? keyof S & string
    : never
  : never;

/**
 * Play payload shape for a single sound config.
 * `srcKey` is only present when the config defines `srces`.
 */
export type PlayPayloadForConfig<C extends SoundConfigShape> = {
  worldPosition?: WorldPosition;
} & (SrcKeysOf<C> extends never
  ? { srcKey?: never }
  : { srcKey?: SrcKeysOf<C> });

/**
 * Play payload for a specific event, given the full configs map.
 */
export type PlayPayloadForEvent<
  TConfigs extends Record<string, SoundConfigShape>,
  TEvent extends keyof TConfigs & string
> = PlayPayloadForConfig<TConfigs[TEvent]>;

/**
 * Snapshot of user-facing volume controls used when computing effective gain.
 * Values are typically `0`–`100` except `muted`.
 *
 * @typeParam TCategory - Consumer-defined volume category string union.
 */
export type VolumeState<TCategory extends string = string> = {
  /** Global multiplier applied on top of every category. */
  masterVolume: number;
  /** Per-category volume levels (`0`–`100`). */
  categoryVolumes: Record<TCategory, number>;
  /** When `true`, all category volumes resolve to silence. */
  muted: boolean;
};

/**
 * Minimal store surface the React hook needs to read volumes and react to changes.
 * Matches Zustand’s `getState` / `subscribe` (e.g. from {@link createAudioVolumeStore}).
 *
 * @typeParam TCategory - Consumer-defined volume category string union.
 */
export type VolumeStoreApi<TCategory extends string = string> = {
  /** Returns the latest volume / mute snapshot. */
  getState: () => VolumeState<TCategory>;
  /**
   * Subscribes to store updates; return value unsubscribes.
   *
   * @param listener - Called after any store change (volumes, mute, etc.).
   */
  subscribe: (listener: () => void) => () => void;
};

/**
 * Construction options for a typed {@link SpatialAudioEngine}.
 *
 * @typeParam TConfigs - Map of event id → {@link SoundConfig} (use {@link defineSoundConfigs} for typed `srcKey`).
 * @typeParam TCategory - Consumer-defined volume category string union.
 */
export type SpatialAudioEngineOptions<
  TConfigs extends Record<string, SoundConfigShape<TCategory>>,
  TCategory extends string = string
> = {
  /** Map of every playable event id to its {@link SoundConfig}. */
  soundConfigs: TConfigs;
  /**
   * Optional override for events without `src` / `srces` (procedural or custom buffers).
   * Return `null` to skip playback.
   *
   * @param ctx - Active Web Audio context used for decoding / synthesis.
   * @param event - Event id being played.
   * @param data - Optional caller payload (may include `worldPosition`, `srcKey`, etc.).
   */
  resolveBuffer?: (
    ctx: AudioContext,
    event: keyof TConfigs & string,
    data?: unknown
  ) => Promise<AudioBuffer | null>;
  /**
   * Returns the latest volume / mute snapshot.
   * Called at play time and when live volumes are reapplied.
   */
  getVolumeState: () => VolumeState<TCategory>;
  /**
   * Called when a file-backed buffer fails to load or decode.
   * Playback is skipped silently when this fires.
   */
  onLoadError?: (
    event: keyof TConfigs & string,
    url: string,
    error: unknown
  ) => void;
};

/**
 * Listener pose for Web Audio spatialization (position + orthonormal axes).
 */
export type ListenerOrientation = {
  /** Listener world position (usually camera / player). */
  position: WorldPosition;
  /** Unit vector the listener faces (camera look direction). */
  forward: WorldPosition;
  /** Unit vector pointing “up” for the listener. */
  up: WorldPosition;
};
