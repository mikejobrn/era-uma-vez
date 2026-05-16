// ─── Card Types ──────────────────────────────────────────────────────────────

export type CardType =
  | "Evento"
  | "Personagem"
  | "Lugar"
  | "Coisa"
  | "Aspecto"
  | "Final";

export type CardDeck = "A" | "B" | "C";

export interface Card {
  id: string;
  deck: CardDeck;
  numero: number;
  tipo: CardType;
  texto_pt: string;
  texto_en: string;
  interrupt: boolean;
  prompt_en: string;
}

// ─── Player Types ─────────────────────────────────────────────────────────────

export type PlayerStatus = "waiting" | "active" | "disconnected";

export interface Player {
  id: string;
  room_id: string;
  name: string;
  avatar_url: string | null;
  is_narrator: boolean;
  status: PlayerStatus;
  hand: Card[];
  joined_at: string;
}

// ─── Room / Game Types ────────────────────────────────────────────────────────

export type RoomStatus = "lobby" | "in_progress" | "finished";

export interface Room {
  id: string;
  code: string;
  status: RoomStatus;
  narrator_id: string | null;
  story_log: PlayedCard[];
  created_at: string;
}

export interface PlayedCard {
  player_id: string;
  player_name: string;
  card: Card;
  played_at: string;
}

// ─── Realtime Event Types ─────────────────────────────────────────────────────

export type GameEventType =
  | "player_joined"
  | "player_left"
  | "card_played"
  | "turn_interrupted"
  | "narrator_changed"
  | "ending_accepted"
  | "ending_rejected"
  | "move_undone";

export interface GameEvent {
  type: GameEventType;
  room_id: string;
  payload: Record<string, unknown>;
  timestamp: string;
}
