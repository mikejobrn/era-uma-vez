"use client";

import { motion } from "framer-motion";
import { type FC } from "react";
import type { PlayedCard } from "@era-uma-vez/shared-types";

const CARD_TYPE_COLORS: Record<string, string> = {
  Evento: "#923c35",
  Personagem: "#2c5f8a",
  Lugar: "#3d7a4f",
  Coisa: "#7a5c2e",
  Aspecto: "#6b4a8a",
  Final: "#c9a84c",
};

const CARD_W = 160;
const CARD_H = 224;

interface TableCardsProps {
  entries: PlayedCard[];
}

/**
 * Exibe as cartas jogadas lado a lado com wrap flexbox.
 * Sem autoria – apenas as cartas, em ordem de jogada.
 */
export const TableCards: FC<TableCardsProps> = ({ entries }) => {
  if (entries.length === 0) return null;

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 8,
        padding: 10,
        borderRadius: 12,
        background: "rgba(0,0,0,0.2)",
        border: "1px solid rgba(201,168,76,0.15)",
      }}
    >
      {entries.map((entry, index) => {
        const isFinal = entry.card.tipo === "Final";
        const cardImageUrl = `/cards/${entry.card.id}.png`;
        const bgColor = CARD_TYPE_COLORS[entry.card.tipo] ?? "#923c35";

        return (
          <motion.div
            key={`${entry.player_id}-${entry.played_at}-${index}`}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 280, damping: 24 }}
            style={{
              width: CARD_W,
              height: CARD_H,
              borderRadius: 10,
              background: bgColor,
              border: isFinal
                ? "2px solid #c9a84c"
                : "1px solid rgba(255,255,255,0.2)",
              boxShadow: isFinal
                ? "0 0 12px rgba(201,168,76,0.6), 0 4px 12px rgba(0,0,0,0.5)"
                : "0 4px 12px rgba(0,0,0,0.5)",
              overflow: "hidden",
              flexShrink: 0,
              position: "relative",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Card image */}
            <img
              src={cardImageUrl}
              alt={entry.card.texto_pt}
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
              draggable={false}
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
                pointerEvents: "none",
                userSelect: "none",
              }}
            />
            {/* Top: type badge */}
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                padding: "6px 8px 16px",
                background: "linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  fontFamily: "var(--font-display), cursive",
                  color: "rgba(255,255,255,0.9)",
                  textTransform: "uppercase",
                  letterSpacing: 1,
                  lineHeight: 1,
                }}
              >
                {entry.card.tipo}
              </span>
              {isFinal && <span style={{ fontSize: 13 }}>⭐</span>}
            </div>
            {/* Bottom: card text */}
            <div
              style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                padding: "20px 10px 10px",
                background: "linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0) 100%)",
              }}
            >
              <p
                style={{
                  color: "#f5ebdc",
                  fontSize: 12,
                  fontFamily: "var(--font-title), serif",
                  textAlign: "center",
                  lineHeight: 1.45,
                  margin: 0,
                  fontStyle: isFinal ? "italic" : "normal",
                }}
              >
                {entry.card.texto_pt}
              </p>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};
