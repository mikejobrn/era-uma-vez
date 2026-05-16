"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";

function generateRoomCode(): string {
  return Math.random().toString(36).substring(2, 7).toUpperCase();
}

export default function MesaPage() {
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [joinUrl, setJoinUrl] = useState<string | null>(null);

  useEffect(() => {
    const code = generateRoomCode();
    setRoomCode(code);
    const url = `${window.location.origin}/mao?sala=${code}`;
    setJoinUrl(url);
  }, []);

  return (
    <main className="flex flex-col items-center justify-center min-h-screen gap-8 p-8">
      <h1
        className="text-4xl font-bold text-center"
        style={{ color: "var(--color-dourado)", fontFamily: "var(--font-pirata-one), cursive" }}
      >
        Era Uma Vez — Mesa
      </h1>

      {roomCode && joinUrl ? (
        <div className="flex flex-col items-center gap-6">
          <p className="text-xl opacity-80">
            Sala: <span className="font-bold text-2xl" style={{ color: "var(--color-dourado)" }}>{roomCode}</span>
          </p>
          <div
            className="p-4 rounded-xl"
            style={{ background: "var(--color-pergaminho)" }}
          >
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

      {/* Player circle — populated via Supabase Realtime */}
      <div className="flex flex-wrap gap-4 justify-center mt-4">
        <p className="opacity-40 text-sm">Aguardando jogadores...</p>
      </div>
    </main>
  );
}
