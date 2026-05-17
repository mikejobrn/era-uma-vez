"use client";

import {
  applyNarratorRotation,
  checkVictory,
  dealCards,
  getCurrentNarrator,
  getNextNarrator,
  undoLastMove,
} from "@era-uma-vez/game-logic";
import { TableCards } from "@era-uma-vez/ui-fantasy";
import type { Card, PlayedCard, Player, Room } from "@era-uma-vez/shared-types";
import { useEffect, useMemo, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "../../lib/supabase";

// ── Inline SVG icons ────────────────────────────────────────────────────────

function CrownIcon({ size = 16, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden="true" style={{ display: "block", flexShrink: 0 }}>
      <path d="M5 16L3 5l5.5 5L12 2l3.5 8L21 5l-2 11H5zm2 3h10v2H7v-2z" />
    </svg>
  );
}

function SkipIcon({ size = 14, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden="true" style={{ display: "block", flexShrink: 0 }}>
      <path d="M6 18l8.5-6L6 6v12zm2-8.14L11.03 12 8 14.14V9.86zM16 6h2v12h-2z" />
    </svg>
  );
}

function UndoIcon({ size = 14, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden="true" style={{ display: "block", flexShrink: 0 }}>
      <path d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62C8.77 11.22 10.54 10.5 12.5 10.5c3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z" />
    </svg>
  );
}

function SparkleIcon({ size = 15, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden="true" style={{ display: "block", flexShrink: 0 }}>
      <path d="M12 2l1.5 4.5L18 8l-4.5 1.5L12 14l-1.5-4.5L6 8l4.5-1.5zm6 10l.75 2.25L21 15l-2.25.75L18 18l-.75-2.25L15 15l2.25-.75zM5 18l.5 1.5L7 20l-1.5.5L5 22l-.5-1.5L3 20l1.5-.5z" />
    </svg>
  );
}

function TrophyIcon({ size = 40, color = "#c9a84c" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden="true" style={{ display: "block" }}>
      <path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94A5.01 5.01 0 0011 15.9V18H9v2h6v-2h-2v-2.1a5.01 5.01 0 003.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.86 10.4 5 9.3 5 8zm14 0c0 1.3-.86 2.4-2 2.82V7h2v1z" />
    </svg>
  );
}

// ────────────────────────────────────────────────────────────────────────────

function generateRoomCode(): string {
  return Math.random().toString(36).substring(2, 7).toUpperCase();
}

type RoomFull = Pick<Room, "id" | "code" | "status" | "narrator_id" | "story_log">;

export default function MesaPage() {
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [joinUrl, setJoinUrl] = useState<string | null>(null);
  const [room, setRoom] = useState<RoomFull | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [roomError, setRoomError] = useState<string | null>(null);
  const [isAdvancingTurn, setIsAdvancingTurn] = useState(false);
  const [isStartingGame, setIsStartingGame] = useState(false);
  const confettiLaunched = useRef(false);

  useEffect(() => {
    const code = generateRoomCode();
    setRoomCode(code);
    const url = `${window.location.origin}/mao?sala=${code}`;
    setJoinUrl(url);

    if (!supabase) return;

    void (async () => {
      const { data, error } = await supabase
        .from("rooms")
        .insert({ code, status: "lobby", story_log: [] })
        .select("id, code, status, narrator_id, story_log")
        .single();
      if (error) {
        setRoomError(formatRoomCreateError(error));
        return;
      }
      if (data) setRoom(data as RoomFull);
    })();
  }, []);

  useEffect(() => {
    if (!supabase || !room?.id) return;
    const client = supabase;

    const fetchPlayers = () => {
      void client
        .from("players")
        .select("id, room_id, name, avatar_url, is_narrator, status, hand, joined_at")
        .eq("room_id", room.id)
        .order("joined_at", { ascending: true })
        .then((result: { data: Player[] | null }) => {
          if (result.data) setPlayers(result.data);
        });
    };

    const fetchRoom = () => {
      void client
        .from("rooms")
        .select("id, code, status, narrator_id, story_log")
        .eq("id", room.id)
        .single()
        .then((result: { data: RoomFull | null }) => {
          if (result.data) setRoom(result.data);
        });
    };

    fetchRoom();
    fetchPlayers();

    const playersChannel = client
      .channel(`room-players-${room.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "players",
          filter: `room_id=eq.${room.id}`,
        },
        fetchPlayers,
      )
      .subscribe();

    const roomsChannel = client
      .channel(`room-${room.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "rooms",
          filter: `id=eq.${room.id}`,
        },
        (payload) => {
          // Use the payload directly to avoid an extra DB round-trip.
          if (payload.new && Object.keys(payload.new).length > 0) {
            setRoom(payload.new as RoomFull);
          } else {
            fetchRoom();
          }
        },
      )
      .subscribe();

    return () => {
      void client.removeChannel(playersChannel);
      void client.removeChannel(roomsChannel);
    };
  }, [room?.id]);

  const activeNarrator = useMemo(
    () => getCurrentNarrator(players, room?.narrator_id ?? null),
    [players, room?.narrator_id],
  );

  const storyLog: PlayedCard[] = useMemo(() => room?.story_log ?? [], [room?.story_log]);
  const winner = useMemo(() => (room ? checkVictory(room as Room) : null), [room]);

  // Launch confetti on victory
  useEffect(() => {
    if (!winner || confettiLaunched.current) return;
    confettiLaunched.current = true;
    void import("canvas-confetti").then(({ default: confetti }) => {
      void confetti({ particleCount: 200, spread: 90, origin: { y: 0.4 } });
    });
  }, [winner]);

  useEffect(() => {
    if (!supabase || !room?.id || players.length === 0) return;

    const nextNarrator = activeNarrator ?? getNextNarrator(players, room.narrator_id);
    if (!nextNarrator) return;

    const synchronizedPlayers = applyNarratorRotation(players, nextNarrator.id);
    const playersNeedSync = synchronizedPlayers.some((player, index) => {
      const currentPlayer = players[index];
      return (
        currentPlayer?.is_narrator !== player.is_narrator || currentPlayer?.status !== player.status
      );
    });

    if (!playersNeedSync && room.narrator_id === nextNarrator.id) return;

    void persistNarratorTurn(room.id, players, nextNarrator.id, setRoomError);
  }, [activeNarrator, players, room?.id, room?.narrator_id]);

  async function handleAdvanceTurn() {
    if (!room) return;

    const nextNarrator = getNextNarrator(players, room.narrator_id);
    if (!nextNarrator) return;

    setIsAdvancingTurn(true);
    setRoomError(null);
    await persistNarratorTurn(room.id, players, nextNarrator.id, setRoomError);
    setIsAdvancingTurn(false);
  }

  async function handleStartGame() {
    if (!room || !supabase) return;
    setIsStartingGame(true);
    setRoomError(null);

    const client = supabase;

    // Fetch cards from DB, fall back to mock deck if unavailable
    let deck: Card[] = [];
    const { data: cardsData } = await client.from("cards").select("*");
    if (cardsData && cardsData.length > 0) {
      deck = cardsData as Card[];
    } else {
      // Local mock deck for offline testing
      deck = generateMockDeck();
    }

    const dealtPlayers = dealCards(deck, players, 7);

    const updates = dealtPlayers.map((player) =>
      client.from("players").update({ hand: player.hand }).eq("id", player.id),
    );

    const [roomResult, ...playerResults] = await Promise.all([
      client.from("rooms").update({ status: "in_progress" }).eq("id", room.id),
      ...updates,
    ]);

    const failedUpdate = playerResults.find((r) => r.error);
    if (roomResult.error || failedUpdate?.error) {
      setRoomError("Não foi possível iniciar a partida.");
    }

    setIsStartingGame(false);
  }

  async function handleUndo() {
    if (!room || !supabase) return;
    const newLog = undoLastMove(storyLog);
    const { error } = await supabase
      .from("rooms")
      .update({ story_log: newLog })
      .eq("id", room.id);
    if (error) setRoomError("Não foi possível desfazer a jogada.");
  }

  const connectedPlayers = players.filter((player) => player.status !== "disconnected");
  const canAdvanceTurn = connectedPlayers.length > 1;
  const canStartGame =
    room?.status === "lobby" && connectedPlayers.length >= 2 && !isStartingGame;

  const isInProgress = room?.status === "in_progress";

  // ── Shared top bar ──────────────────────────────────────────────────────────
  const topBar = (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 16px",
        borderBottom: "1px solid rgba(201,168,76,0.2)",
        flexShrink: 0,
        flexWrap: "wrap",
        background: "rgba(0,0,0,0.3)",
      }}
    >
      {/* Title */}
      <span
        style={{
          color: "var(--color-dourado)",
          fontFamily: "var(--font-display), cursive",
          fontSize: 20,
          lineHeight: 1,
          marginRight: 4,
        }}
      >
        Era Uma Vez
      </span>

      {/* Room code */}
      {roomCode && (
        <span
          style={{
            color: "var(--color-dourado)",
            fontFamily: "var(--font-title), serif",
            fontSize: 13,
            opacity: 0.85,
            letterSpacing: 2,
            border: "1px solid rgba(201,168,76,0.35)",
            borderRadius: 6,
            padding: "2px 8px",
          }}
        >
          {roomCode}
        </span>
      )}

      {/* Player count */}
      {connectedPlayers.length > 0 && (
        <span style={{ fontSize: 12, opacity: 0.6 }}>
          {connectedPlayers.length} jogador{connectedPlayers.length !== 1 ? "es" : ""}
        </span>
      )}

      {/* Narrator */}
      {activeNarrator && (
        <div style={{ display: "flex", alignItems: "center", gap: 5, marginLeft: 4 }}>
          <CrownIcon size={14} color="var(--color-dourado)" />
          <span style={{ fontSize: 13, fontWeight: 600 }}>{activeNarrator.name}</span>
        </div>
      )}

      {roomError && (
        <span style={{ color: "#f87171", fontSize: 11 }}>{roomError}</span>
      )}

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Start game button */}
      {canStartGame && (
        <button
          type="button"
          onClick={() => void handleStartGame()}
          disabled={isStartingGame}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            padding: "6px 14px",
            borderRadius: 8,
            background: "var(--color-dourado)",
            color: "var(--color-fundo)",
            fontFamily: "var(--font-title), serif",
            fontWeight: 700,
            fontSize: 13,
            border: "none",
            cursor: "pointer",
            opacity: isStartingGame ? 0.5 : 1,
          }}
        >
          <SparkleIcon size={14} color="var(--color-fundo)" />
          {isStartingGame ? "Iniciando…" : "Iniciar Partida"}
        </button>
      )}

      {/* Advance turn */}
      {isInProgress && (
        <button
          type="button"
          onClick={() => void handleAdvanceTurn()}
          disabled={!canAdvanceTurn || isAdvancingTurn}
          title="Passar turno"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: "6px 12px",
            borderRadius: 8,
            background: "var(--color-evento)",
            color: "var(--color-pergaminho)",
            fontFamily: "var(--font-title), serif",
            fontWeight: 600,
            fontSize: 12,
            border: "none",
            cursor: canAdvanceTurn ? "pointer" : "not-allowed",
            opacity: !canAdvanceTurn || isAdvancingTurn ? 0.45 : 1,
          }}
        >
          <SkipIcon size={14} color="var(--color-pergaminho)" />
          {isAdvancingTurn ? "…" : "Turno"}
        </button>
      )}

      {/* Undo */}
      {isInProgress && storyLog.length > 0 && (
        <button
          type="button"
          onClick={() => void handleUndo()}
          title="Desfazer última jogada"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "6px 10px",
            borderRadius: 8,
            background: "rgba(120,80,30,0.35)",
            color: "var(--color-dourado)",
            border: "1px solid rgba(201,168,76,0.4)",
            cursor: "pointer",
          }}
        >
          <UndoIcon size={14} color="var(--color-dourado)" />
        </button>
      )}
    </div>
  );

  // ── Victory screen ──────────────────────────────────────────────────────────
  if (winner) {
    return (
      <main
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100dvh",
          overflow: "hidden",
          background: "var(--color-fundo)",
        }}
      >
        {topBar}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            overflowY: "auto",
            padding: "20px 24px",
            gap: 20,
          }}
        >
          <div style={{ textAlign: "center" }}>
            <TrophyIcon size={48} />
            <h1
              style={{
                color: "var(--color-dourado)",
                fontFamily: "var(--font-display), cursive",
                fontSize: 28,
                margin: "8px 0 4px",
              }}
            >
              Fim da História!
            </h1>
            <p style={{ opacity: 0.8, margin: "0 0 4px" }}>
              <strong>{winner.player_name}</strong> encerrou com:
            </p>
            <p
              style={{
                color: "var(--color-dourado)",
                fontStyle: "italic",
                fontSize: 14,
                margin: 0,
              }}
            >
              &ldquo;{winner.card.texto_pt}&rdquo;
            </p>
            <p style={{ opacity: 0.5, fontSize: 12, margin: "8px 0 0" }}>
              E viveram felizes para sempre.
            </p>
          </div>
          <TableCards entries={storyLog} />
        </div>
      </main>
    );
  }

  // ── Normal game screen ──────────────────────────────────────────────────────
  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100dvh",
        overflow: "hidden",
        background: "var(--color-fundo)",
      }}
    >
      {topBar}

      {/* Content */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflowY: "auto",
          padding: "16px 20px",
          gap: 16,
        }}
      >
        {/* Lobby: QR Code */}
        {room?.status === "lobby" && joinUrl && (
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
            }}
          >
            <div
              style={{
                padding: 14,
                borderRadius: 14,
                background: "var(--color-pergaminho)",
              }}
            >
              <QRCodeSVG
                value={joinUrl}
                size={200}
                fgColor="var(--color-texto)"
                bgColor="var(--color-pergaminho)"
              />
            </div>
            <p style={{ fontSize: 12, opacity: 0.5, textAlign: "center", margin: 0 }}>
              Aponte a câmera para entrar na sala
            </p>
          </div>
        )}

        {room?.status === "finished" && (
          <p style={{ opacity: 0.6, fontSize: 13 }}>Partida finalizada.</p>
        )}

        {!room && <p style={{ opacity: 0.5, fontSize: 13 }}>Criando sala…</p>}

        {/* Story log */}
        {storyLog.length > 0 ? (
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "100%",
            }}
          >
            <TableCards entries={storyLog} />
          </div>
        ) : (
          isInProgress && (
            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <p style={{ opacity: 0.25, fontSize: 14, textAlign: "center" }}>
                As cartas jogadas aparecerão aqui…
              </p>
            </div>
          )
        )}
      </div>
    </main>
  );
}

