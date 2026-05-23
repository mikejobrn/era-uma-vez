"use client";

import {
  appendToStoryLog,
  canInterrupt,
  canPlayCard,
  checkVictory,
  getCurrentNarrator,
  removeCardFromHand,
} from "@era-uma-vez/game-logic";
import { CardFan } from "@era-uma-vez/ui-fantasy";
import type { Card, PlayedCard, Player, Room } from "@era-uma-vez/shared-types";
import { useSearchParams } from "next/navigation";
import { useState, Suspense, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabase";

const SESSION_KEY = "era-uma-vez-session";

interface Session {
  playerId: string;
  roomId: string;
  playerName: string;
  roomCode: string;
}

function MaoContent() {
  const searchParams = useSearchParams();
  const salaCode = searchParams.get("sala");
  const [playerName, setPlayerName] = useState("");
  const [joined, setJoined] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeNarratorName, setActiveNarratorName] = useState<string | null>(null);
  const [isCurrentNarrator, setIsCurrentNarrator] = useState(false);
  const [roomStatus, setRoomStatus] = useState<Room["status"] | null>(null);
  const [hand, setHand] = useState<Card[]>([]);
  const [storyLog, setStoryLog] = useState<PlayedCard[]>([]);
  const [roomNarratorId, setRoomNarratorId] = useState<string | null>(null);
  const [winner, setWinner] = useState<PlayedCard | null>(null);
  const [isPlayingCard, setIsPlayingCard] = useState(false);
  const [otherPlayers, setOtherPlayers] = useState<Pick<Player, "id" | "name" | "hand">[]>([]);

  useEffect(() => {
    if (!salaCode) return;
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (raw) {
        const saved: Session = JSON.parse(raw);
        if (saved.roomCode === salaCode) {
          setSession(saved);
          setPlayerName(saved.playerName);
          setJoined(true);
        }
      }
    } catch {
      // ignore parse errors
    }
  }, [salaCode]);

  const syncRoomState = useCallback(async () => {
    if (!supabase || !session?.roomId) return;
    const client = supabase;

    const [{ data: room }, { data: players }, { data: playerData }] = await Promise.all([
      client.from("rooms").select("id, code, status, narrator_id, story_log").eq("id", session.roomId).single(),
      client.from("players").select("id, room_id, name, avatar_url, is_narrator, status, hand, joined_at").eq("room_id", session.roomId).order("joined_at", { ascending: true }),
      client.from("players").select("hand").eq("id", session.playerId).single(),
    ]);

    if (!room || !players) return;

    const typedRoom = room as Room;
    const typedPlayers = players as Player[];

    const narrator = getCurrentNarrator(typedPlayers, typedRoom.narrator_id);
    setActiveNarratorName(narrator?.name ?? null);
    setIsCurrentNarrator(narrator?.id === session.playerId);
    setRoomStatus(typedRoom.status);
    setStoryLog(typedRoom.story_log ?? []);
    setRoomNarratorId(typedRoom.narrator_id);

    // Store other players (everyone except self)
    setOtherPlayers(
      typedPlayers
        .filter((p) => p.id !== session.playerId)
        .map((p) => ({ id: p.id, name: p.name, hand: p.hand })),
    );

    if (playerData) {
      setHand((playerData as { hand: Card[] }).hand ?? []);
    }

    const victory = checkVictory(typedRoom);
    if (victory) {
      setWinner(victory);
    }
  }, [session?.playerId, session?.roomId]);

  useEffect(() => {
    if (!supabase || !session?.roomId) return;
    const client = supabase;

    void syncRoomState();

    const roomChannel = client
      .channel(`mao-room-${session.roomId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rooms", filter: `id=eq.${session.roomId}` },
        () => void syncRoomState(),
      )
      .subscribe();

    const playersChannel = client
      .channel(`mao-players-${session.roomId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "players", filter: `room_id=eq.${session.roomId}` },
        () => void syncRoomState(),
      )
      .subscribe();

    return () => {
      void client.removeChannel(roomChannel);
      void client.removeChannel(playersChannel);
    };
  }, [session?.playerId, session?.roomId, syncRoomState]);

  async function handlePlayCard(card: Card) {
    if (!session || !supabase || isPlayingCard) return;
    if (!canPlayCard(card, hand)) return;
    setIsPlayingCard(true);

    const client = supabase;
    const isInterrupt = canInterrupt(card) && !isCurrentNarrator;

    const entry: PlayedCard = {
      player_id: session.playerId,
      player_name: session.playerName,
      card,
      played_at: new Date().toISOString(),
    };

    const newLog = appendToStoryLog(storyLog, entry);
    const newHand = removeCardFromHand(hand, card.id);

    const ops = [
      client.from("rooms").update({ story_log: newLog }).eq("id", session.roomId),
      client.from("players").update({ hand: newHand }).eq("id", session.playerId),
    ] as const;

    if (isInterrupt) {
      await Promise.all([
        ...ops,
        client.from("rooms").update({ narrator_id: session.playerId }).eq("id", session.roomId),
        client
          .from("players")
          .update({ is_narrator: false, status: "waiting" })
          .eq("id", roomNarratorId ?? ""),
        client
          .from("players")
          .update({ is_narrator: true, status: "active" })
          .eq("id", session.playerId),
      ]);
    } else {
      await Promise.all(ops);
    }

    setHand(newHand);
    setStoryLog(newLog);
    setIsPlayingCard(false);
  }

  async function handlePassTurn() {
    if (!session || !supabase) return;
    // Narrator passes turn — handled by Mesa; here we just signal via rooms
    await supabase
      .from("rooms")
      .update({ narrator_id: null })
      .eq("id", session.roomId);
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!playerName.trim() || !salaCode) return;
    setLoading(true);
    setError(null);

    if (!supabase) {
      const localSession: Session = {
        playerId: crypto.randomUUID(),
        roomId: "local",
        playerName: playerName.trim(),
        roomCode: salaCode,
      };
      localStorage.setItem(SESSION_KEY, JSON.stringify(localSession));
      setSession(localSession);
      setJoined(true);
      setLoading(false);
      return;
    }

    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .select("id, status")
      .eq("code", salaCode)
      .single();

    if (roomError || !room) {
      setError("Sala não encontrada. Verifique o código e tente novamente.");
      setLoading(false);
      return;
    }

    if ((room as { status: Room["status"] }).status !== "lobby") {
      setError("A partida já foi iniciada. Não é mais possível entrar nesta sala.");
      setLoading(false);
      return;
    }

    const { data: player, error: playerError } = await supabase
      .from("players")
      .insert({ room_id: (room as { id: string }).id, name: playerName.trim() })
      .select("id")
      .single();

    if (playerError || !player) {
      setError("Erro ao entrar na sala. Tente novamente.");
      setLoading(false);
      return;
    }

    const newSession: Session = {
      playerId: (player as { id: string }).id,
      roomId: (room as { id: string }).id,
      playerName: playerName.trim(),
      roomCode: salaCode,
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(newSession));
    setSession(newSession);
    setJoined(true);
    setLoading(false);
  }

  if (!salaCode) {
    return (
      <main
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100dvh",
          overflow: "hidden",
          padding: 32,
        }}
      >
        <p style={{ opacity: 0.6, textAlign: "center" }}>
          Nenhuma sala encontrada. Escaneie o QR Code da Mesa para entrar.
        </p>
      </main>
    );
  }

  if (winner) {
    return (
      <main
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100dvh",
          overflow: "hidden",
          padding: 32,
          textAlign: "center",
        }}
      >
        <p style={{ fontSize: 56 }}>🎉</p>
        <h2
          style={{
            color: "var(--color-dourado)",
            fontFamily: "var(--font-display), cursive",
            fontSize: 28,
            margin: "8px 0",
          }}
        >
          Fim da História!
        </h2>
        <p style={{ opacity: 0.8 }}>
          <strong>{winner.player_name}</strong> encerrou com:
        </p>
        <p style={{ color: "var(--color-dourado)", margin: "8px 0" }}>
          &ldquo;{winner.card.texto_pt}&rdquo;
        </p>
        <p style={{ opacity: 0.5, fontSize: 13, marginTop: 16 }}>
          E viveram felizes para sempre.
        </p>
      </main>
    );
  }

  if (joined && session) {
    const isInProgress = roomStatus === "in_progress";
    const hasHand = hand.length > 0;

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
        {/* ── Header ── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 14px",
            borderBottom: "1px solid rgba(201,168,76,0.2)",
            flexShrink: 0,
          }}
        >
          <p
            style={{
              fontFamily: "var(--font-display), cursive",
              color: "var(--color-dourado)",
              fontWeight: 700,
              fontSize: 16,
              margin: 0,
            }}
          >
            {session.playerName}
          </p>
          {activeNarratorName && (
            <p style={{ fontSize: 13, opacity: 0.8, margin: 0 }}>
              👑 {activeNarratorName}
            </p>
          )}
        </div>

        {/* ── Other players strip ── */}
        {otherPlayers.length > 0 && (
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              gap: 8,
              padding: "6px 14px",
              borderBottom: "1px solid rgba(201,168,76,0.1)",
              flexShrink: 0,
              overflowX: "auto",
            }}
          >
            {otherPlayers.map((p) => (
              <div
                key={p.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "3px 8px",
                  borderRadius: 20,
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
              >
                <span style={{ fontSize: 12, opacity: 0.8 }}>{p.name}</span>
                <span
                  style={{
                    fontSize: 11,
                    color: "var(--color-dourado)",
                    fontWeight: 600,
                  }}
                >
                  {p.hand?.length ?? 0} 🃏
                </span>
              </div>
            ))}
          </div>
        )}

        {/* ── Middle: status messages ── */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "8px 16px",
            gap: 10,
            minHeight: 0,
          }}
        >
          {!isInProgress && (
            <div style={{ textAlign: "center" }}>
              <h2
                style={{
                  color: "var(--color-dourado)",
                  fontFamily: "var(--font-display), cursive",
                  fontSize: 22,
                  margin: "0 0 6px",
                }}
              >
                Aguardando…
              </h2>
              <p style={{ opacity: 0.6, fontSize: 13, margin: 0 }}>
                Aguarde o início da partida na Mesa.
              </p>
            </div>
          )}

          {isInProgress && isCurrentNarrator && (
            <div
              style={{
                padding: "10px 16px",
                borderRadius: 10,
                background: "rgba(201,168,76,0.12)",
                border: "1px solid rgba(201,168,76,0.4)",
                textAlign: "center",
              }}
            >
              <p style={{ color: "var(--color-dourado)", fontWeight: 600, fontSize: 14, margin: "0 0 8px" }}>
                👑 É a sua vez de narrar!
              </p>
              <button
                type="button"
                onClick={() => void handlePassTurn()}
                style={{
                  padding: "6px 16px",
                  borderRadius: 8,
                  background: "var(--color-evento)",
                  color: "var(--color-pergaminho)",
                  fontFamily: "var(--font-title), serif",
                  fontWeight: 600,
                  fontSize: 13,
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Passar turno
              </button>
            </div>
          )}

          {isInProgress && !isCurrentNarrator && activeNarratorName && (
            <p style={{ fontSize: 13, opacity: 0.55, textAlign: "center", margin: 0 }}>
              {activeNarratorName} está narrando.{" "}
              {hand.some((c) => c.interrupt) && "Jogue uma carta de interrupção para assumir."}
            </p>
          )}

          {isInProgress && !hasHand && (
            <p style={{ opacity: 0.45, fontSize: 13, textAlign: "center", margin: 0 }}>
              Aguardando distribuição das cartas…
            </p>
          )}
        </div>

        {/* ── Card fan ── */}
        {isInProgress && hasHand && (
          <div
            style={{
              flexShrink: 0,
              paddingBottom: 16,
              paddingTop: 8,
              borderTop: "1px solid rgba(201,168,76,0.15)",
              background: "rgba(0,0,0,0.25)",
            }}
          >
            <CardFan
              cards={hand}
              onPlay={(card) => void handlePlayCard(card)}
              disableFinal={hand.length > 1 && hand.some((c) => c.tipo === "Final")}
            />
          </div>
        )}
      </main>
    );
  }

  // Join form
  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100dvh",
        overflow: "hidden",
        padding: 32,
        gap: 20,
      }}
    >
      <h1
        style={{
          color: "var(--color-dourado)",
          fontFamily: "var(--font-display), cursive",
          fontSize: 32,
          textAlign: "center",
          margin: 0,
        }}
      >
        Era Uma Vez
      </h1>
      <p style={{ opacity: 0.7, margin: 0 }}>
        Sala: <strong>{salaCode}</strong>
      </p>
      {error && <p style={{ color: "#f87171", fontSize: 13, textAlign: "center" }}>{error}</p>}
      <form
        onSubmit={handleJoin}
        style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%", maxWidth: 300 }}
      >
        <input
          type="text"
          placeholder="Seu nome de herói..."
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
          maxLength={24}
          style={{
            width: "100%",
            padding: "12px 16px",
            borderRadius: 10,
            fontSize: 16,
            border: "2px solid var(--color-dourado)",
            background: "transparent",
            color: "var(--color-pergaminho)",
            outline: "none",
            boxSizing: "border-box",
          }}
        />
        <button
          type="submit"
          disabled={!playerName.trim() || loading}
          style={{
            width: "100%",
            padding: "12px 24px",
            borderRadius: 10,
            fontSize: 16,
            fontWeight: 700,
            background: "var(--color-evento)",
            color: "var(--color-pergaminho)",
            border: "none",
            cursor: "pointer",
            opacity: !playerName.trim() || loading ? 0.45 : 1,
            fontFamily: "var(--font-title), serif",
          }}
        >
          {loading ? "Entrando..." : "Entrar na Partida"}
        </button>
      </form>
    </main>
  );
}

export default function MaoPage() {
  return (
    <Suspense>
      <MaoContent />
    </Suspense>
  );
}
