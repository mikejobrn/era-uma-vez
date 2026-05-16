# TODO — Era Uma Vez (Ralph Loop Memory)

Este arquivo é a memória persistente dos agentes. Cada tarefa deve ser marcada como `[x]` ao ser concluída antes do commit.

---

## Sprint 1 — Infraestrutura do Monorepo

- [x] 1. Inicializar Turborepo na raiz (migrando arquivos Python para `apps/card-tools`)
- [x] 2. Criar projeto Next.js em `apps/game-client` e configurar PWA + Tailwind
- [x] 3. Estabelecer pacotes (`shared-types`, `ui-fantasy`, `game-logic`) com aliases e dependências locais
- [x] 4. Criar esquema SQL base para migrar `cartas.json` no Supabase (Tabela `cards`) — ver `supabase/migrations/`
- [x] 5. Criar Tabelas `rooms` e `players` no Supabase e testar conexões anônimas
- [x] 6. Criar Componente de "Mesa" (iPad) vazio com geração de QR Code e sala no DB
- [x] 7. Implementar tela de celular lendo o QR Code e inserindo jogador no Supabase

---

## Sprint 2 — Lógica do Jogo

- [ ] 8. Implementar lógica de turno (Narrador ativo, rotação de jogadores)
- [ ] 9. Implementar mecânica de interrupção de turno
- [ ] 10. Implementar lógica de final aceito (Felizes para Sempre)
- [ ] 11. Integrar Supabase Realtime para sincronização de eventos de jogo
- [ ] 12. Implementar reconexão automática via `localStorage` (session token)

---

## Sprint 3 — UI/UX

- [ ] 13. Implementar leque de cartas horizontal no celular (Swipe Up para jogar)
- [ ] 14. Destaque da carta de Final (Felizes para Sempre) no leque
- [ ] 15. Animar histórico de cartas jogadas na Mesa com Framer Motion
- [ ] 16. Implementar "Desfazer Jogada" com veto dos jogadores
- [ ] 17. Adicionar SFX (efeitos sonoros) ao jogar cartas
- [ ] 18. Implementar animação de confetes na vitória (Final Aceito)

---

## Variáveis de Ambiente Necessárias

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```
