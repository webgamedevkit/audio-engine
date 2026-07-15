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

### 1. Volume store

```ts
import { createAudioVolumeStore } from "@webgamedevkit/audio-engine/stores";

const AUDIO_CATEGORIES = ["sfx", "music"] as const;

export const useAudioStore = createAudioVolumeStore({
  persistKey: "my-app-audio-settings",
  categories: AUDIO_CATEGORIES,
  defaultCategoryVolumes: { sfx: 50, music: 50 },
});
```

### 2. Sound configs

Declare audio assets directly on each sound config. Use `as const satisfies` so `srcKey` variants are typed at compile time.

```ts
import type { SoundConfig } from "@webgamedevkit/audio-engine";

type SoundEvent = "explosion" | "ui_click";
type AudioCategory = (typeof AUDIO_CATEGORIES)[number];

export const SOUND_CONFIGS = {
  explosion: {
    category: "sfx",
    volume: 70,
    src: "assets/explosion.wav",
  },
  ui_click: {
    category: "sfx",
    volume: 50,
    spatial: false,
    src: "assets/click.wav",
  },
} as const satisfies Record<SoundEvent, SoundConfig<AudioCategory>>;
```

### 3. React hook

```tsx
import { useSpatialAudioEngine } from "@webgamedevkit/audio-engine/react";

const { play, preload, isReady } = useSpatialAudioEngine({
  soundConfigs: SOUND_CONFIGS,
  volumeStore: useAudioStore,
  onLoadError: (event, url, err) => console.warn(event, url, err),
});

// Optional: warm caches on a loading screen
await preload(["explosion"]);
// or await preload() to preload every configured asset

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
export const SOUND_CONFIGS = {
  tower_shot: {
    category: "sfx",
    srces: {
      cannon: "assets/cannon.wav",
      laser: "assets/laser.wav",
    },
  },
} as const satisfies Record<"tower_shot", SoundConfig<AudioCategory>>;

await play("tower_shot", {
  srcKey: "cannon", // typed as "cannon" | "laser"
  worldPosition: { x: 0, y: 0, z: 0 },
});
```

## Advanced: procedural sounds

For synthetic or runtime-generated buffers, provide an optional `resolveBuffer` override. The engine uses it only for events without `src` / `srces`.

```ts
import { generatePlaceholderSound } from "@webgamedevkit/audio-engine";

const { play } = useSpatialAudioEngine({
  soundConfigs: SOUND_CONFIGS,
  volumeStore: useAudioStore,
  resolveBuffer: async (ctx, event) =>
    event === "ui_click"
      ? generatePlaceholderSound(ctx, "click", 0.05)
      : null,
});
```

## Package exports

| Import path | Contents |
|---|---|
| `@webgamedevkit/audio-engine` | Core engine, types, buffer loader, procedural sounds |
| `@webgamedevkit/audio-engine/stores` | Zustand volume store factory |
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
