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
import { defineSoundConfigs, forEvents } from "@webgamedevkit/audio-engine";

type GameEvent = "explosion" | "ui_click";

export const SOUND_CONFIGS = defineSoundConfigs(
  AUDIO_CATEGORIES,
  {
    explosion: {
      category: "sfx",
      src: "assets/explosion.wav",
    },
    ui_click: {
      category: "sfx",
      spatial: false,
      src: "assets/click.wav",
    },
  },
  forEvents<GameEvent>()
);
```

### 3. React hook

```tsx
import { useSpatialAudioEngine } from "@webgamedevkit/audio-engine/react";

const { play, preload, isReady } = useSpatialAudioEngine({
  soundConfigs: SOUND_CONFIGS,
  volumeStore: useAudioStore,
  // A common callback for handling errors
  onLoadError: console.warn,
});

// Optional: warm caches on a loading screen
await preload(["explosion"]);
// or `await preload()` to preload every configured asset

// Spatial SFX at a world point
await play("explosion", { worldPosition: { x: 10, y: 0, z: 5 } });

// Non-spatial UI sound
await play("ui_click");
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

## Advanced: procedural sounds

For synthetic or runtime-generated buffers, provide an optional `resolveBuffer` override. The engine uses it only for events without `src` / `srces`.

```ts
const PROCEDURAL_SOUND_CONFIGS = defineSoundConfigs(AUDIO_CATEGORIES, {
  explosion: { category: "sfx", src: "assets/explosion.wav" },
  ui_click: { category: "sfx", spatial: false, src: "assets/click.wav" },
  synth_click: { category: "sfx", spatial: false },
});

const { play } = useSpatialAudioEngine({
  soundConfigs: PROCEDURAL_SOUND_CONFIGS,
  volumeStore: useAudioStore,
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

## Custom persistence / save files

Persistence is optional. Omit `persist` for an in-memory store, or supply your own load/save logic.

### Built-in storage wrappers

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

### Custom `{ key, load, save }` (e.g. game save slot)

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

### Manual serialize / hydrate (no auto-save)

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
- **Live volume** — Changing master, category, or mute in the store updates gain on all currently playing sounds.
- **Pitch variation** — One-shots get a random `playbackRate` unless `pitchVariation: false` or `loop: true`.
- **Without React** — Instantiate `SpatialAudioEngine` directly, call `setActivated(true)` after a user gesture, and manage the `AudioContext` yourself.

## Development

```bash
npm install
npm run build
npm run typecheck
npm test
```

Use `npm run dev` to rebuild on file changes.
