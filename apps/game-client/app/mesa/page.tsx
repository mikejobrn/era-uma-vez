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
          event: "*",
          schema: "public",
          table: "rooms",
          filter: `id=eq.${room.id}`,
        },
        fetchRoom,
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

  if (winner) {
    return (
      <main
        style={{
          display: "flex",
          flexDirection: "row",
          height: "100dvh",
          overflow: "hidden",
          background: "var(--color-fundo)",
        }}
      >
        {/* Left panel */}
        <div
          style={{
            width: 300,
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            gap: 12,
            borderRight: "1px solid rgba(201,168,76,0.2)",
          }}
        >
          <p style={{ fontSize: 56 }}>🎉</p>
          <h1
            style={{
              color: "var(--color-dourado)",
              fontFamily: "var(--font-display), cursive",
              fontSize: 28,
              textAlign: "center",
            }}
          >
            Fim da História!
          </h1>
          <p style={{ opacity: 0.8, textAlign: "center" }}>
            <strong>{winner.player_name}</strong> encerrou com:
          </p>
          <p
            style={{
              color: "var(--color-dourado)",
              textAlign: "center",
              fontStyle: "italic",
              fontSize: 14,
            }}
          >
            &ldquo;{winner.card.texto_pt}&rdquo;
          </p>
          <p style={{ opacity: 0.5, fontSize: 12 }}>E viveram felizes para sempre.</p>
        </div>
        {/* Right panel — story cards */}
        <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
          <TableCards entries={storyLog} />
        </div>
      </main>
    );
  }

  const isInProgress = room?.status === "in_progress";

  return (
    <main
      style={{
        display: "flex",
        flexDirection: "row",
        height: "100dvh",
        overflow: "hidden",
        background: "var(--color-fundo)",
      }}
    >
      {/* ── Left panel ──────────────────────────────────────── */}
      <div
        style={{
          width: 260,
          minWidth: 200,
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          padding: "12px 14px",
          gap: 12,
          borderRight: "1px solid rgba(201,168,76,0.2)",
          overflowY: "auto",
        }}
      >
        <h1
          style={{
            color: "var(--color-dourado)",
            fontFamily: "var(--font-display), cursive",
            fontSize: 22,
            margin: 0,
          }}
        >
          Era Uma Vez
        </h1>

        {/* Lobby: QR Code */}
        {room?.status === "lobby" && roomCode && joinUrl && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
            <p style={{ opacity: 0.7, fontSize: 13, margin: 0 }}>
              Sala:{" "}
              <strong style={{ color: "var(--color-dourado)", fontSize: 18 }}>{roomCode}</strong>
            </p>
            <div
              style={{
                padding: 10,
                borderRadius: 10,
                background: "var(--color-pergaminho)",
              }}
            >
              <QRCodeSVG
                value={joinUrl}
                size={170}
                fgColor="var(--color-texto)"
                bgColor="var(--color-pergaminho)"
              />
            </div>
            <p style={{ fontSize: 11, opacity: 0.5, textAlign: "center", margin: 0 }}>
              Aponte a câmera para entrar
            </p>
            {connectedPlayers.length > 0 && (
              <p style={{ fontSize: 12, opacity: 0.7, margin: 0 }}>
                {connectedPlayers.length} jogador{connectedPlayers.length !== 1 ? "es" : ""} conectado{connectedPlayers.length !== 1 ? "s" : ""}
              </p>
            )}
          </div>
        )}

        {room?.status === "finished" && (
          <p style={{ opacity: 0.6, fontSize: 13 }}>Partida finalizada.</p>
        )}

        {!room && <p style={{ opacity: 0.5, fontSize: 13 }}>Criando sala...</p>}

        {roomError && (
          <p style={{ color: "#f87171", fontSize: 12 }}>{roomError}</p>
        )}

        {/* Start game button */}
        {canStartGame && (
          <button
            type="button"
            onClick={() => void handleStartGame()}
            disabled={isStartingGame}
            style={{
              padding: "10px 16px",
              borderRadius: 10,
              background: "var(--color-dourado)",
              color: "var(--color-fundo)",
              fontFamily: "var(--font-title), serif",
              fontWeight: 700,
              fontSize: 15,
              border: "none",
              cursor: "pointer",
              opacity: isStartingGame ? 0.5 : 1,
            }}
          >
            {isStartingGame ? "Iniciando..." : "✨ Iniciar Partida"}
          </button>
        )}

        {/* Narrator section */}
        <div
          style={{
            borderRadius: 8,
            background: "rgba(201,168,76,0.08)",
            border: "1px solid rgba(201,168,76,0.25)",
            padding: "8px 10px",
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
            <span
              style={{
                color: "var(--color-dourado)",
                fontFamily: "var(--font-title), serif",
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: 1,
                opacity: 0.7,
              }}
            >
              Narrador
            </span>
            <span style={{ fontSize: 13, fontWeight: 600, opacity: activeNarrator ? 1 : 0.4 }}>
              {activeNarrator ? `👑 ${activeNarrator.name}` : "—"}
            </span>
          </div>

          {/* Action buttons — compact row */}
          {isInProgress && (
            <div style={{ display: "flex", gap: 5 }}>
              <button
                type="button"
                onClick={() => void handleAdvanceTurn()}
                disabled={!canAdvanceTurn || isAdvancingTurn}
                title="Passar turno"
                style={{
                  flex: 1,
                  padding: "4px 6px",
                  borderRadius: 6,
                  background: "var(--color-evento)",
                  color: "var(--color-pergaminho)",
                  fontFamily: "var(--font-title), serif",
                  fontWeight: 600,
                  fontSize: 11,
                  border: "none",
                  cursor: canAdvanceTurn ? "pointer" : "not-allowed",
                  opacity: !canAdvanceTurn || isAdvancingTurn ? 0.45 : 1,
                  whiteSpace: "nowrap",
                }}
              >
                {isAdvancingTurn ? "…" : "⏭ Turno"}
              </button>

              {storyLog.length > 0 && (
                <button
                  type="button"
                  onClick={() => void handleUndo()}
                  title="Desfazer última jogada"
                  style={{
                    padding: "4px 8px",
                    borderRadius: 6,
                    background: "rgba(120,80,30,0.35)",
                    color: "var(--color-dourado)",
                    fontFamily: "var(--font-title), serif",
                    fontWeight: 600,
                    fontSize: 11,
                    border: "1px solid rgba(201,168,76,0.4)",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  ↩
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Right panel: story log ───────────────────────────── */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          padding: "16px 20px",
          gap: 12,
          overflowY: "auto",
        }}
      >
        {storyLog.length > 0 ? (
          <>
            <h2
              style={{
                color: "var(--color-dourado)",
                fontFamily: "var(--font-title), serif",
                fontSize: 14,
                margin: 0,
                opacity: 0.7,
                textTransform: "uppercase",
                letterSpacing: 1,
              }}
            >
              História — {storyLog.length} carta{storyLog.length !== 1 ? "s" : ""}
            </h2>
            <TableCards entries={storyLog} />
          </>
        ) : (
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
