#!/usr/bin/env node
/**
 * Gera o arquivo supabase/migrations/002_seed_cards.sql
 * a partir de apps/card-tools/cartas.json
 *
 * Uso: node supabase/seed_cards.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const cards = JSON.parse(readFileSync(join(ROOT, "apps/card-tools/cartas.json"), "utf8"));

function escape(str) {
  return str.replace(/'/g, "''");
}

const rows = cards.map((c) => {
  const interrupt = c.interrupt ? "true" : "false";
  return `('${escape(c.id)}','${escape(c.deck)}',${c.numero},'${escape(c.tipo)}','${escape(c.texto_pt)}','${escape(c.texto_en)}',${interrupt},'${escape(c.prompt_en)}')`;
});

const sql = `-- ============================================================
-- Era Uma Vez — Seed: importar cartas.json para a tabela cards
-- Gerado automaticamente por supabase/seed_cards.mjs
-- ============================================================

insert into public.cards (id, deck, numero, tipo, texto_pt, texto_en, interrupt, prompt_en)
values
${rows.join(",\n")}
on conflict (id) do update set
  deck      = excluded.deck,
  numero    = excluded.numero,
  tipo      = excluded.tipo,
  texto_pt  = excluded.texto_pt,
  texto_en  = excluded.texto_en,
  interrupt = excluded.interrupt,
  prompt_en = excluded.prompt_en;
`;

const outPath = join(ROOT, "supabase/migrations/002_seed_cards.sql");
writeFileSync(outPath, sql, "utf8");
console.log(`✅  Seed gerado: ${outPath} (${cards.length} cartas)`);
