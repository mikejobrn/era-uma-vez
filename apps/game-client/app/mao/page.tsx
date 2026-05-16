"use client";

import {
  appendToStoryLog,
  canInterrupt,
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

function playSfx(type: "play" | "interrupt" | "victory") {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = type === "play" ? 440 : type === "interrupt" ? 330 : 880;
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  } catch {
    // Web Audio not available
  }
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

    if (playerData) {
      setHand((playerData as { hand: Card[] }).hand ?? []);
    }

    const victory = checkVictory(typedRoom);
    if (victory) {
      setWinner(victory);
      playSfx("victory");
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
    setIsPlayingCard(true);

    const client = supabase;
    const isInterrupt = canInterrupt(card) && !isCurrentNarrator;

    playSfx(isInterrupt ? "interrupt" : "play");

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
      .select("id")
      .eq("code", salaCode)
      .single();

    if (roomError || !room) {
      setError("Sala não encontrada. Verifique o código e tente novamente.");
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
      <main className="flex flex-col items-center justify-center min-h-screen gap-6 p-8">
        <p className="opacity-60 text-center">
          Nenhuma sala encontrada. Escaneie o QR Code da Mesa para entrar.
        </p>
      </main>
    );
  }

  if (winner) {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen gap-6 p-8 text-center">
        <p style={{ fontSize: 56 }}>🎉</p>
        <h2
          className="text-3xl font-bold"
          style={{ color: "var(--color-dourado)", fontFamily: "var(--font-display), cursive" }}
        >
          Fim da História!
        </h2>
        <p className="opacity-80">
          <strong>{winner.player_name}</strong> encerrou com:
        </p>
        <p style={{ color: "var(--color-dourado)" }}>
          &ldquo;{winner.card.texto_pt}&rdquo;
        </p>
        <p className="opacity-60 text-sm mt-4">E viveram felizes para sempre.</p>
      </main>
    );
  }

  if (joined && session) {
    const isInProgress = roomStatus === "in_progress";
    const hasHand = hand.length > 0;

    return (
      <main
        className="flex flex-col min-h-screen"
        style={{ background: "var(--color-fundo)" }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ borderBottom: "1px solid rgba(201,168,76,0.2)" }}
        >
          <div>
            <p className="text-sm opacity-60">Sala {salaCode}</p>
            <p
              className="font-bold"
              style={{ color: "var(--color-dourado)", fontFamily: "var(--font-display), cursive" }}
            >
              {session.playerName}
            </p>
          </div>
          <div className="text-right">
            {activeNarratorName && (
              <p className="text-sm opacity-80">
                👑 {activeNarratorName}
              </p>
            )}
            <p className="text-xs opacity-50">{roomStatus ?? "lobby"}</p>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-4">
          {!isInProgress && (
            <div className="text-center">
              <h2
                className="text-2xl font-bold mb-2"
                style={{ color: "var(--color-dourado)", fontFamily: "var(--font-display), cursive" }}
              >
                Aguardando...
              </h2>
              <p className="opacity-70 text-sm">
                Aguarde o início da partida na Mesa.
              </p>
            </div>
          )}

          {isInProgress && isCurrentNarrator && (
            <div
              className="rounded-lg px-4 py-2 text-center"
              style={{ background: "rgba(201,168,76,0.15)", border: "1px solid rgba(201,168,76,0.4)" }}
            >
              <p style={{ color: "var(--color-dourado)" }} className="font-semibold text-sm">
                👑 É a sua vez de narrar!
              </p>
              <button
                type="button"
                onClick={() => void handlePassTurn()}
                className="mt-2 rounded px-3 py-1 text-xs font-semibold"
                style={{ background: "var(--color-evento)", color: "var(--color-pergaminho)" }}
              >
                Passar turno
              </button>
            </div>
          )}

          {isInProgress && !isCurrentNarrator && activeNarratorName && (
            <p className="text-sm opacity-60 text-center">
              {activeNarratorName} está narrando. Jogue uma carta de interrupção para assumir.
            </p>
          )}

          {isInProgress && !hasHand && (
            <p className="opacity-50 text-sm text-center">
              Aguardando distribuição das cartas...
            </p>
          )}
        </div>

        {/* Card fan at bottom */}
        {isInProgress && hasHand && (
          <div
            className="w-full"
            style={{
              paddingBottom: 24,
              paddingTop: 8,
              borderTop: "1px solid rgba(201,168,76,0.15)",
              background: "rgba(0,0,0,0.3)",
            }}
          >
            <p className="text-center text-xs opacity-40 mb-2">Deslize ↑ para jogar</p>
            <CardFan
              cards={hand}
              onPlay={(card) => void handlePlayCard(card)}
            />
          </div>
        )}
      </main>
    );
  }

  return (
    <main className="flex flex-col items-center justify-center min-h-screen gap-6 p-8">
      <h1
        className="text-4xl font-bold text-center"
        style={{ color: "var(--color-dourado)", fontFamily: "var(--font-display), cursive" }}
      >
        Era Uma Vez
      </h1>
      <p className="opacity-80">
        Sala: <strong>{salaCode}</strong>
      </p>
      {error && <p className="text-sm text-red-400 text-center">{error}</p>}
      <form onSubmit={handleJoin} className="flex flex-col gap-4 w-full max-w-xs">
        <input
          type="text"
          placeholder="Seu nome de herói..."
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
          maxLength={24}
          className="w-full py-3 px-4 rounded-lg text-lg border-2 outline-none"
          style={{
            background: "transparent",
            borderColor: "var(--color-dourado)",
            color: "var(--color-pergaminho)",
          }}
        />
        <button
          type="submit"
          disabled={!playerName.trim() || loading}
          className="w-full py-3 px-6 rounded-lg text-lg font-semibold transition-opacity disabled:opacity-40"
          style={{
            background: "var(--color-evento)",
            color: "var(--color-pergaminho)",
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
