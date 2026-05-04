# Plano de Implementação: Era Uma Vez PT-BR

Estado final do projeto e decisões técnicas tomadas para produção das 165 cartas.

---

## Modelo de IA: SDXL Lightning (4-step)

Após três rodadas de testes comparativos (`comparacoes/v1`, `v2`, `v3`), o **SDXL Lightning** foi escolhido:

| Critério | Resultado |
|---|---|
| Qualidade visual | Detalhes superiores, maior fidelidade aos prompts |
| Velocidade | ~35–40s por imagem na RTX 3050 Ti com otimizações |
| Eficiência de memória | Funciona em 4GB VRAM com `enable_model_cpu_offload` |
| Passos de inferência | Apenas 4 (vs 25–30 de modelos convencionais) |

---

## Resolução e Proporção

- **Resolução de produção:** 768×1024px
- **Proporção:** 5:7 (Poker Size padrão)
- **Justificativa:** É o bucket nativo do SDXL para essa proporção — evita distorções e mantém qualidade máxima. Múltiplo de 64 em ambas as dimensões.

---

## Otimizações de Memória (4GB VRAM)

Todas centralizadas em `pipeline.py`:

| Método | Efeito |
|---|---|
| `enable_model_cpu_offload()` | Move componentes inteiros para CPU quando ociosos |
| `enable_vae_tiling()` | Decodifica o VAE em tiles — evita OOM na decodificação |
| `enable_vae_slicing()` | Processa lotes de imagens um a um |

> Esses métodos são fornecidos nativamente pelo `diffusers` (via `accelerate`). Não é necessária nenhuma biblioteca adicional de middleware.

---

## Módulo Compartilhado: `pipeline.py`

O carregamento do SDXL Lightning requer uma sequência não trivial (UNet externo + scheduler customizado) que foi **centralizada em `pipeline.py`** para evitar duplicação:

```python
from pipeline import load_sdxl_lightning, CARD_W, CARD_H, LIGHTNING_STEPS, LIGHTNING_GUIDANCE
pipe = load_sdxl_lightning()
```

Scripts que importam `pipeline.py`:
- `gerar_imagens.py` — geração de produção
- `gerar_templates_xl.py` — geração de templates
- `comparar_modelos.py` — testes comparativos

---

## Fluxo de Trabalho de Produção

```
criar_cartas_json.py  →  cartas.json
gerar_templates_xl.py →  templates/
gerar_imagens.py      →  ilustracoes/
montar_cartas.py      →  cartas_prontas/
gerar_pdf.py          →  deck_frente.pdf + deck_verso.pdf
```

### Regeneração de Ilustrações

- `gerar_imagens.py` continua pulando arquivos `.png` já existentes.
- Se uma ilustração for apagada e o script rodar novamente, a carta ausente recebe uma **nova seed aleatória**, gerando uma nova variação visual.
- A estética do deck permanece consistente porque o prompt base, o `NEGATIVE_PROMPT`, o modelo SDXL Lightning, a resolução e os parâmetros canônicos continuam os mesmos.
- Cada geração salva metadata em `ilustracoes/generation_metadata.json` com seed, tentativa e timestamp para rastreabilidade.

---

## Estrutura de Pastas

```
/
├── pipeline.py              ← Módulo compartilhado de carregamento de modelos
├── criar_cartas_json.py     ← Fonte de dados (PDF oficial Atlas Games)
├── gerar_templates_xl.py    ← Gera templates via SDXL Lightning
├── gerar_imagens.py         ← Geração em massa das 165 ilustrações
├── montar_cartas.py         ← Composição: template + arte + texto
├── gerar_pdf.py             ← Exportação para impressão (A4, 3×3, marcas de corte)
├── comparar_modelos.py      ← Testes de qualidade (uso pontual)
├── criar_db_cartas.py       ← LEGADO — não usar
│
├── cartas.json              ← Base de dados das cartas
├── pyproject.toml           ← Dependências (gerenciado com uv)
│
├── templates/               ← 7 PNGs: template_{tipo}.png + verso.png
├── fontes/                  ← Cinzel-Variable.ttf
├── ilustracoes/             ← Saída intermediária: 165 PNGs de arte (768×1024)
├── cartas_prontas/          ← Saída definitiva: 165 PNGs compostos (825×1125)
│
├── comparacoes/
│   ├── v1/                  ← Testes históricos
│   ├── v2/                  ← Testes históricos
│   └── v3/                  ← Decisivos: dreamshaper8 | dreamshaper_xl | sdxl_lightning
│
└── doc/                     ← Documentação do projeto
```

---

## Verificação Final

- [x] Testes V3 — SDXL Lightning aprovado
- [x] Templates SDXL gerados em `templates/`
- [x] `pipeline.py` criado e integrado aos 3 scripts
- [x] `gerar_imagens.py` atualizado (SDXL Lightning + 768×1024)
- [x] Pastas de comparação reorganizadas em `comparacoes/`
- [ ] Geração das 165 ilustrações
- [ ] Montagem das cartas
- [ ] Exportação PDF

