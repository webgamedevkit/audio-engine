import type { PlayPayloadForEvent, SoundConfig } from "../types";
import type { SpatialAudioEngine } from "./spatialAudioEngine";

type AudioCategory = "sfx";

const soundConfigs = {
  explosion: { category: "sfx", src: "/boom.wav" },
  tower_shot: {
    category: "sfx",
    srces: { cannon: "/c.wav", laser: "/l.wav" },
  },
} as const satisfies Record<string, SoundConfig<AudioCategory>>;

type TestConfigs = typeof soundConfigs;
type Engine = SpatialAudioEngine<TestConfigs, AudioCategory>;

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
