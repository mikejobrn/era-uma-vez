"use client";

import { useSearchParams } from "next/navigation";
import { useState, Suspense, useEffect } from "react";
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

  if (joined && session) {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen gap-6 p-8">
        <h2
          className="text-3xl font-bold"
          style={{ color: "var(--color-dourado)", fontFamily: "var(--font-display), cursive" }}
        >
          Aguardando...
        </h2>
        <p className="opacity-80 text-center">
          Você entrou na sala <strong>{salaCode}</strong> como{" "}
          <strong>{session.playerName}</strong>. Aguarde o início da partida.
        </p>
        {/* Hand (card fan) will be rendered here once game starts */}
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
