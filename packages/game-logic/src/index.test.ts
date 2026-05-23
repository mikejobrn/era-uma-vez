import { describe, expect, it } from "vitest";

import type { Card, Player, PlayedCard, Room } from "@era-uma-vez/shared-types";

import {
  applyNarratorRotation,
  canInterrupt,
  canPlayCard,
  canPlayFinalCard,
  checkVictory,
  dealCards,
  getCurrentNarrator,
  getNextNarrator,
  undoLastMove,
} from "./index";

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

function createCard(overrides: Partial<Card>): Card {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    deck: overrides.deck ?? "A",
    numero: overrides.numero ?? 1,
    tipo: overrides.tipo ?? "Personagem",
    texto_pt: overrides.texto_pt ?? "Uma carta",
    texto_en: overrides.texto_en ?? "A card",
    interrupt: overrides.interrupt ?? false,
    prompt_en: overrides.prompt_en ?? "",
  };
}

function createRoom(overrides: Partial<Room>): Room {
  return {
    id: overrides.id ?? "room-1",
    code: overrides.code ?? "ABCDE",
    status: overrides.status ?? "in_progress",
    narrator_id: overrides.narrator_id ?? null,
    story_log: overrides.story_log ?? [],
    created_at: overrides.created_at ?? "2026-01-01T00:00:00.000Z",
  };
}

function createPlayedCard(overrides: Partial<PlayedCard>): PlayedCard {
  return {
    player_id: overrides.player_id ?? "p1",
    player_name: overrides.player_name ?? "Player",
    card: overrides.card ?? createCard({}),
    played_at: overrides.played_at ?? "2026-01-01T00:00:00.000Z",
  };
}

describe("canInterrupt", () => {
  it("returns true for interrupt cards", () => {
    const interruptCard = createCard({ interrupt: true });
    expect(canInterrupt(interruptCard)).toBe(true);
  });

  it("returns false for non-interrupt cards", () => {
    const normalCard = createCard({ interrupt: false });
    expect(canInterrupt(normalCard)).toBe(false);
  });
});

describe("dealCards", () => {
  it("distributes the correct number of cards to each player", () => {
    const deck = [
      ...Array.from({ length: 3 }, (_, i) => createCard({ id: `final-${i}`, tipo: "Final" })),
      ...Array.from({ length: 20 }, (_, i) => createCard({ id: `card-${i}`, numero: i })),
    ];
    const players = [
      createPlayer({ id: "p1" }),
      createPlayer({ id: "p2" }),
    ];
    const result = dealCards(deck, players, 7);
    expect(result[0]!.hand).toHaveLength(7);
    expect(result[1]!.hand).toHaveLength(7);
  });

  it("gives each player distinct cards", () => {
    const deck = [
      ...Array.from({ length: 3 }, (_, i) => createCard({ id: `final-${i}`, tipo: "Final" })),
      ...Array.from({ length: 20 }, (_, i) => createCard({ id: `card-${i}`, numero: i })),
    ];
    const players = [
      createPlayer({ id: "p1" }),
      createPlayer({ id: "p2" }),
    ];
    const result = dealCards(deck, players, 7);
    const p1Ids = result[0]!.hand.map((c) => c.id);
    const p2Ids = result[1]!.hand.map((c) => c.id);
    const overlap = p1Ids.filter((id) => p2Ids.includes(id));
    expect(overlap).toHaveLength(0);
  });

  it("preserves other player properties", () => {
    const deck = [
      createCard({ id: "f1", tipo: "Final" }),
      ...Array.from({ length: 10 }, (_, i) => createCard({ id: `card-${i}`, numero: i })),
    ];
    const players = [createPlayer({ id: "p1", name: "Hero" })];
    const result = dealCards(deck, players, 5);
    expect(result[0]!.name).toBe("Hero");
    expect(result[0]!.id).toBe("p1");
  });

  it("guarantees exactly 1 Final card per player when enough finals exist", () => {
    const deck = [
      createCard({ id: "f1", tipo: "Final" }),
      createCard({ id: "f2", tipo: "Final" }),
      createCard({ id: "f3", tipo: "Final" }),
      ...Array.from({ length: 24 }, (_, i) =>
        createCard({ id: `card-${i}`, numero: i, tipo: "Personagem" }),
      ),
    ];
    const players = [createPlayer({ id: "p1" }), createPlayer({ id: "p2" }), createPlayer({ id: "p3" })];
    const result = dealCards(deck, players, 7);

    result.forEach((player) => {
      const finals = player.hand.filter((card) => card.tipo === "Final");
      expect(finals.length).toBe(1);
    });
  });

  it("gives at most 1 Final card per player even with many finals in deck", () => {
    const deck = [
      ...Array.from({ length: 10 }, (_, i) => createCard({ id: `f-${i}`, tipo: "Final" })),
      ...Array.from({ length: 20 }, (_, i) => createCard({ id: `card-${i}`, numero: i, tipo: "Personagem" })),
    ];
    const players = [createPlayer({ id: "p1" }), createPlayer({ id: "p2" })];
    const result = dealCards(deck, players, 7);

    result.forEach((player) => {
      const finals = player.hand.filter((card) => card.tipo === "Final");
      expect(finals.length).toBe(1);
    });
  });
});