function formatRoomCreateError(error: { message?: string; code?: string; details?: string | null }) {
  const message = error.message?.trim();
  const code = error.code?.trim();
  const details = error.details?.trim();

  const suffix = [code, message, details].filter(Boolean).join(" | ");
  const base =
    "Não foi possível criar a sala. Verifique se as migrations do Supabase foram executadas (rooms/players/policies).";
  return suffix ? `${base} (${suffix})` : base;
}

async function persistNarratorTurn(
  roomId: string,
  players: Player[],
  narratorId: string,
  setRoomError: (message: string | null) => void,
) {
  if (!supabase) return;
  const client = supabase;

  setRoomError(null);

  const synchronizedPlayers = applyNarratorRotation(players, narratorId);
  const updates = synchronizedPlayers.map((player) =>
    client
      .from("players")
      .update({
        is_narrator: player.is_narrator,
        status: player.status,
      })
      .eq("id", player.id),
  );

  const [roomResult, ...playerResults] = await Promise.all([
    client.from("rooms").update({ narrator_id: narratorId }).eq("id", roomId),
    ...updates,
  ]);

  const failedPlayerUpdate = playerResults.find((result) => result.error);
  if (roomResult.error || failedPlayerUpdate?.error) {
    setRoomError("Não foi possível atualizar o turno do narrador.");
  }
}

