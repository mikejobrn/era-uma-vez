import { describe, expect, it } from "vitest";

import type { Player } from "@era-uma-vez/shared-types";

import { applyNarratorRotation, getCurrentNarrator, getNextNarrator } from "./index";

function createPlayer(overrides: Partial<Player>): Player {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    room_id: overrides.room_id ?? "room-1",
    name: overrides.name ?? "Player",
    avatar_url: overrides.avatar_url ?? null,
    is_narrator: overrides.is_narrator ?? false,
    status: overrides.status ?? "waiting",
    hand: overrides.hand ?? [],
    joined_at: overrides.joined_at ?? "2026-01-01T00:00:00.000Z",
  };
}

describe("turn logic", () => {
  it("assigns the first connected player when no narrator is set", () => {
    const players = [
      createPlayer({ id: "later", joined_at: "2026-01-01T00:01:00.000Z" }),
      createPlayer({ id: "first", joined_at: "2026-01-01T00:00:00.000Z" }),
    ];

    expect(getNextNarrator(players, null)?.id).toBe("first");
  });

  it("rotates to the next connected player", () => {
    const players = [
      createPlayer({ id: "p1", joined_at: "2026-01-01T00:00:00.000Z" }),
      createPlayer({ id: "p2", joined_at: "2026-01-01T00:01:00.000Z" }),
      createPlayer({ id: "p3", joined_at: "2026-01-01T00:02:00.000Z", status: "disconnected" }),
    ];

    expect(getNextNarrator(players, "p1")?.id).toBe("p2");
    expect(getNextNarrator(players, "p2")?.id).toBe("p1");
  });

  it("finds the current narrator from the room id or existing player flags", () => {
    const players = [
      createPlayer({ id: "p1", is_narrator: true }),
      createPlayer({ id: "p2" }),
    ];

    expect(getCurrentNarrator(players, "p2")?.id).toBe("p2");
    expect(getCurrentNarrator(players, null)?.id).toBe("p1");
  });

  it("marks only the active narrator as active", () => {
    const players = [
      createPlayer({ id: "p1", status: "active", is_narrator: true }),
      createPlayer({ id: "p2" }),
      createPlayer({ id: "p3", status: "disconnected", is_narrator: true }),
    ];

    expect(applyNarratorRotation(players, "p2")).toEqual([
      expect.objectContaining({ id: "p1", is_narrator: false, status: "waiting" }),
      expect.objectContaining({ id: "p2", is_narrator: true, status: "active" }),
      expect.objectContaining({ id: "p3", is_narrator: false, status: "disconnected" }),
    ]);
  });
});