describe("checkVictory", () => {
  it("returns null when story log is empty", () => {
    const room = createRoom({ story_log: [] });
    expect(checkVictory(room)).toBeNull();
  });

  it("returns null when last card is not a Final card", () => {
    const entry = createPlayedCard({ card: createCard({ tipo: "Personagem" }) });
    const room = createRoom({ story_log: [entry] });
    expect(checkVictory(room)).toBeNull();
  });

  it("returns the played card when last card is Final", () => {
    const finalEntry = createPlayedCard({ card: createCard({ tipo: "Final" }) });
    const room = createRoom({ story_log: [createPlayedCard({}), finalEntry] });
    expect(checkVictory(room)).toEqual(finalEntry);
  });
});

describe("undoLastMove", () => {
  it("returns empty array when log is already empty", () => {
    expect(undoLastMove([])).toEqual([]);
  });

  it("removes the last entry from the log", () => {
    const entry1 = createPlayedCard({ player_id: "p1" });
    const entry2 = createPlayedCard({ player_id: "p2" });
    const result = undoLastMove([entry1, entry2]);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(entry1);
  });
});

describe("canPlayFinalCard", () => {
  it("returns true when the hand has only a Final card", () => {
    const hand = [createCard({ tipo: "Final" })];
    expect(canPlayFinalCard(hand)).toBe(true);
  });

  it("returns false when the hand has multiple cards", () => {
    const hand = [createCard({ tipo: "Final" }), createCard({ tipo: "Personagem" })];
    expect(canPlayFinalCard(hand)).toBe(false);
  });

  it("returns false when the hand is empty", () => {
    expect(canPlayFinalCard([])).toBe(false);
  });
});

describe("canPlayCard", () => {
  it("allows playing non-Final cards regardless of hand size", () => {
    const card = createCard({ tipo: "Personagem" });
    const hand = [card, createCard({ tipo: "Final" }), createCard({ tipo: "Evento" })];
    expect(canPlayCard(card, hand)).toBe(true);
  });

  it("blocks Final card when hand has other cards", () => {
    const finalCard = createCard({ tipo: "Final" });
    const hand = [finalCard, createCard({ tipo: "Personagem" })];
    expect(canPlayCard(finalCard, hand)).toBe(false);
  });

  it("allows Final card when it is the only card in hand", () => {
    const finalCard = createCard({ tipo: "Final" });
    const hand = [finalCard];
    expect(canPlayCard(finalCard, hand)).toBe(true);
  });
});
