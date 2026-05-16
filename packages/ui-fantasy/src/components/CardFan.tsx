"use client";

import { AnimatePresence, motion, type PanInfo } from "framer-motion";
import { type FC, useRef, useState } from "react";
import type { Card } from "@era-uma-vez/shared-types";

interface CardFanProps {
  cards: Card[];
  onPlay?: (card: Card) => void;
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
 * Exibe as cartas do jogador em leque horizontal.
 * A carta de Final fica sempre em destaque à frente.
 * Swipe Up (arrastar para cima) joga a carta.
 */
export const CardFan: FC<CardFanProps> = ({ cards, onPlay }) => {
  const [playingCardId, setPlayingCardId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const sortedCards = [...cards].sort((a, b) => {
    if (a.tipo === "Final" && b.tipo !== "Final") return 1;
    if (b.tipo === "Final" && a.tipo !== "Final") return -1;
    return 0;
  });

  const total = sortedCards.length;
  const spread = Math.min(60, total * 8);

  function handleDragEnd(card: Card, _: unknown, info: PanInfo) {
    if (info.offset.y < -80) {
      setPlayingCardId(card.id);
      setTimeout(() => {
        setPlayingCardId(null);
        onPlay?.(card);
      }, 300);
    }
  }

  return (
    <div
      ref={containerRef}
      className="relative flex items-end justify-center"
      style={{ height: 200, width: "100%", touchAction: "none" }}
    >
      <AnimatePresence>
        {sortedCards.map((card, index) => {
          const isFinal = card.tipo === "Final";
          const mid = (total - 1) / 2;
          const rotation = total > 1 ? ((index - mid) / (total - 1)) * spread : 0;
          const xOffset = total > 1 ? ((index - mid) / (total - 1)) * (total * 18) : 0;
          const yOffset = Math.abs(index - mid) * 8;
          const zIndex = isFinal ? total + 10 : index;
          const isPlaying = playingCardId === card.id;
          const bgColor = CARD_TYPE_COLORS[card.tipo] ?? "#923c35";

          return (
            <motion.div
              key={card.id}
              drag="y"
              dragConstraints={{ top: -160, bottom: 20 }}
              dragDirectionLock
              onDragEnd={(e, info) => handleDragEnd(card, e, info)}
              initial={{ opacity: 0, y: 40 }}
              animate={{
                opacity: isPlaying ? 0 : 1,
                y: isPlaying ? -160 : yOffset,
                x: xOffset,
                rotate: rotation,
                scale: isPlaying ? 1.15 : isFinal ? 1.05 : 1,
                zIndex,
              }}
              exit={{ opacity: 0, y: -200, scale: 0.8 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              whileHover={{ y: yOffset - 20, scale: isFinal ? 1.12 : 1.08, zIndex: total + 20 }}
              whileDrag={{ scale: 1.1, zIndex: total + 30 }}
              className="absolute bottom-0 cursor-grab active:cursor-grabbing select-none"
              style={{
                width: 90,
                height: 130,
                borderRadius: 10,
                background: bgColor,
                border: isFinal ? "2px solid #c9a84c" : "1px solid rgba(255,255,255,0.2)",
                boxShadow: isFinal
                  ? "0 0 12px 4px rgba(201,168,76,0.5), 0 4px 8px rgba(0,0,0,0.4)"
                  : "0 4px 8px rgba(0,0,0,0.3)",
                transformOrigin: "bottom center",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: 6,
                gap: 4,
                zIndex,
              }}
            >
              <span
                style={{
                  fontSize: 9,
                  fontFamily: "var(--font-display), cursive",
                  color: "rgba(255,255,255,0.7)",
                  textTransform: "uppercase",
                  letterSpacing: 1,
                }}
              >
                {card.tipo}
              </span>
              <span
                style={{
                  fontSize: 10,
                  color: "#f5ebdc",
                  textAlign: "center",
                  lineHeight: 1.3,
                  overflow: "hidden",
                  display: "-webkit-box",
                  WebkitLineClamp: 4,
                  WebkitBoxOrient: "vertical" as const,
                }}
              >
                {card.texto_pt}
              </span>
              {isFinal && (
                <span style={{ fontSize: 14 }}>⭐</span>
              )}
              <span
                style={{
                  position: "absolute",
                  bottom: 6,
                  fontSize: 8,
                  color: "rgba(255,255,255,0.5)",
                  fontFamily: "var(--font-display), cursive",
                }}
              >
                ↑ deslizar
              </span>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
