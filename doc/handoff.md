# Handover Notes: Era Uma Vez — Localização PT-BR

Contexto para qualquer assistente que continue este projeto.

## O que é este projeto

Localização completa e modernização visual do jogo de cartas "Once Upon a Time" (3ª edição, Atlas Games) para o português brasileiro. São 165 cartas com arte gerada por IA e texto localizado.

---

## Ambiente Técnico

| Item | Detalhe |
|---|---|
| OS | Windows |
| GPU | RTX 3050 Ti — **4GB VRAM (restrição crítica)** |
| Gerenciador Python | `uv` |
| Dependências | Ver `pyproject.toml` |

---

## Decisões Técnicas Finais

- **Modelo:** SDXL Lightning (4-step UNet) sobre `stabilityai/stable-diffusion-xl-base-1.0`
- **Resolução:** 768×1024px — proporção 5:7 (Poker Size), bucket nativo do SDXL (sem distorções)
- **Passos / Guidance:** 4 steps / 0.0 (Lightning — não alterar)
- **Scheduler:** EulerDiscrete com `timestep_spacing="trailing"` (obrigatório para Lightning)
- **Memória:** `enable_model_cpu_offload()` + `enable_vae_tiling()` + `enable_vae_slicing()`

---

## Mapa de Scripts

### Produção (executar nesta ordem)
| Script | Função |
|---|---|
| `criar_cartas_json.py` | Gera `cartas.json` com as 165 cartas (fonte: PDF oficial Atlas Games) |
| `gerar_templates_xl.py` | Gera os 7 templates PNG em `templates/` via SDXL Lightning |
| `gerar_imagens.py` | Gera 165 ilustrações em `ilustracoes/` — suporta resume |
| `montar_cartas.py` | Combina template + ilustração + texto → `cartas_prontas/` |
| `gerar_pdf.py` | Monta PDF A4 pronto para gráfica a partir de `cartas_prontas/` |

### Testes / Suporte
| Script | Função |
|---|---|
| `comparar_modelos.py` | Executa testes comparativos (salva em `comparacoes/v3/`) |
| `pipeline.py` | **Módulo compartilhado** — carregamento do SDXL Lightning e DreamShaper 8 |

### Dados
| Arquivo | Função |
|---|---|
| `cartas.json` | Base de dados das cartas (gerado por `criar_cartas_json.py`) |

### Legado (não executar)
| Arquivo | Motivo |
|---|---|
| `criar_db_cartas.py` | Protótipo com conteúdo inventado, incompatível com a estrutura atual |

---

## Estrutura de Pastas

```
templates/          ← Templates PNG definitivos (1 por tipo de carta + verso)
fontes/             ← Cinzel-Variable.ttf (fonte medieval)
ilustracoes/        ← Artes geradas (saída intermediária — 1 PNG por carta)
cartas_prontas/     ← Cartas compostas finais (saída definitiva)
comparacoes/
  v1/               ← Testes históricos: DreamShaper vs SDXL vs SD1.5
  v2/               ← Testes históricos V2
  v3/               ← Testes decisivos: dreamshaper8 | dreamshaper_xl | sdxl_lightning
doc/                ← Esta documentação
```

---

## Estado Atual do Projeto (Maio 2026)

- [x] Cartas JSON com 165 entradas e prompts em inglês
- [x] Testes comparativos V1/V2/V3 — SDXL Lightning escolhido
- [x] Templates SDXL gerados em `templates/`
- [x] `pipeline.py` criado (módulo compartilhado)
- [x] `gerar_imagens.py` atualizado para SDXL Lightning + 768×1024
- [ ] **Geração das 165 ilustrações** ← próximo passo
- [ ] Montagem das cartas
- [ ] Exportação PDF

---

## Próximos Passos

```bash
# 1. Ativar ambiente e gerar ilustrações (suporta resume se interrompido)
uv run python gerar_imagens.py

# 2. Montar as cartas (requer ilustracoes/ completo)
uv run python montar_cartas.py

# 3. Exportar PDF para impressão
uv run python gerar_pdf.py
```