function generateMockDeck(): Card[] {
  const tipos: Card["tipo"][] = ["Personagem", "Lugar", "Coisa", "Aspecto", "Evento"];
  const texts = [
    "Uma princesa corajosa",
    "Um cavaleiro solitário",
    "Uma floresta encantada",
    "Um castelo nas nuvens",
    "Uma espada mágica",
    "Um mapa do tesouro",
    "Corajoso e determinado",
    "Misterioso e sábio",
    "Uma tempestade repentina",
    "Uma festa surpresa",
    "Um dragão adormecido",
    "Uma bruxa bondosa",
    "Um rio de luz dourada",
    "Uma torre de cristal",
    "Um amuleto antigo",
    "Um livro de feitiços",
    "Gentil e generoso",
    "Astuto e ágil",
    "Uma avalanche de neve",
    "Um eclipse misterioso",
  ];
  const cards: Card[] = texts.map((text, i) => ({
    id: `mock-${i}`,
    deck: "A",
    numero: i + 1,
    tipo: tipos[i % tipos.length]!,
    texto_pt: text,
    texto_en: text,
    interrupt: i % 5 === 0,
    prompt_en: "",
  }));
  // Add a Final card
  cards.push({
    id: "mock-final",
    deck: "A",
    numero: 99,
    tipo: "Final",
    texto_pt: "E viveram felizes para sempre.",
    texto_en: "And they all lived happily ever after.",
    interrupt: false,
    prompt_en: "",
  });
  return cards;
}
