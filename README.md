# @webgamedevkit/audio-engine

> **Beta — not for production.** This package is in early development (v0.x). APIs, behavior, and package structure may change without notice. Do not rely on it in production apps until a stable 1.0 release.

A small, typed Web Audio layer for games and 3D apps. Play sounds by event id, optionally spatialize them with HRTF when a world position is provided, and control loudness through master + category volumes that update live on playing sounds. The core engine is framework-agnostic; React and React Three Fiber helpers are included for typical setups.

## Install

```bash
npm install @webgamedevkit/audio-engine zustand
```

For React and R3F integrations, also install the optional peers:

```bash
npm install react @react-three/fiber three
```

## Quick start

### 1. Define a volume store

It provides you the volume values to control the categories you assigned plus the master volume value and mute toggle

```ts
// .../stores/audioStore.ts

import {
  createAudioVolumeStore,
  localStoragePersist,
} from "@webgamedevkit/audio-engine/stores";

// List of categories you want to have a separate volume value
const AUDIO_CATEGORIES = ["sfx", "music"] as const; 

export const useAudioStore = createAudioVolumeStore({
  categories: AUDIO_CATEGORIES,
  // Saves values to localStorage
  persist: localStoragePersist("my-app-audio-settings"), 
  defaultCategoryVolumes: { sfx: 50, music: 50 },
});
```

### 2. Sound configs

Declare audio assets directly on each sound config. 

```ts
// .../constants/audio.ts

import { defineSoundConfigs } from "@webgamedevkit/audio-engine";
import { AUDIO_CATEGORIES } from "../stores/audioStore"

// Provide your in-game events
type GameEvent = "explosion" | "ui_click" | "game_start";

export const SOUND_CONFIGS = defineSoundConfigs<GameEvent>(
  AUDIO_CATEGORIES,
  {
    explosion: {
      // Fully typed categories --> "sfx" | "music"
      category: "sfx",
      src: "assets/explosion.wav",
    },
    ui_click: {
      category: "sfx",
      // Configure if this sound should be spatial
      spatial: false,
      src: "assets/click.wav",
    },
    game_start: {
      category: "music",
      spatial: false,
      // You can specify multiple sources
      srces: {
        episode_1: "assets/main_theme.wav",
        episode_2: "assets/main_theme_alt.wav",
      },
    }
  },
);
```

### 3. Usage in React

```tsx
import { useSpatialAudioEngine } from "@webgamedevkit/audio-engine/react";
import { useAudioStore } from "../stores/audioStore"
import { SOUND_CONFIGS } from "../constants/audio";

const { play, preload, isReady } = useSpatialAudioEngine({
  audioStore: useAudioStore,
  soundConfigs: SOUND_CONFIGS,
  // A common callback for handling errors
  onLoadError: console.warn,
});

// ... Somewhere later ...
await play("ui_click");

await play(
  "explosion", 
  // Provide position for spatial sound
  { worldPosition: { x: 10, y: 0, z: 5 } } 
);
```

The hook creates an `AudioContext`, resumes it on the first user click / keydown / touch, and reapplies volumes whenever the store changes. `isReady` is `true` once the context is activated.

### 4. R3F listener (for spatial sounds)

Mount inside your `<Canvas>` so panners hear from the camera's point of view:

```tsx
import { AudioListenerSync } from "@webgamedevkit/audio-engine/r3f";

<Canvas>
  <AudioListenerSync />
  {/* scene … */}
</Canvas>;
```

## Variants (`srces` + `srcKey`)

For sounds with multiple samples, use `srces` and pass `srcKey` at play time. Omit `srcKey` to pick a random variant.

```ts
export const SOUND_CONFIGS = defineSoundConfigs(AUDIO_CATEGORIES, {
  tower_shot: {
    category: "sfx",
    srces: {
      cannon: "assets/cannon.wav",
      laser: "assets/laser.wav",
    },
  },
});

await play("tower_shot", {
  srcKey: "cannon", // typed as "cannon" | "laser"
  worldPosition: { x: 0, y: 0, z: 0 },
});
```

## Advanced

Optional patterns for less common setups.

### Peak gain normalization

Use `normalize` on file-backed configs to level inconsistent one-shot SFX without re-encoding or duplicating buffers. Skip it for music and long ambience loops — normalize those offline instead.

```ts
export const SOUND_CONFIGS = defineSoundConfigs(AUDIO_CATEGORIES, {
  footstep: {
    category: "sfx",
    src: "assets/footstep.wav",
    normalize: true, // default target: −1 dBFS
  },
  ui_tick: {
    category: "sfx",
    spatial: false,
    src: "assets/tick.wav",
    normalize: { targetPeak: 0.5 }, // custom linear peak in (0, 1]
  },
});
```

On first use, the engine scans the decoded `AudioBuffer` for the absolute peak across all channels and caches it. Playback gain is multiplied by `targetPeak / measuredPeak` (quiet clips boosted, hot clips attenuated). The decoded buffer is shared; only the gain differs per config/play.

Effective gain at play time: `(master / 100) × (category / 100) × normalizationGain`. `preload()` warms the peak cache when any config for that URL opts in, so the first gameplay `play` does not hitch.

