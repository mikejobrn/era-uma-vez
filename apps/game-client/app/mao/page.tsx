"use client";

import { useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";

function MaoContent() {
  const searchParams = useSearchParams();
  const salaCode = searchParams.get("sala");
  const [playerName, setPlayerName] = useState("");
  const [joined, setJoined] = useState(false);

  function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!playerName.trim()) return;
    // TODO: insert player into Supabase `players` table
    setJoined(true);
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

  if (joined) {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen gap-6 p-8">
        <h2
          className="text-3xl font-bold"
          style={{ color: "var(--color-dourado)", fontFamily: "var(--font-pirata-one), cursive" }}
        >
          Aguardando...
        </h2>
        <p className="opacity-80 text-center">
          Você entrou na sala <strong>{salaCode}</strong> como{" "}
          <strong>{playerName}</strong>. Aguarde o início da partida.
        </p>
        {/* Hand (card fan) will be rendered here once game starts */}
      </main>
    );
  }

  return (
    <main className="flex flex-col items-center justify-center min-h-screen gap-6 p-8">
      <h1
        className="text-4xl font-bold text-center"
        style={{ color: "var(--color-dourado)", fontFamily: "var(--font-pirata-one), cursive" }}
      >
        Era Uma Vez
      </h1>
      <p className="opacity-80">
        Sala: <strong>{salaCode}</strong>
      </p>
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
          disabled={!playerName.trim()}
          className="w-full py-3 px-6 rounded-lg text-lg font-semibold transition-opacity disabled:opacity-40"
          style={{
            background: "var(--color-evento)",
            color: "var(--color-pergaminho)",
          }}
        >
          Entrar na Partida
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
