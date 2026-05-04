"""
Gera ilustrações únicas para as cartas não-Final usando SDXL Lightning (4-step).
Resolução: 768x1024px (proporção 5:7, Poker Size nativo para SDXL).

Suporta checkpoint/resume: se interrompido, continua de onde parou.
"""
import secrets
import json
import torch
from datetime import datetime, timezone
from pathlib import Path
from pipeline import (
    build_illustration_prompt,
    ILLUSTRATION_NEGATIVE_PROMPT,
    load_sdxl_lightning,
    CARD_W,
    CARD_H,
    PRODUCTION_STEPS,
    PRODUCTION_GUIDANCE,
)

OUTPUT_DIR = Path("ilustracoes")
CARDS_FILE = Path("cartas.json")
METADATA_FILE = OUTPUT_DIR / "generation_metadata.json"
NEGATIVE_PROMPT = ILLUSTRATION_NEGATIVE_PROMPT

def load_metadata():
    if not METADATA_FILE.exists():
        return {}

    with open(METADATA_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def save_metadata(metadata):
    with open(METADATA_FILE, "w", encoding="utf-8") as f:
        json.dump(metadata, f, ensure_ascii=False, indent=2)


def build_generation_record(carta, seed, attempt):
    return {
        "attempt": attempt,
        "seed": seed,
        "prompt": build_illustration_prompt(carta["prompt_en"]),
        "base_prompt": carta["prompt_en"],
        "negative_prompt": NEGATIVE_PROMPT,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "model": "SDXL Lightning",
        "num_inference_steps": PRODUCTION_STEPS,
        "guidance_scale": PRODUCTION_GUIDANCE,
        "width": CARD_W,
        "height": CARD_H,
    }


def main():
    OUTPUT_DIR.mkdir(exist_ok=True)

    with open(CARDS_FILE, "r", encoding="utf-8") as f:
        cartas = json.load(f)

    renderizaveis = [c for c in cartas if c["tipo"] != "Final"]
    total_renderizaveis = len(renderizaveis)
    existentes = set(p.stem for p in OUTPUT_DIR.glob("*.png"))
    pendentes = [c for c in renderizaveis if c["id"] not in existentes]
    metadata = load_metadata()

    print(f"Total de cartas renderizaveis: {total_renderizaveis}")
    print(f"Já geradas:                 {total_renderizaveis - len(pendentes)}")
    print(f"Pendentes:       {len(pendentes)}")

    if not pendentes:
        print("Todas as ilustrações já foram geradas!")
        return

    pipe = load_sdxl_lightning()

    try:
        for i, carta in enumerate(pendentes):
            card_id = carta["id"]
            output_path = OUTPUT_DIR / f"{card_id}.png"
            final_prompt = build_illustration_prompt(carta["prompt_en"])
            previous_attempt = metadata.get(card_id, {}).get("attempt", 0)
            attempt = previous_attempt + 1
            seed = secrets.randbits(32)
            generator = torch.Generator("cpu").manual_seed(seed)

            print(f"[{i+1}/{len(pendentes)}] {card_id}: {carta['texto_pt']}... (tentativa {attempt}, seed {seed})")

            try:
                image = pipe(
                    prompt=final_prompt,
                    negative_prompt=NEGATIVE_PROMPT,
                    num_inference_steps=PRODUCTION_STEPS,
                    guidance_scale=PRODUCTION_GUIDANCE,
                    width=CARD_W,
                    height=CARD_H,
                    generator=generator,
                ).images[0]
                image.save(output_path)
                metadata[card_id] = build_generation_record(carta, seed, attempt)
                save_metadata(metadata)
                print(f"  -> Salvo: {output_path}")
            except KeyboardInterrupt:
                # Remove arquivo parcial para não comprometer o resume
                if output_path.exists():
                    output_path.unlink()
                    print(f"\n  Arquivo parcial removido: {output_path}")
                raise
            except Exception as e:
                print(f"  ERRO ao gerar {card_id}: {e}")
                torch.cuda.empty_cache()
                continue
    except KeyboardInterrupt:
        total = total_renderizaveis - len([c for c in renderizaveis if c["id"] not in set(p.stem for p in OUTPUT_DIR.glob("*.png"))])
        print(f"\nInterrompido! {total}/{total_renderizaveis} ilustrações salvas em '{OUTPUT_DIR}'")
        print("Execute novamente para continuar do ponto onde parou.")
        return

    total = total_renderizaveis - len([c for c in renderizaveis if c["id"] not in set(p.stem for p in OUTPUT_DIR.glob("*.png"))])
    print(f"\nConcluído! {total}/{total_renderizaveis} ilustrações em '{OUTPUT_DIR}'")


if __name__ == "__main__":
    main()
