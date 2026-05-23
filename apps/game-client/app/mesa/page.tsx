"use client";

import {
  applyNarratorRotation,
  checkVictory,
  dealCards,
  getHandSize,
  getCurrentNarrator,
  getLastPlayedCard,
  getNextNarrator,
  undoLastMove,
  addCardToHand,
} from "@era-uma-vez/game-logic";
import { TableCards } from "@era-uma-vez/ui-fantasy";
import type { Card, CardDeck, PlayedCard, Player, Room } from "@era-uma-vez/shared-types";
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

function RestartIcon({ size = 14, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden="true" style={{ display: "block", flexShrink: 0 }}>
      <path d="M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
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

type RoomFull = Pick<Room, "id" | "code" | "status" | "narrator_id" | "story_log" | "deck_type" | "draw_pile">;

const MESA_SESSION_KEY = "era-uma-vez-mesa-session";

interface MesaSession {
  roomId: string;
  roomCode: string;
}

export default function MesaPage() {
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [joinUrl, setJoinUrl] = useState<string | null>(null);
  const [room, setRoom] = useState<RoomFull | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [roomError, setRoomError] = useState<string | null>(null);
  const [isAdvancingTurn, setIsAdvancingTurn] = useState(false);
  const [isStartingGame, setIsStartingGame] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const [showRestartModal, setShowRestartModal] = useState(false);
  const [restartEditNames, setRestartEditNames] = useState<Record<string, string>>({});
  const [selectedDeck, setSelectedDeck] = useState<CardDeck>("A");
  const [availableDecks, setAvailableDecks] = useState<CardDeck[]>(["A", "B", "C"]);
  const confettiLaunched = useRef(false);

  useEffect(() => {
    // Try restoring a previous mesa session
    let restoredRoom = false;
    try {
      const raw = localStorage.getItem(MESA_SESSION_KEY);
      if (raw) {
        const saved: MesaSession = JSON.parse(raw);
        if (saved.roomId && saved.roomCode) {
          setRoomCode(saved.roomCode);
          setJoinUrl(`${window.location.origin}/mao?sala=${saved.roomCode}`);
          setRoom({ id: saved.roomId, code: saved.roomCode, status: "lobby", narrator_id: null, story_log: [], deck_type: null, draw_pile: [] });
          restoredRoom = true;

          // Re-fetch room state from DB
          if (supabase) {
            void supabase
              .from("rooms")
              .select("id, code, status, narrator_id, story_log, deck_type, draw_pile")
              .eq("id", saved.roomId)
              .single()
              .then(({ data }) => {
                if (data) setRoom(data as RoomFull);
              });
          }
        }
      }
    } catch {
      // ignore parse errors
    }

    if (restoredRoom) return;

    const code = generateRoomCode();
    setRoomCode(code);
    const url = `${window.location.origin}/mao?sala=${code}`;
    setJoinUrl(url);

    if (!supabase) return;

    void (async () => {
      const { data, error } = await supabase
        .from("rooms")
        .insert({ code, status: "lobby", story_log: [], deck_type: null, draw_pile: [] })
        .select("id, code, status, narrator_id, story_log, deck_type, draw_pile")
        .single();
      if (error) {
        setRoomError(formatRoomCreateError(error));
        return;
      }
      if (data) {
        const roomData = data as RoomFull;
        setRoom(roomData);
        localStorage.setItem(MESA_SESSION_KEY, JSON.stringify({ roomId: roomData.id, roomCode: code }));
      }
    })();
  }, []);

  // Fetch available decks from DB
  useEffect(() => {
    if (!supabase) return;
    void supabase
      .from("cards")
      .select("deck")
      .then(({ data }) => {
        if (data && data.length > 0) {
          const decks = [...new Set((data as { deck: CardDeck }[]).map((c) => c.deck))].sort();
          if (decks.length > 0) setAvailableDecks(decks);
        }
      });
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
        .select("id, code, status, narrator_id, story_log, deck_type, draw_pile")
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

    // Fetch cards from DB filtered by selected deck, fall back to mock deck
    let deck: Card[] = [];
    const { data: cardsData } = await client.from("cards").select("*").eq("deck", selectedDeck);
    if (cardsData && cardsData.length > 0) {
      deck = cardsData as Card[];
    } else {
      // Local mock deck for offline testing
      deck = generateMockDeck();
    }

    const handSize = getHandSize(players.length);
    const dealtPlayers = dealCards(deck, players, handSize);

    // Build a draw pile from remaining cards (cards not dealt to any player)
    const dealtCardIds = new Set(dealtPlayers.flatMap((p) => p.hand.map((c) => c.id)));
    const drawPile = deck.filter((c) => !dealtCardIds.has(c.id)).sort(() => Math.random() - 0.5);

    const updates = dealtPlayers.map((player) =>
      client.from("players").update({ hand: player.hand }).eq("id", player.id),
    );

    const [roomResult, ...playerResults] = await Promise.all([
      client.from("rooms").update({ status: "in_progress", deck_type: selectedDeck, draw_pile: drawPile }).eq("id", room.id),
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
    const lastEntry = getLastPlayedCard(storyLog);
    const newLog = undoLastMove(storyLog);

    const client = supabase;
    const roomUpdate = client.from("rooms").update({ story_log: newLog }).eq("id", room.id);

    // Return the card to the player who played it
    if (lastEntry) {
      const player = players.find((p) => p.id === lastEntry.player_id);
      if (player) {
        const updatedHand = addCardToHand(player.hand, lastEntry.card);
        const [roomResult, playerResult] = await Promise.all([
          roomUpdate,
          client.from("players").update({ hand: updatedHand }).eq("id", player.id),
        ]);
        if (roomResult.error || playerResult.error) {
          setRoomError("Não foi possível desfazer a jogada.");
        }
        return;
      }
    }

    const { error } = await roomUpdate;
    if (error) setRoomError("Não foi possível desfazer a jogada.");
  }

  async function handleAdvanceTurnWithDraw() {
    if (!room || !supabase) return;

    const currentNarrator = getCurrentNarrator(players, room.narrator_id);
    if (!currentNarrator) return;

    setIsAdvancingTurn(true);
    setRoomError(null);

    // Draw a card from the draw pile for the current narrator
    const drawPile = room.draw_pile ?? [];
    if (drawPile.length > 0) {
      const drawnCard = drawPile[0]!;
      const newDrawPile = drawPile.slice(1);
      const updatedHand = addCardToHand(currentNarrator.hand, drawnCard);

      await Promise.all([
        supabase.from("players").update({ hand: updatedHand }).eq("id", currentNarrator.id),
        supabase.from("rooms").update({ draw_pile: newDrawPile }).eq("id", room.id),
      ]);
    }

    // Now advance the turn
    const nextNarrator = getNextNarrator(players, room.narrator_id);
    if (nextNarrator) {
      await persistNarratorTurn(room.id, players, nextNarrator.id, setRoomError);
    }

    setIsAdvancingTurn(false);
  }

  function handleRestartGame() {
    if (!room || !supabase) return;
    setRestartEditNames(Object.fromEntries(players.map((p) => [p.id, p.name])));
    setShowRestartModal(true);
  }

  async function executeRestart(mode: "keep" | "edit_names" | "modify_players") {
    if (!room || !supabase) return;

    setShowRestartModal(false);
    setIsRestarting(true);
    setRoomError(null);
    confettiLaunched.current = false;

    const client = supabase;

    // If editing names, update player names first
    if (mode === "edit_names") {
      const nameUpdates = players
        .filter((p) => restartEditNames[p.id] && restartEditNames[p.id]!.trim() !== p.name)
        .map((p) =>
          client.from("players").update({ name: restartEditNames[p.id]!.trim() }).eq("id", p.id),
        );
      if (nameUpdates.length > 0) {
        const results = await Promise.all(nameUpdates);
        if (results.some((r) => r.error)) {
          setRoomError("Não foi possível atualizar os apelidos.");
          setIsRestarting(false);
          return;
        }
      }
    }

    // If modifying players, delete all players so everyone must rejoin
    if (mode === "modify_players") {
      const [roomResult, deleteResult] = await Promise.all([
        client.from("rooms").update({ status: "lobby", story_log: [], draw_pile: [], narrator_id: null }).eq("id", room.id),
        client.from("players").delete().eq("room_id", room.id),
      ]);
      if (roomResult.error || deleteResult.error) {
        setRoomError("Não foi possível reiniciar o jogo.");
      }
      setIsRestarting(false);
      return;
    }

    // Reset all players and room to lobby state
    const playerResets = players.map((p) =>
      client.from("players").update({ hand: [], is_narrator: false, status: "waiting" }).eq("id", p.id),
    );

    const [roomResult, ...playerResults] = await Promise.all([
      client.from("rooms").update({ status: "lobby", story_log: [], draw_pile: [], narrator_id: null }).eq("id", room.id),
      ...playerResets,
    ]);

    const failedPlayer = playerResults.find((r) => r.error);
    if (roomResult.error || failedPlayer?.error) {
      setRoomError("Não foi possível reiniciar o jogo.");
    }

    setIsRestarting(false);
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
        gap: 8,
        padding: "4px 12px",
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
          fontSize: 16,
          lineHeight: 1,
          marginRight: 2,
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
            fontSize: 11,
            opacity: 0.85,
            letterSpacing: 2,
            border: "1px solid rgba(201,168,76,0.35)",
            borderRadius: 4,
            padding: "1px 6px",
          }}
        >
          {roomCode}
        </span>
      )}

      {/* Player count */}
      {connectedPlayers.length > 0 && (
        <span style={{ fontSize: 11, opacity: 0.6 }}>
          {connectedPlayers.length}👤
        </span>
      )}

      {/* Narrator */}
      {activeNarrator && (
        <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
          <CrownIcon size={12} color="var(--color-dourado)" />
          <span style={{ fontSize: 12, fontWeight: 600 }}>{activeNarrator.name}</span>
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
            gap: 4,
            padding: "4px 12px",
            borderRadius: 6,
            background: "var(--color-dourado)",
            color: "var(--color-fundo)",
            fontFamily: "var(--font-title), serif",
            fontWeight: 700,
            fontSize: 12,
            border: "none",
            cursor: "pointer",
            opacity: isStartingGame ? 0.5 : 1,
          }}
        >
          <SparkleIcon size={12} color="var(--color-fundo)" />
          {isStartingGame ? "Iniciando…" : "Iniciar"}
        </button>
      )}

      {/* Advance turn */}
      {isInProgress && (
        <button
          type="button"
          onClick={() => void handleAdvanceTurnWithDraw()}
          disabled={!canAdvanceTurn || isAdvancingTurn}
          title="Passar turno (puxa carta)"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: "4px 10px",
            borderRadius: 6,
            background: "var(--color-evento)",
            color: "var(--color-pergaminho)",
            fontFamily: "var(--font-title), serif",
            fontWeight: 600,
            fontSize: 11,
            border: "none",
            cursor: canAdvanceTurn ? "pointer" : "not-allowed",
            opacity: !canAdvanceTurn || isAdvancingTurn ? 0.45 : 1,
          }}
        >
          <SkipIcon size={12} color="var(--color-pergaminho)" />
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
            padding: "4px 8px",
            borderRadius: 6,
            background: "rgba(120,80,30,0.35)",
            color: "var(--color-dourado)",
            border: "1px solid rgba(201,168,76,0.4)",
            cursor: "pointer",
          }}
        >
          <UndoIcon size={12} color="var(--color-dourado)" />
        </button>
      )}

      {/* Restart */}
      {(isInProgress || room?.status === "finished") && (
        <button
          type="button"
          onClick={() => void handleRestartGame()}
          disabled={isRestarting}
          title="Reiniciar jogo"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "4px 8px",
            borderRadius: 6,
            background: "rgba(180,40,40,0.25)",
            color: "#f87171",
            border: "1px solid rgba(248,113,113,0.4)",
            cursor: isRestarting ? "not-allowed" : "pointer",
            opacity: isRestarting ? 0.5 : 1,
          }}
        >
          <RestartIcon size={12} color="#f87171" />
        </button>
      )}
    </div>
  );

  // ── Restart modal ────────────────────────────────────────────────────────────
  const restartModal = showRestartModal && (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.7)",
      }}
      onClick={() => setShowRestartModal(false)}
    >
      <div
        style={{
          background: "var(--color-fundo)",
          border: "1px solid rgba(201,168,76,0.5)",
          borderRadius: 14,
          padding: "24px 28px",
          maxWidth: 400,
          width: "90%",
          maxHeight: "80dvh",
          overflowY: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          style={{
            color: "var(--color-dourado)",
            fontFamily: "var(--font-display), cursive",
            fontSize: 20,
            margin: "0 0 16px",
            textAlign: "center",
          }}
        >
          Reiniciar Jogo
        </h2>

        {/* Option 1: Keep and redistribute */}
        <button
          type="button"
          onClick={() => void executeRestart("keep")}
          style={{
            width: "100%",
            padding: "12px 16px",
            marginBottom: 10,
            borderRadius: 8,
            background: "rgba(201,168,76,0.15)",
            color: "var(--color-dourado)",
            border: "1px solid rgba(201,168,76,0.4)",
            fontFamily: "var(--font-title), serif",
            fontWeight: 600,
            fontSize: 14,
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          🔄 Manter jogadores e redistribuir cartas
        </button>

        {/* Option 2: Edit nicknames */}
        <button
          type="button"
          onClick={() => {
            const editSection = document.getElementById("restart-edit-names");
            if (editSection) {
              editSection.style.display = editSection.style.display === "none" ? "block" : "none";
            }
          }}
          style={{
            width: "100%",
            padding: "12px 16px",
            marginBottom: 10,
            borderRadius: 8,
            background: "rgba(120,80,30,0.25)",
            color: "var(--color-pergaminho)",
            border: "1px solid rgba(201,168,76,0.3)",
            fontFamily: "var(--font-title), serif",
            fontWeight: 600,
            fontSize: 14,
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          ✏️ Editar apelidos dos jogadores
        </button>

        {/* Inline edit names section */}
        <div id="restart-edit-names" style={{ display: "none", marginBottom: 10 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "8px 0" }}>
            {players.map((p) => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12, opacity: 0.6, minWidth: 20 }}>👤</span>
                <input
                  type="text"
                  value={restartEditNames[p.id] ?? p.name}
                  onChange={(e) =>
                    setRestartEditNames((prev) => ({ ...prev, [p.id]: e.target.value }))
                  }
                  style={{
                    flex: 1,
                    padding: "6px 10px",
                    borderRadius: 6,
                    background: "rgba(255,255,255,0.08)",
                    color: "var(--color-pergaminho)",
                    border: "1px solid rgba(201,168,76,0.3)",
                    fontFamily: "var(--font-title), serif",
                    fontSize: 13,
                  }}
                />
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => void executeRestart("edit_names")}
            style={{
              width: "100%",
              padding: "10px 16px",
              marginTop: 8,
              borderRadius: 8,
              background: "var(--color-dourado)",
              color: "var(--color-fundo)",
              border: "none",
              fontFamily: "var(--font-title), serif",
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Salvar e reiniciar
          </button>
        </div>

        {/* Option 3: Modify players (back to lobby) */}
        <button
          type="button"
          onClick={() => void executeRestart("modify_players")}
          style={{
            width: "100%",
            padding: "12px 16px",
            marginBottom: 10,
            borderRadius: 8,
            background: "rgba(100,150,200,0.15)",
            color: "#93c5fd",
            border: "1px solid rgba(147,197,253,0.3)",
            fontFamily: "var(--font-title), serif",
            fontWeight: 600,
            fontSize: 14,
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          👥 Modificar jogadores (voltar ao lobby)
        </button>

        {/* Cancel */}
        <button
          type="button"
          onClick={() => setShowRestartModal(false)}
          style={{
            width: "100%",
            padding: "10px 16px",
            borderRadius: 8,
            background: "transparent",
            color: "var(--color-pergaminho)",
            border: "1px solid rgba(255,255,255,0.15)",
            fontFamily: "var(--font-title), serif",
            fontSize: 13,
            cursor: "pointer",
            opacity: 0.7,
          }}
        >
          Cancelar
        </button>
      </div>
    </div>
  );

  // ── Victory screen ──────────────────────────────────────────────────────────
  if (winner) {
    return (
      <>
        {restartModal}
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
      </>
    );
  }

  // ── Normal game screen ──────────────────────────────────────────────────────
  return (
    <>
      {restartModal}
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
        {/* Lobby: QR Code + Deck Selection */}
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

            {/* Deck selection */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, marginTop: 8 }}>
              <p style={{ fontSize: 12, opacity: 0.7, margin: 0 }}>Escolha o deck:</p>
              <div style={{ display: "flex", gap: 8 }}>
                {availableDecks.map((deck) => (
                  <button
                    key={deck}
                    type="button"
                    onClick={() => setSelectedDeck(deck)}
                    style={{
                      padding: "6px 16px",
                      borderRadius: 8,
                      background: selectedDeck === deck ? "var(--color-dourado)" : "rgba(255,255,255,0.08)",
                      color: selectedDeck === deck ? "var(--color-fundo)" : "var(--color-pergaminho)",
                      border: selectedDeck === deck ? "none" : "1px solid rgba(201,168,76,0.4)",
                      fontFamily: "var(--font-title), serif",
                      fontWeight: 700,
                      fontSize: 14,
                      cursor: "pointer",
                    }}
                  >
                    Deck {deck}
                  </button>
                ))}
              </div>
            </div>
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
    </>
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
  // Add enough Final cards for up to 8 players (1 per player guaranteed)
  const finalTexts = [
    "E viveram felizes para sempre.",
    "E assim termina nossa história.",
    "E nunca mais foram vistos.",
    "E a paz reinou para sempre.",
    "E o mundo mudou para sempre.",
    "E tudo voltou ao normal.",
    "E o feitiço se desfez.",
    "E o sol nasceu novamente.",
  ];
  finalTexts.forEach((text, i) => {
    cards.push({
      id: `mock-final-${i}`,
      deck: "A",
      numero: 90 + i,
      tipo: "Final",
      texto_pt: text,
      texto_en: text,
      interrupt: false,
      prompt_en: "",
    });
  });
  return cards;
}
