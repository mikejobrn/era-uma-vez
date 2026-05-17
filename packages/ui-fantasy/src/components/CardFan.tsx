"use client";

import { AnimatePresence, motion } from "framer-motion";
import { type FC, useEffect, useRef, useState } from "react";
import type { Card } from "@era-uma-vez/shared-types";

interface CardFanProps {
  cards: Card[];
  onPlay?: (card: Card) => void;
}

const CARD_W = 130;
const CARD_H = 182;
/** Total height of the fan container. */
const CONTAINER_H = CARD_H + 72;
/** Side padding to absorb horizontal overflow caused by rotation. */
const SIDE = 48;

function sortInitial(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => {
    if (a.tipo === "Final" && b.tipo !== "Final") return 1;
    if (b.tipo === "Final" && a.tipo !== "Final") return -1;
    return 0;
  });
}

function getAngle(i: number, n: number): number {
  if (n <= 1) return 0;
  const maxAngle = Math.min(52, Math.max(14, n * 6));
  return -maxAngle + (i * 2 * maxAngle) / (n - 1);
}

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
 * - Toque para selecionar: carta expande em overlay de tela cheia.
 * - Toque fora da carta para desselecionar.
 * - Toque em "Jogar" no overlay para jogar.
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
  const selectedCard = selectedCardId
    ? orderedCards.find((c) => c.id === selectedCardId) ?? null
    : null;

  return (
    <>
      {/* Full-screen overlay when a card is selected */}
      <AnimatePresence>
        {selectedCard && (
          <>
            {/* Backdrop — click to deselect */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={() => setSelectedCardId(null)}
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.82)",
                zIndex: 1000,
              }}
            />
            {/* Expanded card */}
            <motion.div
              key="expanded-card"
              initial={{ scale: 0.65, opacity: 0, x: "-50%", y: "-50%" }}
              animate={{ scale: 1, opacity: 1, x: "-50%", y: "-50%" }}
              exit={{ scale: 0.65, opacity: 0, x: "-50%", y: "-50%" }}
              transition={{ type: "spring", stiffness: 320, damping: 28 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                position: "fixed",
                top: "50%",
                left: "50%",
                zIndex: 1001,
                width: "min(72vw, 340px)",
                aspectRatio: `${CARD_W}/${CARD_H}`,
                borderRadius: 16,
                overflow: "hidden",
                boxShadow:
                  selectedCard.tipo === "Final"
                    ? "0 0 32px rgba(201,168,76,0.7), 0 20px 48px rgba(0,0,0,0.85)"
                    : "0 0 20px rgba(201,168,76,0.25), 0 20px 48px rgba(0,0,0,0.85)",
              }}
            >
              <img
                src={`/cards/${selectedCard.id}.png`}
                alt={selectedCard.texto_pt}
                draggable={false}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  display: "block",
                  userSelect: "none",
                  pointerEvents: "none",
                }}
              />
            </motion.div>
            {/* Play button below the expanded card */}
            <motion.div
              key="expanded-card-play-button"
              initial={{ opacity: 0, y: 10, x: "-50%" }}
              animate={{ opacity: 1, y: 0, x: "-50%" }}
              exit={{ opacity: 0, y: 10, x: "-50%" }}
              transition={{ duration: 0.18 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                position: "fixed",
                top: "calc(50% + min(72vw, 340px) * 0.7 + 18px)",
                left: "50%",
                zIndex: 1002,
              }}
            >
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  handlePlay(selectedCard);
                }}
                style={{
                  padding: "10px 34px",
                  borderRadius: 8,
                  background: "#c9a84c",
                  color: "#1a0e05",
                  fontWeight: 700,
                  fontSize: 14,
                  border: "none",
                  cursor: "pointer",
                  fontFamily: "var(--font-title), serif",
                  boxShadow: "0 8px 20px rgba(0,0,0,0.45)",
                }}
              >
                Jogar
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Card fan */}
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
          const zIndex = isSelected ? n + 10 : isPlaying ? n + 5 : i;

          return (
            <motion.div
              key={card.id}
              onClick={() => handleCardTap(card)}
              initial={{ rotate: angle, y: 20, opacity: 0, scale: 0.85 }}
              animate={{
                rotate: isPlaying ? 0 : angle,
                y: isPlaying ? -120 : 0,
                opacity: isPlaying ? 0 : 1,
                scale: isPlaying ? 0.8 : isSelected ? 1.06 : 1,
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
                border: isFinal
                  ? "2px solid #c9a84c"
                  : isSelected
                    ? "2px solid rgba(201,168,76,0.8)"
                    : "1px solid rgba(255,255,255,0.2)",
                boxShadow: isSelected
                  ? "0 0 16px 4px rgba(201,168,76,0.5), 0 6px 16px rgba(0,0,0,0.5)"
                  : isFinal
                    ? "0 0 12px 4px rgba(201,168,76,0.5), 0 4px 8px rgba(0,0,0,0.4)"
                    : "0 4px 10px rgba(0,0,0,0.35)",
                cursor: "pointer",
                userSelect: "none",
                overflow: "hidden",
                transformOrigin: "bottom center",
              }}
            >
              <img
                src={`/cards/${card.id}.png`}
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
                  userSelect: "none",
                  pointerEvents: "none",
                }}
              />
            </motion.div>
          );
        })}
      </div>
    </>
  );
};

