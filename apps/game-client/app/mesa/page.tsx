"use client";

import {
  applyNarratorRotation,
  checkVictory,
  dealCards,
  getCurrentNarrator,
  getNextNarrator,
  undoLastMove,
} from "@era-uma-vez/game-logic";
import { StoryLog } from "@era-uma-vez/ui-fantasy";
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
        setRoomError("Não foi possível criar a sala.");
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
      <main className="flex flex-col items-center justify-center min-h-screen gap-8 p-8">
        <div className="text-center">
          <p style={{ fontSize: 64 }}>🎉</p>
          <h1
            className="text-4xl font-bold"
            style={{ color: "var(--color-dourado)", fontFamily: "var(--font-display), cursive" }}
          >
            Fim da História!
          </h1>
          <p className="mt-4 text-xl opacity-80">
            <strong>{winner.player_name}</strong> encerrou a história com:
          </p>
          <p
            className="mt-2 text-lg max-w-sm mx-auto"
            style={{ color: "var(--color-dourado)" }}
          >
            &ldquo;{winner.card.texto_pt}&rdquo;
          </p>
          <p className="mt-6 opacity-60 text-sm">E viveram felizes para sempre.</p>
        </div>
        <StoryLog entries={storyLog} />
      </main>
    );
  }

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

      {canStartGame && (
        <button
          type="button"
          onClick={() => void handleStartGame()}
          disabled={isStartingGame}
          className="rounded-lg px-6 py-3 font-semibold text-lg transition-opacity disabled:opacity-40"
          style={{
            background: "var(--color-dourado)",
            color: "var(--color-fundo)",
            fontFamily: "var(--font-title), serif",
          }}
        >
          {isStartingGame ? "Iniciando..." : "✨ Iniciar Partida"}
        </button>
      )}

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
        {room?.status === "in_progress" && (
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
        )}
        {!canAdvanceTurn && connectedPlayers.length === 1 ? (
          <p className="text-sm opacity-60">É preciso mais de um jogador conectado para rotacionar.</p>
        ) : null}
      </section>

      {storyLog.length > 0 && (
        <section className="w-full max-w-lg">
          <h2
            className="text-xl font-semibold mb-3 text-center"
            style={{ color: "var(--color-dourado)" }}
          >
            História
          </h2>
          <StoryLog entries={storyLog} onUndo={room?.status === "in_progress" ? () => void handleUndo() : undefined} />
        </section>
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
