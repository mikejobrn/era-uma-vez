import type { FC } from "react";
import type { PlayedCard } from "@era-uma-vez/shared-types";

interface StoryLogProps {
  entries: PlayedCard[];
  onUndo?: () => void;
}

/**
 * Exibe o histórico encadeado das cartas jogadas com animação Framer Motion.
 * Inclui opção de "Desfazer Jogada" para veto dos jogadores.
 */
export const StoryLog: FC<StoryLogProps> = ({ entries, onUndo }) => {
  void entries;
  void onUndo;
  return null;
};
