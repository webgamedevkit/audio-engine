import { describe, expectTypeOf, it } from "vitest";

import type { PlayPayloadForEvent, SoundConfig } from "../types";

type AudioCategory = "sfx";

const soundConfigs = {
  explosion: { category: "sfx", src: "/boom.wav" },
  tower_shot: {
    category: "sfx",
    srces: { cannon: "/c.wav", laser: "/l.wav" },
  },
  ui_click: { category: "sfx", spatial: false },
} as const satisfies Record<string, SoundConfig<AudioCategory>>;

type TestConfigs = typeof soundConfigs;

describe("typed play and preload payloads", () => {
  it("infers srcKey from srces keys", () => {
    type Payload = PlayPayloadForEvent<TestConfigs, "tower_shot">;
    expectTypeOf<Payload["srcKey"]>().toEqualTypeOf<
      "cannon" | "laser" | undefined
    >();
  });

  it("restricts srcKey to never for single-src configs", () => {
    type Payload = PlayPayloadForEvent<TestConfigs, "explosion">;
    expectTypeOf<Payload["srcKey"]>().toEqualTypeOf<undefined>();
  });
});
