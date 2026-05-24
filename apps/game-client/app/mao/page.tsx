"use client";

import {
  addCardToHand,
  appendToStoryLog,
  canInterrupt,
  canPlayCard,
  checkVictory,
  getCurrentNarrator,
  getNextNarrator,
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
  const [isRestoringSession, setIsRestoringSession] = useState(true);
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
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [drawnCard, setDrawnCard] = useState<Card | null>(null);
  const [isPassingTurn, setIsPassingTurn] = useState(false);
  const [isChoosingDiscard, setIsChoosingDiscard] = useState(false);
  const [drawPile, setDrawPile] = useState<Card[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      if (!salaCode) {
        setIsRestoringSession(false);
        return;
      }

      setIsRestoringSession(true);

      try {
        const raw = localStorage.getItem(SESSION_KEY);
        if (!raw) {
          if (!cancelled) {
            setSession(null);
            setJoined(false);
            setPlayerName("");
          }
          return;
        }

        const saved: Session = JSON.parse(raw);
        if (saved.roomCode !== salaCode) {
          if (!cancelled) {
            setSession(null);
            setJoined(false);
            setPlayerName("");
          }
          return;
        }

        if (!supabase) {
          if (!cancelled) {
            setSession(saved);
            setPlayerName(saved.playerName);
            setJoined(true);
          }
          return;
        }

        const { data: player } = await supabase
          .from("players")
          .select("id")
          .eq("id", saved.playerId)
          .eq("room_id", saved.roomId)
          .maybeSingle();

        if (!player) {
          localStorage.removeItem(SESSION_KEY);
          if (!cancelled) {
            setSession(null);
            setJoined(false);
            setPlayerName("");
          }
          return;
        }

        if (!cancelled) {
          setSession(saved);
          setPlayerName(saved.playerName);
          setJoined(true);
        }
      } catch {
        localStorage.removeItem(SESSION_KEY);
        if (!cancelled) {
          setSession(null);
          setJoined(false);
          setPlayerName("");
        }
      } finally {
        if (!cancelled) {
          setIsRestoringSession(false);
        }
      }
    }

    void restoreSession();

    return () => {
      cancelled = true;
    };
  }, [salaCode]);

  const syncRoomState = useCallback(async () => {
    if (!supabase || !session?.roomId) return;
    const client = supabase;

    const [{ data: room }, { data: players }, { data: playerData }] = await Promise.all([
      client.from("rooms").select("id, code, status, narrator_id, story_log, draw_pile").eq("id", session.roomId).single(),
      client.from("players").select("id, room_id, name, avatar_url, is_narrator, status, hand, joined_at").eq("room_id", session.roomId).order("joined_at", { ascending: true }),
      client.from("players").select("hand").eq("id", session.playerId).single(),
    ]);

    if (!room || !players) return;

    // If this player no longer exists in the room (e.g. host restarted with "modify players"),
    // clear session and go back to join form
    if (!playerData) {
      localStorage.removeItem(SESSION_KEY);
      setSession(null);
      setJoined(false);
      setPlayerName("");
      setHand([]);
      setWinner(null);
      setRoomStatus(null);
      return;
    }

    const typedRoom = room as Room;
    const typedPlayers = players as Player[];

    const narrator = getCurrentNarrator(typedPlayers, typedRoom.narrator_id);
    setActiveNarratorName(narrator?.name ?? null);
    setIsCurrentNarrator(narrator?.id === session.playerId);
    setRoomStatus(typedRoom.status);
    setStoryLog(typedRoom.story_log ?? []);
    setRoomNarratorId(typedRoom.narrator_id);
    setDrawPile(typedRoom.draw_pile ?? []);
    setAllPlayers(typedPlayers);

    // Store other players (everyone except self)
    setOtherPlayers(
      typedPlayers
        .filter((p) => p.id !== session.playerId)
        .map((p) => ({ id: p.id, name: p.name, hand: p.hand })),
    );

    setHand((playerData as { hand: Card[] }).hand ?? []);

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

    // Presence channel – announces this player is online so the mesa can detect disconnections
    const presenceChannel = client.channel(`presence-${session.roomId}`, {
      config: { presence: { key: session.playerId } },
    });
    presenceChannel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await presenceChannel.track({ player_id: session.playerId });
      }
    });

    // Re-sync state when tab becomes visible again (handles screen lock/unlock, tab switch)
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void syncRoomState();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      void client.removeChannel(roomChannel);
      void client.removeChannel(playersChannel);
      void client.removeChannel(presenceChannel);
      document.removeEventListener("visibilitychange", handleVisibility);
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
    if (!session || !supabase || isPassingTurn) return;
    setIsPassingTurn(true);

    // Draw a card from the draw pile
    if (drawPile.length > 0) {
      const card = drawPile[0]!;
      const newDrawPile = drawPile.slice(1);
      const updatedHand = addCardToHand(hand, card);

      await Promise.all([
        supabase.from("players").update({ hand: updatedHand }).eq("id", session.playerId),
        supabase.from("rooms").update({ draw_pile: newDrawPile }).eq("id", session.roomId),
      ]);

      setHand(updatedHand);
      setDrawPile(newDrawPile);
      setDrawnCard(card);
      setIsChoosingDiscard(true);
    } else {
      // No cards to draw – just advance turn
      await advanceToNextNarrator();
    }

    setIsPassingTurn(false);
  }

  async function advanceToNextNarrator() {
    if (!session || !supabase) return;

    // Determine next narrator based on join order
    const nextNarrator = getNextNarrator(allPlayers, session.playerId);
    if (nextNarrator) {
      await Promise.all([
        supabase.from("rooms").update({ narrator_id: nextNarrator.id }).eq("id", session.roomId),
        supabase
          .from("players")
          .update({ is_narrator: false, status: "waiting" })
          .eq("id", session.playerId),
        supabase
          .from("players")
          .update({ is_narrator: true, status: "active" })
          .eq("id", nextNarrator.id),
      ]);
    } else {
      await supabase
        .from("rooms")
        .update({ narrator_id: null })
        .eq("id", session.roomId);
    }
  }

  async function handleDiscardCard(card: Card) {
    if (!session || !supabase) return;
    const newHand = removeCardFromHand(hand, card.id);
    // Put discarded card at the bottom of draw pile
    const newDrawPile = [...drawPile, card];

    await Promise.all([
      supabase.from("players").update({ hand: newHand }).eq("id", session.playerId),
      supabase.from("rooms").update({ draw_pile: newDrawPile }).eq("id", session.roomId),
    ]);

    setHand(newHand);
    setDrawPile(newDrawPile);
    setDrawnCard(null);
    setIsChoosingDiscard(false);

    // After discarding, advance to next narrator
    await advanceToNextNarrator();
  }

  async function handleKeepAllCards() {
    if (!session || !supabase) return;
    setDrawnCard(null);
    setIsChoosingDiscard(false);

    // Player chose not to discard – advance to next narrator
    await advanceToNextNarrator();
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

  if (isRestoringSession) {
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
        <p style={{ opacity: 0.6, textAlign: "center" }}>Verificando sua entrada na sala…</p>
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
        {/* ── Compact Header ── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "4px 10px",
            borderBottom: "1px solid rgba(201,168,76,0.2)",
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-display), cursive",
              color: "var(--color-dourado)",
              fontWeight: 700,
              fontSize: 13,
            }}
          >
            {session.playerName}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {activeNarratorName && (
              <span style={{ fontSize: 11, opacity: 0.8 }}>
                👑 {activeNarratorName}
              </span>
            )}
            {isInProgress && isCurrentNarrator && !isChoosingDiscard && (
              <button
                type="button"
                onClick={() => void handlePassTurn()}
                disabled={isPassingTurn}
                style={{
                  padding: "3px 10px",
                  borderRadius: 6,
                  background: "var(--color-evento)",
                  color: "var(--color-pergaminho)",
                  fontFamily: "var(--font-title), serif",
                  fontWeight: 600,
                  fontSize: 11,
                  border: "none",
                  cursor: "pointer",
                  opacity: isPassingTurn ? 0.5 : 1,
                }}
              >
                {isPassingTurn ? "…" : "Passar turno"}
              </button>
            )}
          </div>
        </div>

        {/* ── Discard selection after drawing a card ── */}
        {isChoosingDiscard && drawnCard && (
          <div
            style={{
              padding: "8px 10px",
              background: "rgba(201,168,76,0.1)",
              borderBottom: "1px solid rgba(201,168,76,0.2)",
              flexShrink: 0,
            }}
          >
            <p style={{ fontSize: 12, color: "var(--color-dourado)", margin: "0 0 6px", textAlign: "center" }}>
              Você puxou: &ldquo;{drawnCard.texto_pt}&rdquo;. Escolha uma carta para descartar:
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, justifyContent: "center" }}>
              {hand
                .filter((c) => c.tipo !== "Final")
                .map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => void handleDiscardCard(c)}
                    style={{
                      padding: "3px 8px",
                      borderRadius: 4,
                      background: c.id === drawnCard.id ? "rgba(248,113,113,0.3)" : "rgba(201,168,76,0.15)",
                      color: c.id === drawnCard.id ? "#f87171" : "var(--color-dourado)",
                      border: `1px solid ${c.id === drawnCard.id ? "rgba(248,113,113,0.5)" : "rgba(201,168,76,0.3)"}`,
                      fontSize: 10,
                      cursor: "pointer",
                      maxWidth: 120,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    title={c.texto_pt}
                  >
                    {c.texto_pt}
                  </button>
                ))}
            </div>
            <div style={{ textAlign: "center", marginTop: 6 }}>
              <button
                type="button"
                onClick={() => void handleKeepAllCards()}
                style={{
                  padding: "2px 8px",
                  borderRadius: 4,
                  background: "rgba(201,168,76,0.2)",
                  color: "var(--color-dourado)",
                  border: "1px solid rgba(201,168,76,0.4)",
                  fontSize: 10,
                  cursor: "pointer",
                }}
              >
                Manter todas
              </button>
            </div>
          </div>
        )}

        {/* ── Middle: status messages (only when no cards) ── */}
        {(!isInProgress || !hasHand) && (
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "8px 16px",
              gap: 8,
              minHeight: 0,
            }}
          >
            {!isInProgress && (
              <div style={{ textAlign: "center" }}>
                <h2
                  style={{
                    color: "var(--color-dourado)",
                    fontFamily: "var(--font-display), cursive",
                    fontSize: 20,
                    margin: "0 0 4px",
                  }}
                >
                  Aguardando…
                </h2>
                <p style={{ opacity: 0.6, fontSize: 12, margin: 0 }}>
                  Aguarde o início da partida na Mesa.
                </p>
              </div>
            )}

            {isInProgress && !hasHand && (
              <p style={{ opacity: 0.45, fontSize: 12, textAlign: "center", margin: 0 }}>
                Aguardando distribuição das cartas…
              </p>
            )}
          </div>
        )}

        {/* ── Inline status when has cards ── */}
        {isInProgress && hasHand && !isCurrentNarrator && activeNarratorName && (
          <div style={{ padding: "4px 10px", flexShrink: 0 }}>
            <p style={{ fontSize: 11, opacity: 0.55, textAlign: "center", margin: 0 }}>
              {activeNarratorName} está narrando.{" "}
              {hand.some((c) => c.interrupt) && "Jogue uma carta de interrupção para assumir."}
            </p>
          </div>
        )}

        {isInProgress && hasHand && isCurrentNarrator && (
          <div style={{ padding: "4px 10px", flexShrink: 0, textAlign: "center" }}>
            <p style={{ color: "var(--color-dourado)", fontWeight: 600, fontSize: 12, margin: 0 }}>
              👑 É a sua vez de narrar!
            </p>
          </div>
        )}

        {/* ── Card fan (maximized) ── */}
        {isInProgress && hasHand && (
          <div
            style={{
              flex: 1,
              minHeight: 0,
              paddingBottom: 8,
              paddingTop: 4,
              borderTop: "1px solid rgba(201,168,76,0.15)",
              background: "rgba(0,0,0,0.25)",
              overflow: "hidden",
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
