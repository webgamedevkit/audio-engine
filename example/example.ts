import { defineSoundConfigs } from "../src/defineSoundConfigs";
import { SoundConfig, SoundConfigMap } from "../src/types";

const AUDIO_CATEGORIES = ["sfx", "music"] as const;

// export const SOUND_CONFIGS = defineSoundConfigs(AUDIO_CATEGORIES, {
//   explosion: {
//     category: "sfx",
//     src: "assets/explosion.wav",
//   },
//   ui_click: {
//     category: "sfx",
//     spatial: false,
//     src: "assets/click.wav",
//   },
// });

type GameEvent = "explosion" | "ui_click";
export const SOUND_CONFIGS_1 = defineSoundConfigs(AUDIO_CATEGORIES, {
  explosion: { category: "sfx", src: "assets/explosion.wav" },
  ui_click: { category: "sfx", spatial: false, src: "assets/click.wav" },
} satisfies SoundConfigMap<typeof AUDIO_CATEGORIES, GameEvent>);

export const SOUND_CONFIGS_2 = {
  explosion: {
    category: "sfx",
    src: "assets/explosion.wav",
  },
  ui_click: {
    category: "sfx",
    spatial: false,
    src: "assets/click.wav",
  },
} as const satisfies Record<
  GameEvent,
  SoundConfig<(typeof AUDIO_CATEGORIES)[number]>
>;
