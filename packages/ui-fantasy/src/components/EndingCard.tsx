import type { FC } from "react";
import type { Card } from "@era-uma-vez/shared-types";

interface EndingCardProps {
  card: Card;
  onPlay?: (card: Card) => void;
}

/**
 * Exibe a carta de Final (Felizes para Sempre) em destaque.
 */
export const EndingCard: FC<EndingCardProps> = ({ card, onPlay }) => {
  void card;
  void onPlay;
  return null;
};
