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
 * Adds a card to a player's hand and returns the updated hand.
 */
export function addCardToHand(hand: Card[], card: Card): Card[] {
  return [...hand, card];
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

/**
 * Returns the last played card entry from the story log, or null if empty.
 */
export function getLastPlayedCard(log: PlayedCard[]): PlayedCard | null {
  if (log.length === 0) return null;
  return log[log.length - 1] ?? null;
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
 * Returns the number of cards each player should receive based on player count.
 * 2 players → 10 cards each
 * 3 players → 8 cards each
 * 4 players → 7 cards each
 * 5 players → 6 cards each
 * 6+ players → 5 cards each
 */
export function getHandSize(playerCount: number): number {
  if (playerCount <= 1) return 10;
  if (playerCount === 2) return 10;
  if (playerCount === 3) return 8;
  if (playerCount === 4) return 7;
  if (playerCount === 5) return 6;
  return 5;
}

/**
 * Returns true if a "Final" card can be played.
 * A Final card can only be played when it is the last card in the hand.
 */
export function canPlayFinalCard(hand: Card[]): boolean {
  return hand.length === 1 && hand[0]?.tipo === "Final";
}

/**
 * Returns true if a card from the hand can be played given the game rules.
 * - Non-Final cards can always be played.
 * - Final cards can only be played when they are the last card in hand.
 */
export function canPlayCard(card: Card, hand: Card[]): boolean {
  if (card.tipo === "Final") {
    return canPlayFinalCard(hand);
  }
  return true;
}

/**
 * Shuffles the deck and distributes handSize cards to each player.
 * Guarantees exactly 1 Final card per player.
 */
export function dealCards(deck: Card[], players: Player[], handSize = 7): Player[] {
  const shuffled = [...deck].sort(() => Math.random() - 0.5);

  const finalCards = shuffled.filter((c) => c.tipo === "Final");
  const normalCards = shuffled.filter((c) => c.tipo !== "Final");

  // Shuffle final cards to randomize which final each player gets
  const shuffledFinals = [...finalCards].sort(() => Math.random() - 0.5);

  let normalIndex = 0;

  return players.map((player, playerIndex) => {
    const hand: Card[] = [];

    // Give exactly 1 Final card (if available)
    const finalCard = shuffledFinals[playerIndex];
    if (finalCard) {
      hand.push(finalCard);
    }

    // Fill rest of hand with normal cards
    while (hand.length < handSize && normalIndex < normalCards.length) {
      const card = normalCards[normalIndex++];
      if (!card) break;
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
