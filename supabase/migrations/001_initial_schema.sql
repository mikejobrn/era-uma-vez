-- ============================================================
-- Era Uma Vez — Migração inicial do banco de dados
-- Execute este arquivo no SQL Editor do Supabase
-- ============================================================

-- ─── Extensões ───────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ─── Tabela: cards ───────────────────────────────────────────
create table if not exists public.cards (
  id          text        primary key,  -- ex: "A01"
  deck        char(1)     not null check (deck in ('A', 'B', 'C')),
  numero      smallint    not null,
  tipo        text        not null check (tipo in ('Evento','Personagem','Lugar','Coisa','Aspecto','Final')),
  texto_pt    text        not null,
  texto_en    text        not null,
  interrupt   boolean     not null default false,
  prompt_en   text        not null,
  created_at  timestamptz not null default now()
);

comment on table public.cards is 'Catálogo completo das 165 cartas Era Uma Vez.';

alter table public.cards enable row level security;

-- Qualquer pessoa autenticada ou anônima pode ler as cartas
create policy "cards_select_public" on public.cards
  for select using (true);

-- ─── Tabela: rooms ───────────────────────────────────────────
create table if not exists public.rooms (
  id           uuid        primary key default uuid_generate_v4(),
  code         text        not null unique,           -- código curto para entrar
  status       text        not null default 'lobby' check (status in ('lobby','in_progress','finished')),
  narrator_id  uuid,                                   -- FK para players.id (set after first player joins)
  story_log    jsonb       not null default '[]'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.rooms is 'Salas de jogo ativas e históricas.';

alter table public.rooms enable row level security;

create policy "rooms_select_public" on public.rooms
  for select using (true);

create policy "rooms_insert_anon" on public.rooms
  for insert with check (true);

create policy "rooms_update_anon" on public.rooms
  for update using (true);

-- ─── Tabela: players ─────────────────────────────────────────
create table if not exists public.players (
  id           uuid        primary key default uuid_generate_v4(),
  room_id      uuid        not null references public.rooms (id) on delete cascade,
  name         text        not null,
  avatar_url   text,
  is_narrator  boolean     not null default false,
  status       text        not null default 'waiting' check (status in ('waiting','active','disconnected')),
  hand         jsonb       not null default '[]'::jsonb,
  joined_at    timestamptz not null default now()
);

comment on table public.players is 'Jogadores em cada sala.';

alter table public.players enable row level security;

create policy "players_select_public" on public.players
  for select using (true);

create policy "players_insert_anon" on public.players
  for insert with check (true);

create policy "players_update_anon" on public.players
  for update using (true);

-- ─── Realtime ────────────────────────────────────────────────
-- Habilitar Supabase Realtime para as tabelas necessárias.
-- (Acesse Table Editor → cada tabela → Realtime → Enable)
-- Ou via SQL:
alter publication supabase_realtime add table public.rooms;
alter publication supabase_realtime add table public.players;

-- ─── Índices ─────────────────────────────────────────────────
create index if not exists idx_players_room_id on public.players (room_id);
create index if not exists idx_rooms_code on public.rooms (code);
