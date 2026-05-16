"""
Monta as 165 cartas finais combinando template + ilustracao + texto.
Tamanho final: 825x1125px (Poker Size com bleed de 3mm, 300 DPI).
Tamanho do template original: 768x1024px.
"""
import json
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import textwrap

# Dimensoes do template original
ORIG_W, ORIG_H = 768, 1024

# Dimensoes (Poker Size 300 DPI + 3mm bleed)
CARD_W, CARD_H = 825, 1125

TYPE_LABELS = {
    "Evento": "EVENTO", "Coisa": "OBJETO", "Aspecto": "ASPECTO",
    "Lugar": "LUGAR", "Personagem": "PERSONAGEM", "Final": "FINAL FELIZ",
}

TYPE_COLORS = {
    'Evento': {'circle': '#ff7c70', 'title': '#923c35', 'type': '#ff7c70', 'interrupt': '#923c35'},
    'Coisa': {'circle': '#d5b040', 'title': '#7a4b00', 'type': '#d5b040', 'interrupt': '#7a4b00'},
    'Aspecto': {'circle': '#94709d', 'title': '#4c1b58', 'type': '#94709d', 'interrupt': '#4c1b58'},
    'Lugar': {'circle': '#8773ab', 'title': '#35215b', 'type': '#8773ab', 'interrupt': '#35215b'},
    'Personagem': {'circle': '#c7bc70', 'title': '#283618', 'type': '#c7bc70', 'interrupt': '#283618'}
}

def load_font(font_name, size):
    font_path = Path("fontes") / font_name
    if font_path.exists():
        return ImageFont.truetype(str(font_path), size)
    # Fallback
    try:
        return ImageFont.truetype("arial.ttf", size)
    except:
        return ImageFont.load_default()

def scale_x(x):
    return int(x * (CARD_W / ORIG_W))

def scale_y(y):
    return int(y * (CARD_H / ORIG_H))

