import { defineSoundConfigs, forEvents } from "../defineSoundConfigs";
import type { PlayPayloadForEvent } from "../types";
import type { SpatialAudioEngine } from "./spatialAudioEngine";

const AUDIO_CATEGORIES = ["sfx"] as const;
type TestEvents = "explosion" | "tower_shot";

const soundConfigs = defineSoundConfigs(
  AUDIO_CATEGORIES,
  {
    explosion: { category: "sfx", src: "/boom.wav", normalize: true },
    tower_shot: {
      category: "sfx",
      srces: { cannon: "/c.wav", laser: "/l.wav" },
      normalize: { targetPeak: 0.5 },
    },
  },
  forEvents<TestEvents>(),
);

type TestConfigs = typeof soundConfigs;
type Engine = SpatialAudioEngine<TestConfigs, "sfx">;

declare const engine: Engine;

// @ts-expect-error invalid event name
engine.play("typo");

engine.play("tower_shot", { srcKey: "cannon" });

// @ts-expect-error invalid srcKey
engine.play("tower_shot", { srcKey: "typo" });

// @ts-expect-error srcKey not allowed on single-src events
engine.play("explosion", { srcKey: "cannon" });

// @ts-expect-error invalid preload event
engine.preload(["typo"]);

type TowerPayload = PlayPayloadForEvent<TestConfigs, "tower_shot">;
declare const towerPayload: TowerPayload;
// @ts-expect-error invalid srcKey in payload type
const _bad: TowerPayload = { srcKey: "typo" };

defineSoundConfigs(AUDIO_CATEGORIES, {
  bad: {
    // @ts-expect-error invalid category for configured tuple
    category: "music",
    src: "/x.wav",
  },
});

defineSoundConfigs(
  AUDIO_CATEGORIES,
  // @ts-expect-error missing required event from union
  {
    explosion: { category: "sfx", src: "/boom.wav" },
  },
  forEvents<"explosion" | "missing">(),
);
