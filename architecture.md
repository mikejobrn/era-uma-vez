# Software Design Document (SDD) & Plano de Execução - Era Uma Vez

## 1. Visão Geral
"Era Uma Vez" é um jogo de cartas multiplayer em tempo real, jogado em um formato híbrido digital. Uma tela central (iPad/Tablet) funciona como a "Mesa", enquanto os smartphones dos jogadores funcionam como suas "Mãos".

## 2. Arquitetura e Stack
*   **Gerenciador de Repositório:** Turborepo (Monorepo).
*   **Frontend (Mesa e Jogadores):** Next.js (React) focado em PWA (Progressive Web App).
*   **Estilização e Animação:** Tailwind CSS e Framer Motion.
*   **Backend e Banco de Dados:** Supabase (PostgreSQL para persistência, Supabase Realtime/WebSockets para sincronização de eventos de jogo).
*   **Hospedagem:** Vercel (Frontend) + Supabase (Backend/Realtime).

## 3. Estrutura do Monorepo
```text
era-uma-vez/
├── apps/
│   ├── game-client/       # Next.js: PWA do Jogo (Mesa e Jogadores)
│   └── card-tools/        # Scripts Python de geração/catalogação de cartas atuais
├── packages/
│   ├── shared-types/      # Tipagens TypeScript (Game, Cards, Player)
│   ├── game-logic/        # Regras de negócio (Turnos, Interrupções, Finais)
│   └── ui-fantasy/        # Design System (Tailwind + Framer Motion)
```

## 4. Mecânicas e UX/UI (Especificações)
*   **Identidade Visual:** Fantasia Medieval/Contos de Fadas. 
    *   Cores: Vermelho Evento (`#923c35`), Pergaminho (`#f5ebdc`), Dourado (`#c9a84c`). 
    *   Fontes: PirataOne, Cinzel, UnifrakturCook.
*   **A Mesa (iPad):** 
    *   Exibe QR Code para entrada de jogadores.
    *   Exibe avatares/nomes em roda, com destaque (coroa) para o Narrador ativo.
    *   Exibe o deck (monte) para compra de cartas. O sistema gerencia para quem vai a carta.
    *   Exibe o histórico encadeado das cartas jogadas com animação.
    *   Possui opção de "Desfazer Jogada" em caso de veto dos jogadores.
*   **A Mão (Celular):** 
    *   Cartas em **leque horizontal**.
    *   A Carta de **Final (Felizes para Sempre)** fica sempre visível e em destaque à frente.
    *   Ação de tocar para ler, e "Swipe Up" (arrastar para cima) joga a carta.
    *   O Narrador ativo possui botões de ação (como "Passar o Turno").
*   **Resiliência:** Salvar Token de Sessão no `localStorage` para reconexão automática em caso de queda de rede ou refresh da página.
*   **Imersão:** Efeitos sonoros (SFX) ao jogar cartas, interromper o turno e animação de confetes na vitória de um Final Aceito.

---

## 5. Plano de Execução Autônoma (Metodologia RalphLoops)

Para que os agentes de IA desenvolvam este projeto de forma robusta e sem perda de contexto ou alucinações (_context rot_), utilizaremos a arquitetura de **RalphLoops**. 
Isso significa que a execução não será feita em uma única sessão de chat gigante, mas iterando sobre um arquivo de estado contínuo, focado em tarefas atômicas e testáveis.

### Os Agentes (Perfis de Execução)
1.  **Agente de Infraestrutura (DB):** Responsável por esquematizar e gerenciar o Supabase (Tabelas, RLS, Seed das Cartas criadas pelo Python).
2.  **Agente Frontend (UI/UX):** Responsável pelo Framer Motion, Tailwind e páginas Next.js.
3.  **Agente Lógica (TypeScript):** Responsável por escrever as regras do jogo e a integração com WebSockets Realtime.

### O Loop de Execução (O "Ralph Loop")
Cada iteração de código do agente autônomo seguirá o fluxo:
1.  **Ler Contexto Base:** Ingestão do `architecture.md` e do arquivo `TODO.md` (que funcionará como a memória do agente).
2.  **Selecionar e Isolar Tarefa:** Pega o próximo item aberto de maior prioridade.
3.  **Implementar e Executar:** Escreve a funcionalidade (frontend ou lógica).
4.  **Testar:** Avaliar se o componente visualiza sem quebrar a build (usando checagem estática).
5.  **Commitar Estado:** Marca a tarefa como concluída no `TODO.md` e faz o push do código.
6.  **Reiniciar Loop:** O ambiente limpa o contexto da LLM e se reconecta para pegar a próxima tarefa isoladamente.

### Etapas Iniciais a serem executadas (Primeiro Sprint)
*(Estas tarefas devem popular o arquivo TODO.md na inicialização do fluxo)*
- [ ] 1. Inicializar `Turborepo` na raiz (migrando os arquivos atuais da IA/cartas para uma subpasta `apps/card-tools`).
- [ ] 2. Criar projeto Next.js em `apps/game-client` e configurar PWA + Tailwind.
- [ ] 3. Estabelecer e isolar pacotes (`shared-types`, `ui-fantasy`) configurando os alias e dependências locais.
- [ ] 4. Criar o esquema SQL base para migrar o conteúdo do `cartas.json` no Supabase (Tabela `Cards`).
- [ ] 5. Criar Tabelas `Rooms` e `Players` no Supabase, testando conexões anônimas.
- [ ] 6. Criar Componente de "Mesa" (iPad) vazio com geração de QR Code e sala no DB.
- [ ] 7. Implementar tela de celular lendo o QR Code e inserindo o jogador no Supabase.