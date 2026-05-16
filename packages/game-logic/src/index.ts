import type { Room, Player, Card, PlayedCard, GameEvent } from "@era-uma-vez/shared-types";

// ─── Turn Logic ───────────────────────────────────────────────────────────────

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
export function getNextNarrator(players: Player[], currentNarratorId: string): Player | null {
  const activePlayers = players.filter((p) => p.status !== "disconnected");
  if (activePlayers.length === 0) return null;
  const nextIndex = getNextNarratorIndex(activePlayers, currentNarratorId);
  return activePlayers[nextIndex] ?? null;
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
