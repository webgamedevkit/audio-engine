import { describe, expect, it } from "vitest";

import { getCategoryVolume, MIN_VOLUME, toVolumeState } from "./volume";
import type { VolumeState } from "../types";

type TestCategory = "sfx" | "music";

const baseState: VolumeState<TestCategory> = {
  masterVolume: 50,
  categoryVolumes: { sfx: 50, music: 50 },
  muted: false,
};
describe("toVolumeState", () => {
  it("normalizes muted to a strict boolean", () => {
    expect(toVolumeState({ ...baseState, muted: true }).muted).toBe(true);
    expect(toVolumeState({ ...baseState, muted: false }).muted).toBe(false);
    expect(toVolumeState({ ...baseState, muted: "true" as unknown as boolean }).muted).toBe(
      false
    );
  });
});

describe("getCategoryVolume", () => {
  it("returns MIN_VOLUME when muted", () => {
    expect(
      getCategoryVolume({ ...baseState, muted: true }, "sfx")
    ).toBe(MIN_VOLUME);
  });

  it("returns 0 when master volume is 0", () => {
    expect(
      getCategoryVolume({ ...baseState, masterVolume: 0 }, "sfx")
    ).toBe(0);
  });

  it("returns 0 when category volume is 0", () => {
    expect(
      getCategoryVolume<TestCategory>(
        {
          ...baseState,
          categoryVolumes: { sfx: 0, music: 50 },
        },
        "sfx"
      )
    ).toBe(0);
  });

  it("returns 0.25 at default 50/50 settings", () => {
    expect(getCategoryVolume(baseState, "sfx")).toBe(0.25);
  });

  it("returns 0.5 when one slider is at 100 and the other at 50", () => {
    expect(
      getCategoryVolume<TestCategory>(
        {
          ...baseState,
          masterVolume: 50,
          categoryVolumes: { sfx: 100, music: 50 },
        },
        "sfx"
      )
    ).toBe(0.5);
    expect(
      getCategoryVolume<TestCategory>(
        {
          ...baseState,
          masterVolume: 100,
          categoryVolumes: { sfx: 50, music: 50 },
        },
        "sfx"
      )
    ).toBe(0.5);
  });

  it("returns 1.0 at max master and category volume", () => {
    expect(
      getCategoryVolume<TestCategory>(
        {
          ...baseState,
          masterVolume: 100,
          categoryVolumes: { sfx: 100, music: 50 },
        },
        "sfx"
      )
    ).toBe(1);
  });
});
