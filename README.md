# @webgamekit/audio-engine

A small, typed Web Audio layer for games and 3D apps. Play sounds by event id, optionally spatialize them with HRTF when a world position is provided, and control loudness through master + category volumes that update live on playing sounds. The core engine is framework-agnostic; React and React Three Fiber helpers are included for typical setups.

## Install

```bash
npm install @webgamekit/audio-engine zustand
```

For React and R3F integrations, also install the optional peers:

```bash
npm install react @react-three/fiber three
```

## Quick start

### 1. Volume store

```ts
import { createAudioVolumeStore } from "@webgamekit/audio-engine/stores";

const AUDIO_CATEGORIES = ["sfx", "music"] as const;

export const useAudioStore = createAudioVolumeStore({
  persistKey: "my-app-audio-settings",
  categories: AUDIO_CATEGORIES,
  defaultCategoryVolumes: { sfx: 50, music: 50 },
});
```

### 2. Sound configs

```ts
import type { SoundConfig } from "@webgamekit/audio-engine";

type SoundEvent = "explosion" | "ui_click";
type AudioCategory = (typeof AUDIO_CATEGORIES)[number];

export const SOUND_CONFIGS: Record<SoundEvent, SoundConfig<AudioCategory>> = {
  explosion: { category: "sfx", volume: 70 },
  ui_click: { category: "sfx", volume: 50, spatial: false },
};
```

### 3. Buffer resolver

```ts
import {
  generatePlaceholderSound,
  loadAudioBuffer,
} from "@webgamekit/audio-engine";

const resolveBuffer = async (
  ctx: AudioContext,
  event: SoundEvent
): Promise<AudioBuffer | null> => {
  switch (event) {
    case "explosion":
      return (
        (await loadAudioBuffer(ctx, "assets/explosion.wav")) ??
        generatePlaceholderSound(ctx, "tone", 0.3, 200)
      );
    case "ui_click":
      return generatePlaceholderSound(ctx, "click", 0.05, 1000);
    default:
      return null;
  }
};
```

### 4. React hook

```tsx
import { useSpatialAudioEngine } from "@webgamekit/audio-engine/react";

const { play, isReady } = useSpatialAudioEngine({
  soundConfigs: SOUND_CONFIGS,
  resolveBuffer,
  volumeStore: useAudioStore,
});

// Spatial SFX at a world point
await play("explosion", { worldPosition: { x: 10, y: 0, z: 5 } });

// Non-spatial UI sound
await play("ui_click");
```

The hook creates an `AudioContext`, resumes it on the first user click / keydown / touch, and reapplies volumes whenever the store changes. `isReady` is `true` once the context is activated.

### 5. R3F listener (for spatial sounds)

Mount inside your `<Canvas>` so panners hear from the camera's point of view:

```tsx
import { AudioListenerSync } from "@webgamekit/audio-engine/r3f";

<Canvas>
  <AudioListenerSync />
  {/* scene … */}
</Canvas>;
```

## Package exports

| Import path | Contents |
|---|---|
| `@webgamekit/audio-engine` | Core engine, types, buffer loader, procedural sounds |
| `@webgamekit/audio-engine/stores` | Zustand volume store factory |
| `@webgamekit/audio-engine/react` | `useSpatialAudioEngine` hook |
| `@webgamekit/audio-engine/r3f` | `AudioListenerSync` component |

## Key behaviors

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