def create_card(carta, ilustracao_path, output_path):
    tipo = carta["tipo"]
    is_interrupt = carta.get("interrupt", False)

    if tipo == "Final":
        img = Image.new("RGBA", (CARD_W, CARD_H), (255, 255, 255, 255))
    else:
        if ilustracao_path and Path(ilustracao_path).exists():
            illust = Image.open(ilustracao_path).convert("RGBA")
            
            # Coordenadas do buraco no template original (768x1024)
            hole_x1, hole_y1 = scale_x(80), scale_y(88)
            hole_x2, hole_y2 = scale_x(688), scale_y(814)
            
            hole_w = hole_x2 - hole_x1
            hole_h = hole_y2 - hole_y1
            
            # Aumenta para 110% do tamanho do buraco para deixar uma sobra de 10% sob o template
            target_w = int(hole_w * 1.1)
            target_h = int(hole_h * 1.1)
            
            illust = illust.resize((target_w, target_h), Image.LANCZOS)
            
            # Fundo base da carta
            img = Image.new("RGBA", (CARD_W, CARD_H), (0, 0, 0, 255))
            
            # Centraliza a ilustração dentro do buraco
            hole_cx = hole_x1 + hole_w // 2
            hole_cy = hole_y1 + hole_h // 2
            paste_x = hole_cx - target_w // 2
            paste_y = hole_cy - target_h // 2
            
            img.paste(illust, (paste_x, paste_y), illust)
        else:
            img = Image.new("RGBA", (CARD_W, CARD_H), (0, 0, 0, 255))

    # Carregar template correspondente e sobrepor (usa transparência do template)
    template_path = Path("templates") / f"template_{tipo}.png"
    if template_path.exists():
        template = Image.open(template_path).convert("RGBA")
        template = template.resize((CARD_W, CARD_H), Image.LANCZOS)
        # alpha_composite garante que a transparência do template funcione sobre a imagem base
        img = Image.alpha_composite(img, template)
    
    draw = ImageDraw.Draw(img)

    if tipo == "Final":
        # Usar Unifraktur Cook para o Final
        font_final = load_font("UnifrakturCook.ttf", 60)
        texto = carta["texto_pt"]
        lines = textwrap.wrap(texto, width=18)
        
        # Desenhar os textos numa imagem temporária para poder rotacionar/inclinar (skew)
        txt_img = Image.new("RGBA", (CARD_W, CARD_H), (255, 255, 255, 0))
        txt_draw = ImageDraw.Draw(txt_img)
        
        # Centralizar verticalmente na imagem temporária
        total_height = sum([txt_draw.textbbox((0, 0), line, font=font_final)[3] - txt_draw.textbbox((0, 0), line, font=font_final)[1] + 15 for line in lines])
        curr_y = (CARD_H - total_height) // 2 + 50 
        
        for line in lines:
            bbox = txt_draw.textbbox((0, 0), line, font=font_final)
            tw = bbox[2] - bbox[0]
            th = bbox[3] - bbox[1]
            txt_draw.text(((CARD_W - tw) // 2 + 20, curr_y), line, fill="#382e25", font=font_final)
            curr_y += th + 15
            
        # Rotação leve (skew) para acompanhar a inclinação do pergaminho do exemplo
        txt_img = txt_img.rotate(3, resample=Image.BICUBIC, expand=False)
        img = Image.alpha_composite(img, txt_img)
            
    else:
        colors = TYPE_COLORS.get(tipo, {'circle': '#e7987c', 'title': '#4f2015', 'type': '#e4a895', 'interrupt': '#8B1A1A'})
        
        # Bolinha Superior Direita (Numero da carta)
        font_number = load_font("PirataOne.ttf", 84)
        card_id = carta["id"]
        
        # Coordenadas originais do template 768x1024 fornecidas pelo usuário/calculadas
        orig_cx = 628 # Deslocado levemente para a direita para centralizar perfeitamente
        orig_cy = 115
        draw.text((scale_x(orig_cx), scale_y(orig_cy)), card_id, fill=colors["circle"], font=font_number, anchor="mt")

        # Rodapé - Nome da Carta
        texto = carta["texto_pt"]
        font_title = load_font("PirataOne.ttf", 65)
        bbox = draw.textbbox((0, 0), texto, font=font_title)
        tw = bbox[2] - bbox[0]
        th = bbox[3] - bbox[1]
        
        if tw > CARD_W - 200:
            font_title = load_font("PirataOne.ttf", 50)
        
        # Posição do texto do rodapé (Banner principal)
        orig_title_cx = 384 # 768/2 (centro)
        orig_title_cy = 833
        draw.text((scale_x(orig_title_cx), scale_y(orig_title_cy)), texto, fill=colors["title"], font=font_title, anchor="mt")

        # Rodapé - Tipo da Carta
        label = TYPE_LABELS.get(tipo, tipo.upper())
        label = f"= {label} ="
            
        font_type = load_font("PirataOne.ttf", 45)
        orig_type_cx = 384
        orig_type_cy = 909
        draw.text((scale_x(orig_type_cx), scale_y(orig_type_cy)), label, fill=colors["type"], font=font_type, anchor="mt")
        
        # Selo de Interrupção abaixo da borda inferior
        if is_interrupt:
            font_interrupt = load_font("PirataOne.ttf", 30)
            orig_int_cx = 384
            # A margem inferior do template (1024) termina por volta do pixel 964. O final é 1024. O meio é (964+1024)/2 = 994.
            orig_int_cy = 994 
            draw.text((scale_x(orig_int_cx), scale_y(orig_int_cy)), "INTERRUPÇÃO", fill=colors["interrupt"], font=font_interrupt, anchor="mm")

    img = img.convert("RGB")
    img.save(output_path, dpi=(300, 300))

def main():
    output_dir = Path("cartas_prontas")
    output_dir.mkdir(exist_ok=True)
    illust_dir = Path("ilustracoes")

    with open("cartas.json", "r", encoding="utf-8") as f:
        cartas = json.load(f)

    # Filtrar por IDs fornecidos na linha de comando, se existirem
    args_ids = sys.argv[1:]
    if args_ids:
        cartas = [c for c in cartas if c["id"] in args_ids]
        print(f"Filtrando execução para {len(cartas)} cartas: {args_ids}")

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
