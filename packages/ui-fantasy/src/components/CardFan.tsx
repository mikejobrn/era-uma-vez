"use client";

import { AnimatePresence, motion } from "framer-motion";
import { type FC, useEffect, useRef, useState } from "react";
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

const CARD_W = 130;
const CARD_H = 182;
/** Total height of the fan container. Cards sit at bottom; selected card lifts up. */
const CONTAINER_H = CARD_H + 72;
/** Side padding to absorb the horizontal overflow caused by rotation. */
const SIDE = 48;

function sortInitial(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => {
    if (a.tipo === "Final" && b.tipo !== "Final") return 1;
    if (b.tipo === "Final" && a.tipo !== "Final") return -1;
    return 0;
  });
}

/** Returns the rotation angle (degrees) for card at position i out of n total. */
function getAngle(i: number, n: number): number {
  if (n <= 1) return 0;
  const maxAngle = Math.min(52, Math.max(14, n * 6));
  return -maxAngle + (i * 2 * maxAngle) / (n - 1);
}

/** Returns the left-edge pixel offset for each card given the container width. */
function getCardPositions(n: number, containerW: number): number[] {
  if (n === 0 || containerW === 0) return [];
  const usable = containerW - 2 * SIDE;
  const naturalStep = CARD_W + 10;
  const maxStep = n <= 1 ? 0 : (usable - CARD_W) / (n - 1);
  const step = Math.max(28, Math.min(naturalStep, maxStep));
  const totalW = n <= 1 ? CARD_W : (n - 1) * step + CARD_W;
  const startX = SIDE + Math.max(0, (usable - totalW) / 2);
  return Array.from({ length: n }, (_, i) => startX + i * step);
}

/**
 * Exibe as cartas do jogador em leque.
 * - Cartas distribuídas em arco, expandindo ao máximo o espaço disponível.
 * - Toque para selecionar/destacar; toque em "Jogar ↑" para jogar.
 * - Sem rolagem horizontal.
 */
export const CardFan: FC<CardFanProps> = ({ cards, onPlay }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(320);
  const [orderedCards, setOrderedCards] = useState<Card[]>(() => sortInitial(cards));
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [playingCardId, setPlayingCardId] = useState<string | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      if (entry) setContainerWidth(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Sync when parent cards change (card played or new cards dealt)
  useEffect(() => {
    setOrderedCards((prev) => {
      const map = new Map(cards.map((c) => [c.id, c]));
      const kept = prev.filter((c) => map.has(c.id)).map((c) => map.get(c.id)!);
      const prevIds = new Set(prev.map((c) => c.id));
      const incoming = sortInitial(cards.filter((c) => !prevIds.has(c.id)));
      return [...kept, ...incoming];
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

  const n = orderedCards.length;
  const positions = getCardPositions(n, containerWidth);

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        width: "100%",
        height: CONTAINER_H,
        overflow: "visible",
      }}
    >
      {orderedCards.map((card, i) => {
        const isSelected = selectedCardId === card.id;
        const isPlaying = playingCardId === card.id;
        const isFinal = card.tipo === "Final";
        const angle = getAngle(i, n);
        const leftPos = positions[i] ?? 0;
        const bgColor = CARD_TYPE_COLORS[card.tipo] ?? "#923c35";
        const cardImageUrl = `/cards/${card.id}.png`;
        const zIndex = isSelected ? n + 10 : isPlaying ? n + 5 : i;

        return (
          <motion.div
            key={card.id}
            onClick={() => handleCardTap(card)}
            initial={{ rotate: angle, y: 20, opacity: 0, scale: 0.85 }}
            animate={{
              rotate: isSelected || isPlaying ? 0 : angle,
              y: isPlaying ? -120 : isSelected ? -60 : 0,
              opacity: isPlaying ? 0 : 1,
              scale: isPlaying ? 0.8 : isSelected ? 1.08 : 1,
              zIndex,
            }}
            transition={{ type: "spring", stiffness: 340, damping: 28 }}
            style={{
              position: "absolute",
              bottom: 0,
              left: leftPos,
              width: CARD_W,
              height: CARD_H,
              borderRadius: 10,
              background: bgColor,
              border:
                isSelected || isFinal
                  ? "2px solid #c9a84c"
                  : "1px solid rgba(255,255,255,0.2)",
              boxShadow: isSelected
                ? "0 0 20px 6px rgba(201,168,76,0.6), 0 8px 20px rgba(0,0,0,0.6)"
                : isFinal
                  ? "0 0 12px 4px rgba(201,168,76,0.5), 0 4px 8px rgba(0,0,0,0.4)"
                  : "0 4px 10px rgba(0,0,0,0.35)",
              cursor: "pointer",
              userSelect: "none",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              transformOrigin: "bottom center",
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
                borderRadius: 10,
                zIndex: 0,
              }}
            />
            {/* Gradient overlay */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: 10,
                background:
                  "linear-gradient(to top, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.12) 60%)",
                zIndex: 1,
              }}
            />
            {/* Type badge */}
            <span
              style={{
                position: "absolute",
                top: 8,
                fontSize: 11,
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
              <span style={{ position: "absolute", top: 26, fontSize: 18, zIndex: 2 }}>
                ⭐
              </span>
            )}
            {/* Card text */}
            <span
              style={{
                position: "absolute",
                bottom: isSelected ? 44 : 10,
                left: 8,
                right: 8,
                fontSize: 11,
                color: "#f5ebdc",
                textAlign: "center",
                lineHeight: 1.35,
                overflow: "hidden",
                display: "-webkit-box",
                WebkitLineClamp: 4,
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
                    bottom: 8,
                    zIndex: 10,
                    padding: "4px 14px",
                    borderRadius: 6,
                    background: "#c9a84c",
                    color: "#1a0e05",
                    fontWeight: 700,
                    fontSize: 12,
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
        );
      })}
    </div>
  );
};
