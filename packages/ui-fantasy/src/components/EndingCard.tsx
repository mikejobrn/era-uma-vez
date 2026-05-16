"use client";

import { motion } from "framer-motion";
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
  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.97 }}
      onClick={() => onPlay?.(card)}
      className="cursor-pointer select-none"
      style={{
        width: 160,
        minHeight: 220,
        borderRadius: 14,
        background: "linear-gradient(135deg, #2a1a05 0%, #1a0e05 100%)",
        border: "2px solid #c9a84c",
        boxShadow: "0 0 24px 6px rgba(201,168,76,0.4), 0 8px 16px rgba(0,0,0,0.5)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        gap: 10,
      }}
    >
      <span style={{ fontSize: 28 }}>⭐</span>
      <span
        style={{
          fontSize: 11,
          fontFamily: "var(--font-display), cursive",
          color: "#c9a84c",
          textTransform: "uppercase",
          letterSpacing: 2,
        }}
      >
        Final
      </span>
      <span
        style={{
          fontSize: 13,
          color: "#f5ebdc",
          textAlign: "center",
          lineHeight: 1.4,
        }}
      >
        {card.texto_pt}
      </span>
      {onPlay && (
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={(e) => {
            e.stopPropagation();
            onPlay(card);
          }}
          style={{
            marginTop: 8,
            padding: "6px 16px",
            borderRadius: 8,
            background: "#c9a84c",
            color: "#1a0e05",
            fontWeight: 700,
            fontSize: 12,
            border: "none",
            cursor: "pointer",
            fontFamily: "var(--font-title), serif",
          }}
        >
          Jogar
        </motion.button>
      )}
    </motion.div>
  );
};
