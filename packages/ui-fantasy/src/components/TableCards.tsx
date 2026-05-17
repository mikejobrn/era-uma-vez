"use client";

import { motion } from "framer-motion";
import { useRef, type FC } from "react";
import type { PlayedCard } from "@era-uma-vez/shared-types";

const CARD_TYPE_COLORS: Record<string, string> = {
  Evento: "#923c35",
  Personagem: "#2c5f8a",
  Lugar: "#3d7a4f",
  Coisa: "#7a5c2e",
  Aspecto: "#6b4a8a",
  Final: "#c9a84c",
};

const CARD_W = 72;
const CARD_H = 100;
const COLS = 10;
const GAP = 5;

interface TableCardsProps {
  entries: PlayedCard[];
}

function gridPos(index: number) {
  return {
    x: (index % COLS) * (CARD_W + GAP),
    y: Math.floor(index / COLS) * (CARD_H + GAP),
  };
}

/**
 * Exibe apenas as imagens das cartas jogadas em um canvas compacto e arrastável.
 * Usado na Mesa para mostrar o histórico da história de forma visual.
 */
export const TableCards: FC<TableCardsProps> = ({ entries }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  if (entries.length === 0) return null;

  const rows = Math.max(1, Math.ceil(entries.length / COLS));
  const containerH = rows * (CARD_H + GAP) + GAP;

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        width: "100%",
        height: containerH,
        overflow: "hidden",
        borderRadius: 12,
        background: "rgba(0,0,0,0.2)",
        border: "1px solid rgba(201,168,76,0.15)",
      }}
    >
      {entries.map((entry, index) => {
        const isFinal = entry.card.tipo === "Final";
        const cardImageUrl = `/cards/${entry.card.id}.png`;
        const bgColor = CARD_TYPE_COLORS[entry.card.tipo] ?? "#923c35";
        const { x, y } = gridPos(index);

        return (
          <motion.div
            key={`${entry.player_id}-${entry.played_at}-${index}`}
            drag
            dragMomentum={false}
            dragConstraints={containerRef}
            initial={{ x, y, opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            whileDrag={{ scale: 1.08, zIndex: 50 }}
            transition={{ type: "spring", stiffness: 280, damping: 24 }}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: CARD_W,
              height: CARD_H,
              borderRadius: 8,
              cursor: "grab",
              background: bgColor,
              border: isFinal
                ? "2px solid #c9a84c"
                : "1px solid rgba(255,255,255,0.2)",
              boxShadow: isFinal
                ? "0 0 8px rgba(201,168,76,0.5), 0 2px 6px rgba(0,0,0,0.4)"
                : "0 2px 6px rgba(0,0,0,0.4)",
              overflow: "hidden",
            }}
          >
            <img
              src={cardImageUrl}
              alt={entry.card.texto_pt}
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
              draggable={false}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                pointerEvents: "none",
                userSelect: "none",
              }}
            />
          </motion.div>
        );
      })}
    </div>
  );
};
