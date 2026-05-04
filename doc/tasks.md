# Tasks: Era Uma Vez PT-BR

## Concluídas

- [x] Levantamento das 165 cartas a partir do PDF oficial (Atlas Games)
- [x] `criar_cartas_json.py` — geração do `cartas.json` com bilíngue, IDs, interrupt, prompts
- [x] Testes comparativos V1 — DreamShaper 8 vs SDXL base vs SD1.5
- [x] Testes comparativos V2 — refinamento de resolução e parâmetros
- [x] Testes comparativos V3 — DreamShaper 8 vs DreamShaper XL vs SDXL Lightning
- [x] Decisão do modelo: **SDXL Lightning**, 768×1024px
- [x] Templates élficos/celtas gerados via SDXL Lightning em `templates/`
- [x] Reorganização das pastas de comparação em `comparacoes/v1`, `v2`, `v3`
- [x] Criação de `pipeline.py` (módulo compartilhado de carregamento)
- [x] Refatoração de `gerar_imagens.py` — SDXL Lightning + 768×1024
- [x] Refatoração de `gerar_templates_xl.py` — usa `pipeline.py`
- [x] Refatoração de `comparar_modelos.py` — usa `pipeline.py`, OUTPUT_ROOT atualizado

## Pendentes

- [ ] **Geração das 165 ilustrações**
  - Executar: `uv run python gerar_imagens.py`
  - Saída: `ilustracoes/*.png`
  - Suporta resume — pode ser interrompido e reiniciado
  - Tempo estimado: ~35–40s por imagem (~1.7h total)

- [ ] **Revisão das ilustrações geradas**
  - Verificar cartas com prompts difíceis (especialmente Personagens)
  - Re-gerar com seed diferente se necessário (editar `SEED` em `gerar_imagens.py`)

- [ ] **Montagem das 165 cartas**
  - Executar: `uv run python montar_cartas.py`
  - Requer: `ilustracoes/` completo + `templates/` + `fontes/`
  - Saída: `cartas_prontas/*.png`

- [ ] **Exportação PDF para impressão**
  - Executar: `uv run python gerar_pdf.py`
  - Saída: PDF A4 com layout 3×3, marcas de corte, frente e verso

- [ ] **Revisão tipográfica**
  - Verificar textos longos (cartas Finais) que podem vazar a área de texto
  - Ajustar `base_text_y` em `montar_cartas.py` se necessário

- [ ] **Impressão de teste**
  - Imprimir 1 página (9 cartas) para validar escala, cores e marcas de corte
  - Confirmar que o papel A4 e sangria de 3mm estão corretos
