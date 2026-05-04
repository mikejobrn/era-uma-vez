"""
Monta as 165 cartas finais combinando template + ilustracao + texto.
Tamanho: 825x1125px (Poker Size com bleed de 3mm, 300 DPI).
"""
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import textwrap

# Dimensoes (Poker Size 300 DPI + 3mm bleed)
CARD_W, CARD_H = 825, 1125
BLEED = 37  # ~3mm em pixels a 300 DPI
SAFE = 37
IMG_AREA_Y = 180
IMG_AREA_H = 550
IMG_AREA_X = BLEED + SAFE + 20
IMG_AREA_W = CARD_W - 2 * (BLEED + SAFE + 20)

# Cores por tipo
COLORS = {
    "Evento":     {"bg": "#8B1A1A", "accent": "#FF4444", "label": "#FFD700"},
    "Coisa":      {"bg": "#8B7500", "accent": "#FFD700", "label": "#FFFACD"},
    "Aspecto":    {"bg": "#4B0082", "accent": "#9370DB", "label": "#E6E6FA"},
    "Lugar":      {"bg": "#006400", "accent": "#32CD32", "label": "#90EE90"},
    "Personagem": {"bg": "#1B3A6B", "accent": "#4169E1", "label": "#B0C4DE"},
    "Final":      {"bg": "#3B3B3B", "accent": "#FFD700", "label": "#FFFACD"},
}

TYPE_LABELS = {
    "Evento": "EVENTO", "Coisa": "OBJETO", "Aspecto": "ASPECTO",
    "Lugar": "LUGAR", "Personagem": "PERSONAGEM", "Final": "FINAL FELIZ",
}

def load_font(size):
    font_path = Path("fontes/Cinzel-Variable.ttf")
    if font_path.exists():
        return ImageFont.truetype(str(font_path), size)
    # Fallback
    try:
        return ImageFont.truetype("arial.ttf", size)
    except:
        return ImageFont.load_default()

def draw_rounded_rect(draw, xy, radius, fill, outline=None, width=1):
    x0, y0, x1, y1 = xy
    draw.rounded_rectangle(xy, radius=radius, fill=fill, outline=outline, width=width)

