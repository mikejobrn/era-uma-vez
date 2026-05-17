"use client";

import { AnimatePresence, motion, Reorder } from "framer-motion";
import { type FC, useEffect, useState } from "react";
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

function sortInitial(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => {
    if (a.tipo === "Final" && b.tipo !== "Final") return 1;
    if (b.tipo === "Final" && a.tipo !== "Final") return -1;
    return 0;
  });
}

/**
 * Exibe as cartas do jogador em faixa horizontal rolável.
 * - Arraste para reordenar as cartas.
 * - Toque para selecionar/destacar uma carta.
 * - Toque em "Jogar ↑" para jogar a carta selecionada.
 */
export const CardFan: FC<CardFanProps> = ({ cards, onPlay }) => {
  const [orderedCards, setOrderedCards] = useState<Card[]>(() => sortInitial(cards));
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [playingCardId, setPlayingCardId] = useState<string | null>(null);

  // Sync when parent cards change (card played or new cards dealt)
  useEffect(() => {
    setOrderedCards((prev) => {
      const cardMap = new Map(cards.map((c) => [c.id, c]));
      const kept = prev.filter((c) => cardMap.has(c.id)).map((c) => cardMap.get(c.id)!);
      const prevIds = new Set(prev.map((c) => c.id));
      const incoming = cards.filter((c) => !prevIds.has(c.id));
      return [...kept, ...sortInitial(incoming)];
    });
  }, [cards]);

  function handleCardTap(card: Card) {
    setSelectedCardId((prev) => (prev === card.id ? null : card.id));
  }

  function handlePlay(card: Card) {
    if (!onPlay || playingCardId) return;
    setPlayingCardId(card.id);
    setSelectedCardId(null);
    setTimeout(() => {
      setPlayingCardId(null);
      onPlay(card);
    }, 300);
  }

  if (orderedCards.length === 0) return null;

  return (
    <div
      style={{
        width: "100%",
        overflowX: "auto",
        overflowY: "visible",
        WebkitOverflowScrolling: "touch",
        paddingBottom: 4,
      }}
    >
      <Reorder.Group
        axis="x"
        values={orderedCards}
        onReorder={setOrderedCards}
        style={{
          display: "flex",
          flexDirection: "row",
          gap: 10,
          padding: "28px 16px 8px",
          listStyle: "none",
          margin: 0,
          width: "max-content",
          minWidth: "100%",
          justifyContent: "center",
          alignItems: "flex-end",
        }}
      >
        {orderedCards.map((card) => {
          const isSelected = selectedCardId === card.id;
          const isFinal = card.tipo === "Final";
          const isPlaying = playingCardId === card.id;
          const bgColor = CARD_TYPE_COLORS[card.tipo] ?? "#923c35";
          const cardImageUrl = `/cards/${card.id}.png`;

          return (
            <Reorder.Item
              key={card.id}
              value={card}
              style={{ listStyle: "none", position: "relative" }}
              onTap={() => handleCardTap(card)}
            >
              <motion.div
                animate={{
                  scale: isPlaying ? 0.8 : isSelected ? 1.12 : isFinal ? 1.04 : 1,
                  y: isPlaying ? -20 : isSelected ? -20 : 0,
                  opacity: isPlaying ? 0 : 1,
                }}
                transition={{ type: "spring", stiffness: 350, damping: 28 }}
                style={{
                  width: "min(28vw, 110px)",
                  height: "min(40vw, 155px)",
                  borderRadius: 12,
                  background: bgColor,
                  border: isSelected || isFinal
                    ? "2px solid #c9a84c"
                    : "1px solid rgba(255,255,255,0.2)",
                  boxShadow: isSelected
                    ? "0 0 20px 6px rgba(201,168,76,0.6), 0 8px 20px rgba(0,0,0,0.6)"
                    : isFinal
                      ? "0 0 12px 4px rgba(201,168,76,0.5), 0 4px 8px rgba(0,0,0,0.4)"
                      : "0 4px 10px rgba(0,0,0,0.35)",
                  position: "relative",
                  cursor: "pointer",
                  userSelect: "none",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                  flexShrink: 0,
                }}
              >
                {/* Card image */}
                <img
                  src={cardImageUrl}
                  alt={card.texto_pt}
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
                    borderRadius: 12,
                    zIndex: 0,
                  }}
                />
                {/* Gradient overlay */}
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: 12,
                    background:
                      "linear-gradient(to top, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.12) 60%)",
                    zIndex: 1,
                  }}
                />
                {/* Type badge */}
                <span
                  style={{
                    position: "absolute",
                    top: 6,
                    fontSize: 9,
                    fontFamily: "var(--font-display), cursive",
                    color: "rgba(255,255,255,0.75)",
                    textTransform: "uppercase",
                    letterSpacing: 1,
                    zIndex: 2,
                  }}
                >
                  {card.tipo}
                </span>
                {isFinal && (
                  <span
                    style={{ position: "absolute", top: 22, fontSize: 16, zIndex: 2 }}
                  >
                    ⭐
                  </span>
                )}
                {/* Card text */}
                <span
                  style={{
                    position: "absolute",
                    bottom: isSelected ? 34 : 8,
                    left: 6,
                    right: 6,
                    fontSize: 10,
                    color: "#f5ebdc",
                    textAlign: "center",
                    lineHeight: 1.3,
                    overflow: "hidden",
                    display: "-webkit-box",
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: "vertical" as const,
                    zIndex: 2,
                    transition: "bottom 0.15s",
                  }}
                >
                  {card.texto_pt}
                </span>
                {/* Play button — only when selected */}
                <AnimatePresence>
                  {isSelected && (
                    <motion.button
                      key="play-btn"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 6 }}
                      transition={{ duration: 0.15 }}
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePlay(card);
                      }}
                      style={{
                        position: "absolute",
                        bottom: 6,
                        zIndex: 10,
                        padding: "3px 10px",
                        borderRadius: 6,
                        background: "#c9a84c",
                        color: "#1a0e05",
                        fontWeight: 700,
                        fontSize: 11,
                        border: "none",
                        cursor: "pointer",
                        fontFamily: "var(--font-title), serif",
                      }}
                    >
                      Jogar ↑
                    </motion.button>
                  )}
                </AnimatePresence>
              </motion.div>
            </Reorder.Item>
          );
        })}
      </Reorder.Group>
    </div>
  );
};
