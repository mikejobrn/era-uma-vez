"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { FC } from "react";
import type { PlayedCard } from "@era-uma-vez/shared-types";

interface StoryLogProps {
  entries: PlayedCard[];
  onUndo?: () => void;
  descending?: boolean;
}

const CARD_TYPE_COLORS: Record<string, string> = {
  Evento: "#923c35",
  Personagem: "#2c5f8a",
  Lugar: "#3d7a4f",
  Coisa: "#7a5c2e",
  Aspecto: "#6b4a8a",
  Final: "#c9a84c",
};

/**
 * Exibe o histórico encadeado das cartas jogadas com animação Framer Motion.
 * Inclui opção de "Desfazer Jogada" para veto dos jogadores.
 */
export const StoryLog: FC<StoryLogProps> = ({ entries, onUndo, descending = false }) => {
  if (entries.length === 0) {
    return (
      <div
        style={{
          padding: "24px 16px",
          textAlign: "center",
          color: "rgba(245,235,220,0.4)",
          fontFamily: "var(--font-title), serif",
          fontSize: 14,
        }}
      >
        A história ainda não começou…
      </div>
    );
  }

  const orderedEntries = descending ? [...entries].reverse() : entries;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        maxHeight: 400,
        overflowY: "auto",
        padding: "8px 4px",
      }}
    >
      <AnimatePresence initial={false}>
        {orderedEntries.map((entry, index) => {
          const isFinal = entry.card.tipo === "Final";
          const accentColor = CARD_TYPE_COLORS[entry.card.tipo] ?? "#923c35";
          const cardImageUrl = `/cards/${entry.card.id}.png`;
          return (
            <motion.div
              key={`${entry.player_id}-${entry.played_at}-${index}`}
              initial={{ opacity: 0, x: -30, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 30, scale: 0.9 }}
              transition={{ type: "spring", stiffness: 260, damping: 24 }}
              style={{
                borderRadius: 10,
                background: isFinal
                  ? "linear-gradient(135deg, rgba(201,168,76,0.15) 0%, rgba(26,14,5,0.9) 100%)"
                  : "rgba(26,14,5,0.7)",
                border: isFinal
                  ? "1px solid rgba(201,168,76,0.6)"
                  : `1px solid ${accentColor}60`,
                padding: "10px 14px",
                boxShadow: isFinal ? "0 0 10px rgba(201,168,76,0.3)" : "none",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 4,
                }}
              >
                <span
                  style={{
                    fontSize: 10,
                    fontFamily: "var(--font-display), cursive",
                    color: accentColor,
                    textTransform: "uppercase",
                    letterSpacing: 1,
                    background: `${accentColor}20`,
                    padding: "1px 6px",
                    borderRadius: 4,
                  }}
                >
                  {entry.card.tipo}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    color: "rgba(245,235,220,0.6)",
                    fontFamily: "var(--font-title), serif",
                  }}
                >
                  {entry.player_name}
                </span>
                {isFinal && <span style={{ fontSize: 14 }}>⭐</span>}
              </div>
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <img
                  src={cardImageUrl}
                  alt={entry.card.texto_pt}
                  onError={(event) => {
                    event.currentTarget.style.display = "none";
                  }}
                  style={{
                    width: 56,
                    height: 80,
                    borderRadius: 6,
                    objectFit: "cover",
                    border: "1px solid rgba(245,235,220,0.2)",
                    flexShrink: 0,
                  }}
                />
                <p
                  style={{
                    fontSize: 13,
                    color: "#f5ebdc",
                    lineHeight: 1.4,
                    margin: 0,
                    fontFamily: "var(--font-title), serif",
                  }}
                >
                  {entry.card.texto_pt}
                </p>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>

      {onUndo && entries.length > 0 && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          whileTap={{ scale: 0.95 }}
          onClick={onUndo}
          style={{
            alignSelf: "center",
            marginTop: 4,
            padding: "6px 20px",
            borderRadius: 8,
            background: "transparent",
            border: "1px solid rgba(245,235,220,0.3)",
            color: "rgba(245,235,220,0.6)",
            fontSize: 12,
            cursor: "pointer",
            fontFamily: "var(--font-title), serif",
          }}
        >
          ↩ Desfazer Jogada
        </motion.button>
      )}
    </div>
  );
};
