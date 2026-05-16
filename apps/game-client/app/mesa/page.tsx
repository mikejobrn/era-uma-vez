"use client";

import { applyNarratorRotation, getCurrentNarrator, getNextNarrator } from "@era-uma-vez/game-logic";
import type { Player, Room } from "@era-uma-vez/shared-types";
import { useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "../../lib/supabase";

function generateRoomCode(): string {
  return Math.random().toString(36).substring(2, 7).toUpperCase();
}

type RoomSummary = Pick<Room, "id" | "code" | "status" | "narrator_id">;

export default function MesaPage() {
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [joinUrl, setJoinUrl] = useState<string | null>(null);
  const [room, setRoom] = useState<RoomSummary | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [roomError, setRoomError] = useState<string | null>(null);
  const [isAdvancingTurn, setIsAdvancingTurn] = useState(false);

  useEffect(() => {
    const code = generateRoomCode();
    setRoomCode(code);
    const url = `${window.location.origin}/mao?sala=${code}`;
    setJoinUrl(url);

    if (!supabase) return;

    void (async () => {
      const { data, error } = await supabase
        .from("rooms")
        .insert({ code, status: "lobby" })
        .select("id, code, status, narrator_id")
        .single();
      if (error) {
        setRoomError("Não foi possível criar a sala.");
        return;
      }
      if (data) setRoom(data as RoomSummary);
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
        .select("id, code, status, narrator_id")
        .eq("id", room.id)
        .single()
        .then((result: { data: RoomSummary | null }) => {
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

  const connectedPlayers = players.filter((player) => player.status !== "disconnected");
  const canAdvanceTurn = connectedPlayers.length > 1;

  return (
    <main className="flex flex-col items-center justify-center min-h-screen gap-8 p-8">
      <h1
        className="text-4xl font-bold text-center"
        style={{ color: "var(--color-dourado)", fontFamily: "var(--font-display), cursive" }}
      >
        Era Uma Vez — Mesa
      </h1>

      {roomCode && joinUrl ? (
        <div className="flex flex-col items-center gap-6">
          <p className="text-xl opacity-80">
            Sala:{" "}
            <span className="font-bold text-2xl" style={{ color: "var(--color-dourado)" }}>
              {roomCode}
            </span>
          </p>
          <div className="p-4 rounded-xl" style={{ background: "var(--color-pergaminho)" }}>
            <QRCodeSVG
              value={joinUrl}
              size={220}
              fgColor="var(--color-texto)"
              bgColor="var(--color-pergaminho)"
            />
          </div>
          <p className="text-sm opacity-60 text-center max-w-xs">
            Aponte a câmera do celular para o QR Code para entrar na partida.
          </p>
        </div>
      ) : (
        <p className="opacity-60">Criando sala...</p>
      )}

      {roomError ? <p className="text-sm text-red-300 text-center">{roomError}</p> : null}

      <section className="flex flex-col items-center gap-3 text-center">
        <h2 className="text-xl font-semibold" style={{ color: "var(--color-dourado)" }}>
          Narrador ativo
        </h2>
        <p className="opacity-80">
          {activeNarrator ? (
            <>
              👑 <strong>{activeNarrator.name}</strong> conduz a história agora.
            </>
          ) : (
            "Aguardando jogadores para escolher o narrador."
          )}
        </p>
        <button
          type="button"
          onClick={() => void handleAdvanceTurn()}
          disabled={!canAdvanceTurn || isAdvancingTurn}
          className="rounded-lg px-4 py-2 font-semibold transition-opacity disabled:opacity-40"
          style={{
            background: "var(--color-evento)",
            color: "var(--color-pergaminho)",
          }}
        >
          {isAdvancingTurn ? "Passando turno..." : "Passar turno"}
        </button>
        {!canAdvanceTurn && connectedPlayers.length === 1 ? (
          <p className="text-sm opacity-60">É preciso mais de um jogador conectado para rotacionar.</p>
        ) : null}
      </section>

      <PlayerCircle players={players} />
    </main>
  );
}

function PlayerCircle({ players }: { players: Player[] }) {
  if (players.length === 0) {
    return <p className="opacity-40 text-sm mt-4">Aguardando jogadores...</p>;
  }

  const radius = 120;
  const containerSize = radius * 2 + 80;

  return (
    <div className="relative mt-4" style={{ width: containerSize, height: containerSize }}>
      {players.map((player, index) => {
        const angle = (index / players.length) * 2 * Math.PI - Math.PI / 2;
        const x = containerSize / 2 + radius * Math.cos(angle);
        const y = containerSize / 2 + radius * Math.sin(angle);
        return (
          <div
            key={player.id}
            className="absolute flex flex-col items-center"
            style={{ left: x, top: y, transform: "translate(-50%, -50%)" }}
          >
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold"
              style={{
                background: "var(--color-evento)",
                color: "var(--color-pergaminho)",
                border: player.is_narrator ? "3px solid var(--color-dourado)" : "none",
              }}
            >
              {player.name.charAt(0).toUpperCase()}
            </div>
            <span
              className="text-xs mt-1 text-center max-w-16 truncate"
              style={{ color: "var(--color-pergaminho)" }}
            >
              {player.is_narrator ? "👑 " : ""}
              {player.name}
            </span>
          </div>
        );
      })}
    </div>
  );
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
