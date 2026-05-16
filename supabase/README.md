# Supabase Setup e Verificação (Produção)

Use este checklist quando o deploy estiver ok, mas a criação de sala falhar.

## 1) Executar migrations no SQL Editor

No projeto **correto** do Supabase (o mesmo usado pela Vercel), execute nesta ordem:

1. `/home/runner/work/era-uma-vez/era-uma-vez/supabase/migrations/001_initial_schema.sql`
2. `/home/runner/work/era-uma-vez/era-uma-vez/supabase/migrations/002_seed_cards.sql`

## 2) Diagnóstico rápido (1 minuto)

Execute no SQL Editor:

```sql
select
  to_regclass('public.rooms')   as rooms_table,
  to_regclass('public.players') as players_table,
  to_regclass('public.cards')   as cards_table;
```

Se algum valor vier `null`, as migrations não foram aplicadas nesse projeto.

## 3) Confirmar policies de insert

```sql
select schemaname, tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
  and tablename in ('rooms', 'players')
order by tablename, policyname;
```

Confirme a presença de:

- `rooms_insert_anon` (cmd `INSERT`)
- `players_insert_anon` (cmd `INSERT`)

## 4) Confirmar Realtime

```sql
select schemaname, tablename
from pg_publication_tables
where pubname = 'supabase_realtime'
  and schemaname = 'public'
  and tablename in ('rooms', 'players')
order by tablename;
```

## 5) Confirmar variáveis na Vercel (Production)

No projeto da Vercel, valide:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Elas devem apontar para o **mesmo projeto Supabase** onde você executou as migrations.

Após ajustar, faça redeploy.