def create_card(carta, ilustracao_path, output_path):
    tipo = carta["tipo"]
    colors = COLORS[tipo]
    is_interrupt = carta.get("interrupt", False)

    # Carregar o template correspondente ao invés de criar fundo sólido
    template_path = Path("templates") / f"template_{tipo}.png"
    if template_path.exists():
        img = Image.open(template_path).convert("RGB")
        img = img.resize((CARD_W, CARD_H), Image.LANCZOS)
    else:
        # Fallback se o template sumir
        img = Image.new("RGB", (CARD_W, CARD_H), colors["bg"])
    
    draw = ImageDraw.Draw(img)

    # Faixa do tipo (topo) - Agora mais discreta, já que o template já é ornamentado
    font_type = load_font(28)
    label = TYPE_LABELS.get(tipo, tipo.upper())
    if is_interrupt:
        label = f"* {label} *"
    bbox = draw.textbbox((0, 0), label, font=font_type)
    tw = bbox[2] - bbox[0]
    # Sombra para o texto do topo ser legível sobre o template
    draw.text(((CARD_W - tw) // 2 + 2, BLEED + 22), label, fill="#000000AA", font=font_type)
    draw.text(((CARD_W - tw) // 2, BLEED + 20), label, fill=colors["label"], font=font_type)

    # Area da ilustracao (Centralizada no espaco superior do template)
    if ilustracao_path and Path(ilustracao_path).exists():
        illust = Image.open(ilustracao_path).convert("RGB")
        # Redimensionar com alta qualidade
        illust = illust.resize((IMG_AREA_W, IMG_AREA_H), Image.LANCZOS)
        
        # Moldura decorativa sutil ao redor da arte
        border_w = 4
        draw.rounded_rectangle(
            (IMG_AREA_X - border_w, IMG_AREA_Y - border_w,
             IMG_AREA_X + IMG_AREA_W + border_w, IMG_AREA_Y + IMG_AREA_H + border_w),
            radius=15, fill=None, outline=colors["accent"], width=border_w
        )
        
        # Mascara para cantos levemente arredondados
        mask = Image.new("L", (IMG_AREA_W, IMG_AREA_H), 0)
        mask_draw = ImageDraw.Draw(mask)
        mask_draw.rounded_rectangle((0, 0, IMG_AREA_W, IMG_AREA_H), radius=12, fill=255)
        img.paste(illust, (IMG_AREA_X, IMG_AREA_Y), mask)

    # Texto da carta (Focado no Banner Inferior do template)
    texto = carta["texto_pt"]
    # Ajuste de Y para o banner inferior (baseado nos templates SDXL)
    base_text_y = 835 

    if tipo == "Final":
        font_title = load_font(26) # Fonte um pouco menor para finais longos
        lines = textwrap.wrap(texto, width=38)
        curr_y = base_text_y
        for line in lines:
            bbox = draw.textbbox((0, 0), line, font=font_title)
            tw = bbox[2] - bbox[0]
            th = bbox[3] - bbox[1]
            # Texto escuro (marrom medieval) sobre o pergaminho
            draw.text(((CARD_W - tw) // 2, curr_y), line, fill="#1A0F0A", font=font_title)
            curr_y += th + 6
    else:
        font_title = load_font(44) # Titulo elegante e grande
        bbox = draw.textbbox((0, 0), texto, font=font_title)
        tw = bbox[2] - bbox[0]
        if tw > CARD_W - 160: # Margens de seguranca laterais
            font_title = load_font(34)
            bbox = draw.textbbox((0, 0), texto, font=font_title)
            tw = bbox[2] - bbox[0]
        draw.text(((CARD_W - tw) // 2, base_text_y + 15), texto, fill="#1A0F0A", font=font_title)

    # Simbolo de interrupcao (Discreto e elegante)
    if is_interrupt:
        font_int = load_font(20)
        int_text = "INTERRUPÇÃO"
        bbox = draw.textbbox((0, 0), int_text, font=font_int)
        tw = bbox[2] - bbox[0]
        int_y = CARD_H - BLEED - 75
        badge_rect = ((CARD_W - tw) // 2 - 10, int_y - 4,
                      (CARD_W + tw) // 2 + 10, int_y + 28)
        draw_rounded_rect(draw, badge_rect, radius=6, fill="#701010EE")
        draw.text(((CARD_W - tw) // 2, int_y), int_text, fill="#F0F0F0", font=font_int)

    # Info tecnica (Deck e Numero)
    font_small = load_font(15)
    deck_label = f"Deck {carta['deck']} - #{carta['numero']:02d}"
    draw.text((BLEED + 50, CARD_H - BLEED - 35), deck_label, fill="#1A0F0A90", font=font_small)

    img.save(output_path, dpi=(300, 300))

def main():
    output_dir = Path("cartas_prontas")
    output_dir.mkdir(exist_ok=True)
    illust_dir = Path("ilustracoes")

    with open("cartas.json", "r", encoding="utf-8") as f:
        cartas = json.load(f)

    print(f"Montando {len(cartas)} cartas...")

    for i, carta in enumerate(cartas):
        card_id = carta["id"]
        illust_path = illust_dir / f"{card_id}.png"
        output_path = output_dir / f"{card_id}.png"

        create_card(carta, str(illust_path), str(output_path))

        if (i + 1) % 10 == 0 or i == len(cartas) - 1:
            print(f"  [{i+1}/{len(cartas)}] cartas montadas...")

    print(f"Concluido! {len(cartas)} cartas salvas em '{output_dir}'")

if __name__ == "__main__":
    main()
