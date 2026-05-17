import type { Room, Player, Card, PlayedCard, GameEvent } from "@era-uma-vez/shared-types";

// ─── Turn Logic ───────────────────────────────────────────────────────────────

function getNarrationOrder(players: Player[]): Player[] {
  return [...players]
    .filter((player) => player.status !== "disconnected")
    .sort((left, right) => left.joined_at.localeCompare(right.joined_at));
}

/**
 * Returns the next narrator index in a round-robin fashion.
 */
export function getNextNarratorIndex(players: Player[], currentNarratorId: string): number {
  const idx = players.findIndex((p) => p.id === currentNarratorId);
  if (idx === -1) return 0;
  return (idx + 1) % players.length;
}

/**
 * Returns the next narrator player.
 */
export function getNextNarrator(players: Player[], currentNarratorId: string | null): Player | null {
  const activePlayers = getNarrationOrder(players);
  if (activePlayers.length === 0) return null;
  if (!currentNarratorId) return activePlayers[0] ?? null;
  const nextIndex = getNextNarratorIndex(activePlayers, currentNarratorId);
  return activePlayers[nextIndex] ?? null;
}

/**
 * Returns the active narrator based on the stored narrator id or player flags.
 */
export function getCurrentNarrator(players: Player[], narratorId: string | null): Player | null {
  const activePlayers = getNarrationOrder(players);
  if (activePlayers.length === 0) return null;

  if (narratorId) {
    const narrator = activePlayers.find((player) => player.id === narratorId);
    if (narrator) return narrator;
  }

  return activePlayers.find((player) => player.is_narrator) ?? null;
}

/**
 * Applies narrator flags and statuses for the provided narrator id.
 */
export function applyNarratorRotation(players: Player[], narratorId: string | null): Player[] {
  return players.map((player) => {
    if (player.status === "disconnected") {
      return {
        ...player,
        is_narrator: false,
      };
    }

    return {
      ...player,
      is_narrator: player.id === narratorId,
      status: player.id === narratorId ? "active" : "waiting",
    };
  });
}

// ─── Hand Logic ───────────────────────────────────────────────────────────────

/**
 * Removes a card from a player's hand and returns the updated hand.
 */
export function removeCardFromHand(hand: Card[], cardId: string): Card[] {
  return hand.filter((c) => c.id !== cardId);
}

/**
 * Returns true if the player has a "Final" (ending) card in hand.
 */
export function hasEndingCard(hand: Card[]): boolean {
  return hand.some((c) => c.tipo === "Final");
}

/**
 * Returns all "Final" cards from the hand.
 */
export function getEndingCards(hand: Card[]): Card[] {
  return hand.filter((c) => c.tipo === "Final");
}

// ─── Interruption Logic ───────────────────────────────────────────────────────

/**
 * Returns true if a card can interrupt the current narrator's turn.
 */
export function canInterrupt(card: Card): boolean {
  return card.interrupt;
}

// ─── Story Log ────────────────────────────────────────────────────────────────

/**
 * Adds a played card to the story log.
 */
export function appendToStoryLog(log: PlayedCard[], entry: PlayedCard): PlayedCard[] {
  return [...log, entry];
}

/**
 * Removes the last played card from the story log (Undo).
 */
export function undoLastMove(log: PlayedCard[]): PlayedCard[] {
  if (log.length === 0) return log;
  return log.slice(0, -1);
}

// ─── Victory Check ────────────────────────────────────────────────────────────

/**
 * Checks if a "Final" card has been played and accepted.
 * Returns the winning played card, or null if none.
 */
export function checkVictory(room: Room): PlayedCard | null {
  const lastEntry = room.story_log[room.story_log.length - 1];
  if (!lastEntry) return null;
  if (lastEntry.card.tipo === "Final") return lastEntry;
  return null;
}

// ─── Deal Cards ───────────────────────────────────────────────────────────────

/**
 * Shuffles the deck and distributes handSize cards to each player sequentially.
 */
export function dealCards(deck: Card[], players: Player[], handSize = 7): Player[] {
  const shuffled = [...deck].sort(() => Math.random() - 0.5);
  let deckIndex = 0;

  return players.map((player) => {
    const hand: Card[] = [];
    let hasFinalCard = false;

    while (hand.length < handSize && deckIndex < shuffled.length) {
      const card = shuffled[deckIndex++];
      if (!card) break;

      if (card.tipo === "Final") {
        if (hasFinalCard) continue;
        hasFinalCard = true;
      }

      hand.push(card);
    }

    return {
      ...player,
      hand,
    };
  });
}

// ─── Event Factory ────────────────────────────────────────────────────────────

export function createGameEvent(
  type: GameEvent["type"],
  roomId: string,
  payload: Record<string, unknown>,
): GameEvent {
  return {
    type,
    room_id: roomId,
    payload,
    timestamp: new Date().toISOString(),
  };
}
