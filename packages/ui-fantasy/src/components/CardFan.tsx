"use client";

import { type FC, useState } from "react";
import type { Card } from "@era-uma-vez/shared-types";

interface CardFanProps {
  cards: Card[];
  onPlay?: (card: Card) => void;
  /** When true, the Final card button is disabled (player still has other cards). */
  disableFinal?: boolean;
}

const CARD_W = 110;
const CARD_H = 154;

/**
 * Exibe as cartas do jogador em lista simples (sem leque).
 * - Toque para selecionar uma carta e ver detalhes.
 * - Carta só é jogada ao pressionar o botão "Jogar".
 */
export const CardFan: FC<CardFanProps> = ({ cards, onPlay, disableFinal }) => {
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [playingCardId, setPlayingCardId] = useState<string | null>(null);

  function handleCardTap(card: Card) {
    setSelectedCardId((prev) => (prev === card.id ? null : card.id));
  }

  function handlePlay(card: Card) {
    if (!onPlay || playingCardId) return;
    if (disableFinal && card.tipo === "Final") return;
    setPlayingCardId(card.id);
    setSelectedCardId(null);
    onPlay(card);
    setTimeout(() => {
      setPlayingCardId(null);
    }, 350);
  }

  if (cards.length === 0) return null;

  const selectedCard = selectedCardId
    ? cards.find((c) => c.id === selectedCardId) ?? null
    : null;

  return (
    <>
      {/* Full-screen overlay when a card is selected */}
      {selectedCard && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setSelectedCardId(null)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.82)",
              zIndex: 1000,
            }}
          />
          {/* Expanded card */}
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "fixed",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
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
          </div>
          {/* Play button below the expanded card */}
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "fixed",
              top: "calc(50% + min(72vw, 340px) * 0.7 + 18px)",
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 1002,
            }}
          >
            <button
              type="button"
              disabled={disableFinal && selectedCard.tipo === "Final"}
              onClick={(e) => {
                e.stopPropagation();
                handlePlay(selectedCard);
              }}
              style={{
                padding: "10px 34px",
                borderRadius: 8,
                background: disableFinal && selectedCard.tipo === "Final" ? "#666" : "#c9a84c",
                color: "#1a0e05",
                fontWeight: 700,
                fontSize: 14,
                border: "none",
                cursor: disableFinal && selectedCard.tipo === "Final" ? "not-allowed" : "pointer",
                fontFamily: "var(--font-title), serif",
                boxShadow: "0 8px 20px rgba(0,0,0,0.45)",
                opacity: disableFinal && selectedCard.tipo === "Final" ? 0.5 : 1,
              }}
            >
              {disableFinal && selectedCard.tipo === "Final"
                ? "Jogue as outras primeiro"
                : "Jogar"}
            </button>
          </div>
        </>
      )}

      {/* Card list (simple grid, no fan) */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
          justifyContent: "center",
          padding: "8px 12px",
          overflowY: "auto",
          maxHeight: "50dvh",
        }}
      >
        {cards.map((card) => {
          const isSelected = selectedCardId === card.id;
          const isPlaying = playingCardId === card.id;
          const isFinal = card.tipo === "Final";
          const isFinalDisabled = disableFinal && isFinal;

          return (
            <div
              key={card.id}
              onClick={() => !isPlaying && handleCardTap(card)}
              style={{
                width: CARD_W,
                height: CARD_H,
                borderRadius: 10,
                border: isFinal
                  ? "2px solid #c9a84c"
                  : isSelected
                    ? "2px solid rgba(201,168,76,0.8)"
                    : "1px solid rgba(255,255,255,0.2)",
                boxShadow: isSelected
                  ? "0 0 12px 3px rgba(201,168,76,0.5), 0 4px 12px rgba(0,0,0,0.5)"
                  : isFinal
                    ? "0 0 8px 3px rgba(201,168,76,0.4), 0 3px 6px rgba(0,0,0,0.4)"
                    : "0 3px 8px rgba(0,0,0,0.35)",
                cursor: "pointer",
                userSelect: "none",
                overflow: "hidden",
                position: "relative",
                opacity: isPlaying ? 0.4 : isFinalDisabled ? 0.5 : 1,
                transition: "opacity 0.2s, transform 0.2s, box-shadow 0.2s",
                transform: isSelected ? "scale(1.05)" : "scale(1)",
                flexShrink: 0,
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
              {isFinalDisabled && (
                <div
                  style={{
                    position: "absolute",
                    bottom: 4,
                    left: 0,
                    right: 0,
                    textAlign: "center",
                    fontSize: 9,
                    color: "#fff",
                    background: "rgba(0,0,0,0.7)",
                    padding: "2px 4px",
                    borderRadius: "0 0 8px 8px",
                  }}
                >
                  🔒 Final
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
};

