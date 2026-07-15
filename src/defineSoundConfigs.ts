import type { SoundConfigMap, SoundConfigShape } from "./types";

const eventsUnion = <TEvents extends string>(): TEvents | undefined => undefined;

/**
 * Declares a typed map of event id → sound config.
 *
 * Pass the same `categories` tuple used with {@link createAudioVolumeStore}.
 * Category values and config keys are validated internally.
 *
 * When your `GameEvent` union is a strict superset of config keys, pass
 * `forEvents<GameEvent>()` as an optional third argument.
 *
 * @param categories - Readonly category tuple (`as const`).
 * @param configs - Event id → config map.
 *
 * @example
 * ```ts
 * type GameEvent = "explosion" | "ui_click";
 *
 * export const SOUND_CONFIGS = defineSoundConfigs(AUDIO_CATEGORIES, {
 *   explosion: { category: "sfx", src: "assets/explosion.wav" },
 *   ui_click: { category: "sfx", spatial: false, src: "assets/click.wav" },
 * });
 * ```
 */
export function defineSoundConfigs<
  const TCategories extends readonly string[],
  const TConfigs extends Record<string, SoundConfigShape<TCategories[number]>>,
  TEvents extends string = keyof TConfigs & string,
>(
  _categories: TCategories,
  configs: TConfigs & SoundConfigMap<TCategories, TEvents>,
  _events: ReturnType<typeof eventsUnion<TEvents>> = eventsUnion<TEvents>(),
): TConfigs {
  return configs;
}

/**
 * Optional third argument to {@link defineSoundConfigs} when `GameEvent` is a
 * strict superset of config keys and you need exhaustiveness checking.
 */
export const forEvents = eventsUnion;
