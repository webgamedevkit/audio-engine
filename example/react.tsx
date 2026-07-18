import { defineSoundConfigs } from "../src/defineSoundConfigs";
import { useSpatialAudioEngine } from "../src/react";
import { createAudioVolumeStore } from "../src/stores";

const AUDIO_CATEGORIES = ["sfx", "music"] as const;
const volumeStore = createAudioVolumeStore({
  categories: AUDIO_CATEGORIES,
});

type GameEvent = "explosion" | "ui_click";

export const SOUND_CONFIGS = defineSoundConfigs<GameEvent>(AUDIO_CATEGORIES, {
  explosion: {
    category: "sfx",
    src: "assets/explosion.wav",
  },
  ui_click: {
    category: "sfx",
    spatial: false,
    src: "assets/click.wav",
  },
});

export const React = () => {
  const { play } = useSpatialAudioEngine({
    soundConfigs: SOUND_CONFIGS,
    volumeStore,
  });

  return (
    <div>
      <h1>React</h1>
      <p>This is a React component</p>
      <button type="button" onClick={() => void play("explosion")}>
        Play explosion
      </button>
      <button type="button" onClick={() => void play("ui_click")}>
        Play click
      </button>
    </div>
  );
};
