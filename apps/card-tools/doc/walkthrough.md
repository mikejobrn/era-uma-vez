# Walkthrough: Produção Completa do Deck — Do Zero ao PDF

Guia passo-a-passo para executar o pipeline completo em um ambiente limpo.

---

## Pré-requisitos

- Python 3.11+
- `uv` instalado (`pip install uv`)
- GPU NVIDIA com CUDA (mínimo 4GB VRAM — testado na RTX 3050 Ti)
- ~20GB de espaço em disco (modelos Hugging Face em cache)

---

## Passo 0: Instalar dependências

```bash
uv sync
```

O `pyproject.toml` define todas as dependências incluindo o índice PyTorch com CUDA 12.8.
Na primeira execução, `uv` baixa e instala tudo automaticamente.

---

## Passo 1: Gerar a base de dados das cartas

```bash
uv run python criar_cartas_json.py
```

**Saída:** `cartas.json` com 165 cartas estruturadas:
- IDs canônicos (`A01`–`C38` + Finais)
- Texto em português e inglês
- Flag `interrupt` (cartas com asterisco)
- `prompt_en` para geração de arte

> Só precisa ser executado uma vez. Não re-execute se `cartas.json` já existir
> a menos que queira regenerar o arquivo do zero.

---

## Passo 2: Gerar os templates das cartas

```bash
uv run python gerar_templates_xl.py
```

**Saída:** 7 arquivos PNG em `templates/`:
- `template_Evento.png`, `template_Coisa.png`, `template_Aspecto.png`
- `template_Lugar.png`, `template_Personagem.png`, `template_Final.png`
- `verso.png`

**Tempo:** ~5–10 minutos (download do modelo ~6GB na primeira vez).

> Os templates já foram gerados e estão em `templates/`. Só re-execute se quiser
> regenerar os templates com novos prompts ou seed diferente.

---

## Passo 3: Gerar as 165 ilustrações

```bash
uv run python gerar_imagens.py
```

**Saída:** 165 arquivos PNG em `ilustracoes/` (768×1024px cada).

**Tempo estimado:** ~35–40s por imagem ≈ **1.7 horas** no total.

**Resume automático:** Se o processo for interrompido (queda de energia, Ctrl+C),
basta executar o mesmo comando novamente — ele detecta as imagens já geradas
e continua do ponto onde parou.

**Verificação:**
```bash
# Contar quantas imagens foram geradas
ls ilustracoes/*.png | Measure-Object  # PowerShell
```

---

## Passo 4: Montar as cartas

```bash
uv run python montar_cartas.py
```

**Requer:** `ilustracoes/` completo, `templates/`, `fontes/Cinzel-Variable.ttf`

**Saída:** 165 arquivos PNG em `cartas_prontas/` (825×1125px, 300 DPI + 3mm bleed).

Cada carta combina:
1. Template de fundo do tipo correspondente
2. Ilustração redimensionada e recortada com cantos arredondados
3. Nome da carta com fonte Cinzel

---

## Passo 5: Exportar para PDF

```bash
uv run python gerar_pdf.py
```

**Requer:** `cartas_prontas/` completo

**Saída:** PDFs A4 prontos para gráfica:
- Layout 3×3 cartas por página (9 cartas/página → ~19 páginas)
- Marcas de corte em cada canto
- Página de verso espelhada horizontalmente para impressão frente-e-verso

---

## Troubleshooting

### `CUDA out of memory`
O `pipeline.py` usa `enable_model_cpu_offload()` que já lida com 4GB VRAM.
Se ainda ocorrer OOM, feche outros programas que usem a GPU e tente novamente.

### Carta com arte ruim
Edite o `prompt_en` da carta em `criar_cartas_json.py`, regenere o `cartas.json`
e delete apenas o PNG problemático em `ilustracoes/`. Ao rodar `gerar_imagens.py`
novamente, apenas essa carta será regerada.

### Template não encontrado
Verifique se `templates/template_{tipo}.png` existe. Se não, execute o Passo 2.
O `montar_cartas.py` tem fallback para fundo sólido, mas a qualidade será inferior.
