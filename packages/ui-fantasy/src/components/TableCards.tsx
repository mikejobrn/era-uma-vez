"use client";

import { motion } from "framer-motion";
import { type FC, useEffect, useRef, useState } from "react";
import type { PlayedCard } from "@era-uma-vez/shared-types";

const CARD_W = 200;
const CARD_H = 280;
/** Minimum horizontal step between card left edges when stacking. */
const MIN_STEP = 32;
const NATURAL_STEP = CARD_W + 10;

function StarIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="#c9a84c"
      aria-hidden="true"
      style={{ display: "block", filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.7))" }}
    >
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

interface TableCardsProps {
  entries: PlayedCard[];
}

/**
 * Exibe as cartas jogadas em uma única linha horizontal centralizada.
 * Ordenadas da mais recente para a mais antiga.
 * Quando transbordam, sobrepõem-se com a mais recente no topo.
 *
 * Animações:
 * - Nova carta (mais recente): slide-in de cima com bounce leve.
 * - Cartas existentes que se deslocam: translate suave via layout animation.
 */
export const TableCards: FC<TableCardsProps> = ({ entries }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerW, setContainerW] = useState(800);
  // Tracks which entry keys have already been rendered (to distinguish new vs existing).
  const seenKeysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      if (entry) setContainerW(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (entries.length === 0) return null;

  // Reverse: newest first
  const reversed = [...entries].reverse();
  const n = reversed.length;

  const step =
    n <= 1
      ? 0
      : Math.max(MIN_STEP, Math.min(NATURAL_STEP, (containerW - CARD_W) / (n - 1)));
  const totalW = n <= 1 ? CARD_W : (n - 1) * step + CARD_W;
  const startX = Math.max(0, (containerW - totalW) / 2);

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        width: "100%",
        height: CARD_H + 24,
        flexShrink: 0,
      }}
    >
      {reversed.map((entry, index) => {
        const key = `${entry.player_id}-${entry.played_at}`;
        const isNew = !seenKeysRef.current.has(key);
        // Register key immediately so next render doesn't treat this as new.
        seenKeysRef.current.add(key);

        const isFinal = entry.card.tipo === "Final";
        const cardImageUrl = `/cards/${entry.card.id}.png`;
        const x = startX + index * step;
        // Newest card (index 0) has the highest z-index
        const zIndex = n - index;

        return (
          <motion.div
            key={key}
            // layout animates position changes for existing cards (translate with bounce)
            layout
            // New cards slide in from above; existing cards skip entrance animation
            initial={isNew ? { opacity: 0, y: -60, scale: 0.82 } : false}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{
              // Entrance animation for new cards
              type: "spring",
              stiffness: 260,
              damping: 20,
              // Layout (translate) animation for repositioned cards
              layout: { type: "spring", stiffness: 300, damping: 28 },
            }}
            style={{
              position: "absolute",
              left: x,
              top: 12,
              width: CARD_W,
              height: CARD_H,
              borderRadius: 10,
              overflow: "hidden",
              zIndex,
              boxShadow: isFinal
                ? "0 0 18px rgba(201,168,76,0.7), 0 6px 18px rgba(0,0,0,0.6)"
                : "0 4px 14px rgba(0,0,0,0.55)",
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
                display: "block",
                userSelect: "none",
                pointerEvents: "none",
              }}
            />
            {isFinal && (
              <div
                style={{
                  position: "absolute",
                  top: 8,
                  right: 8,
                }}
              >
                <StarIcon size={20} />
              </div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
};
