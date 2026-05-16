"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "../../lib/supabase";

function generateRoomCode(): string {
  return Math.random().toString(36).substring(2, 7).toUpperCase();
}

interface Player {
  id: string;
  name: string;
  is_narrator: boolean;
}

export default function MesaPage() {
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [joinUrl, setJoinUrl] = useState<string | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);

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
        .select("id")
        .single();
      if (!error && data) setRoomId((data as { id: string }).id);
    })();
  }, []);

  useEffect(() => {
    if (!supabase || !roomId) return;

    const fetchPlayers = () => {
      void supabase!
        .from("players")
        .select("id, name, is_narrator")
        .eq("room_id", roomId)
        .then((result: { data: Player[] | null }) => {
          if (result.data) setPlayers(result.data);
        });
    };

    fetchPlayers();

    const channel = supabase
      .channel(`room-players-${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "players",
          filter: `room_id=eq.${roomId}`,
        },
        fetchPlayers,
      )
      .subscribe();

    return () => {
      supabase!.removeChannel(channel);
    };
  }, [roomId]);

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
