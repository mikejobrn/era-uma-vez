import type { FC } from "react";
import type { Card } from "@era-uma-vez/shared-types";

interface CardFanProps {
  cards: Card[];
  onPlay?: (card: Card) => void;
}

/**
 * Exibe as cartas do jogador em leque horizontal.
 * A carta de Final fica sempre em destaque à frente.
 * Swipe Up (arrastar para cima) joga a carta.
 */
export const CardFan: FC<CardFanProps> = ({ cards, onPlay }) => {
  // Implementation in apps/game-client using Framer Motion
  void cards;
  void onPlay;
  return null;
};
