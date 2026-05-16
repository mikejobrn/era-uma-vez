import type { FC } from "react";
import type { Player } from "@era-uma-vez/shared-types";

interface PlayerAvatarProps {
  player: Player;
  isNarrator?: boolean;
}

/**
 * Exibe o avatar e nome de um jogador, com coroa para o Narrador ativo.
 */
export const PlayerAvatar: FC<PlayerAvatarProps> = ({ player, isNarrator }) => {
  void player;
  void isNarrator;
  return null;
};