| Config A | Config B | Peak scan | Playback gain |
|----------|----------|-----------|---------------|
| `normalize: true` | omitted | 1× (if A preloads/plays) | A scaled, B unity |
| `normalize: true` | `{ targetPeak: 0.5 }` | 1× | different gains, same peak |
| both omitted | — | 0× | both unity |

**Limitations:**

- **Peak ≠ loudness** — two sounds at the same peak can still feel very different; prefer offline LUFS for authored packs.
- **Boost side effects** — quiet assets get amplified (noise floor, hiss); overlapping boosted one-shots can clip; this is not a master limiter.
- **Main-thread cost** — peak scan is O(samples × channels) and synchronous; fine for short SFX, avoid on long loops.
- **Scope** — file-backed `src` / `srces` only; ignored for `resolveBuffer` / procedural sounds.
- **Not a substitute** for per-sound mix gain or bus compression/limiting.

### Procedural sounds

For synthetic or runtime-generated buffers, provide an optional `resolveBuffer` override. The engine uses it only for events without `src` / `srces`.

```ts
const PROCEDURAL_SOUND_CONFIGS = defineSoundConfigs(AUDIO_CATEGORIES, {
  explosion: { category: "sfx", src: "assets/explosion.wav" },
  ui_click: { category: "sfx", spatial: false, src: "assets/click.wav" },
  synth_click: { category: "sfx", spatial: false },
});

const { play } = useSpatialAudioEngine({
  soundConfigs: PROCEDURAL_SOUND_CONFIGS,
  audioStore: useAudioStore,
  resolveBuffer: async (ctx, event) => {
    if (event !== "synth_click") return null;

    const duration = 0.05;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      const t = i / ctx.sampleRate;
      data[i] = Math.sin(2 * Math.PI * 800 * t) * Math.exp(-t * 20) * 0.1;
    }
    return buffer;
  },
});
```

### Custom persistence / save files

Persistence is optional. Omit `persist` for an in-memory store, or supply your own load/save logic.

#### Built-in storage wrappers

```ts
import {
  createAudioVolumeStore,
  localStoragePersist,
  sessionStoragePersist,
  indexdbPersist,
} from "@webgamedevkit/audio-engine/stores";

createAudioVolumeStore({
  categories: AUDIO_CATEGORIES,
  persist: localStoragePersist("my-app-audio-settings"),
  // persist: sessionStoragePersist("my-app-audio-settings"),
  // persist: indexdbPersist("my-app-audio-settings"),
});
```

#### Custom `{ key, load, save }` (e.g. game save slot)

Your callbacks own where data lives. The store auto-saves on every volume/mute change:

```ts
import type { VolumePersistedState } from "@webgamedevkit/audio-engine/stores";

type AudioCategory = (typeof AUDIO_CATEGORIES)[number];

let saveData = { audio: null as VolumePersistedState<AudioCategory> | null };

export const useAudioStore = createAudioVolumeStore({
  categories: AUDIO_CATEGORIES,
  persist: {
    key: "game-audio",
    load: () => saveData.audio,
    save: (state) => {
      saveData.audio = state;
    },
  },
});

// On slot load:
saveData.audio = loadedSave.audio;
await useAudioStore.persist.rehydrate();
```

#### Manual serialize / hydrate (no auto-save)

When you only want to read/write volumes during explicit save/load:

```ts
import {
  createAudioVolumeStore,
  getVolumePersistedState,
  hydrateVolumeStore,
} from "@webgamedevkit/audio-engine/stores";

export const useAudioStore = createAudioVolumeStore({
  categories: AUDIO_CATEGORIES,
});

// On save:
gameSave.audio = getVolumePersistedState(useAudioStore);

// On load:
hydrateVolumeStore(
  useAudioStore,
  gameSave.audio,
  useAudioStore.categories,
  useAudioStore.initialCategoryVolumes
);
```

## Package exports

| Import path | Contents |
|---|---|
| `@webgamedevkit/audio-engine` | Core engine, types |
| `@webgamedevkit/audio-engine/stores` | Volume store, persistence helpers |
| `@webgamedevkit/audio-engine/react` | `useSpatialAudioEngine` hook |
| `@webgamedevkit/audio-engine/r3f` | `AudioListenerSync` component |

## Key behaviors

- **Internal loading** — File-backed sounds load from `src` / `srces` on the config. Buffers are cached and deduplicated across concurrent requests.
- **Spatial vs non-spatial** — A sound is spatial when `config.spatial !== false` and `data.worldPosition` is present. Otherwise it plays flat (a warning is logged if spatial was expected but position is missing).
- **Live volume** — Changing master, category, or mute in the store updates gain on all currently playing sounds. Store values use a `0`–`100` scale; effective gain is `(master / 100) × (category / 100)`, so defaults of `50`/`50` produce `0.25` linear gain and `100`/`100` produces unity (`1.0`).
- **Pitch variation** — One-shots get a random `playbackRate` unless `pitchVariation: false` or `loop: true`.
- **Peak normalization** — Opt-in `normalize` on file-backed configs scales playback gain from a cached peak scan (default −1 dBFS). This is not loudness matching or a limiter; best for short SFX, not long music loops.
- **Without React** — Instantiate `SpatialAudioEngine` directly, call `setActivated(true)` after a user gesture, and manage the `AudioContext` yourself.

## Development

```bash
npm install
npm run build
npm run typecheck
npm test
```

Use `npm run dev` to rebuild on file changes.
