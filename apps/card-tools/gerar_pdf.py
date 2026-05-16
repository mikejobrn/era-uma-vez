"""
Gera PDFs prontos para grafica a partir das cartas montadas.
Layout: A4, 9 cartas por pagina (3x3), com marcas de corte.
"""
import json
from pathlib import Path
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

CARD_W_MM = 63.5
CARD_H_MM = 88.9
BLEED_MM = 3
MARK_LEN = 5
MARK_OFFSET = 2
COLS = 3
ROWS = 3
CARDS_PER_PAGE = COLS * ROWS

def draw_cut_marks(c, x, y, w, h):
    c.setStrokeColorRGB(0, 0, 0)
    c.setLineWidth(0.3)
    mo = MARK_OFFSET * mm
    ml = MARK_LEN * mm
    # Cantos
    for cx, cy, dx, dy in [
        (x, y+h, -1, 1), (x+w, y+h, 1, 1),
        (x, y, -1, -1), (x+w, y, 1, -1),
    ]:
        c.line(cx + mo*dx, cy, cx + (mo+ml)*dx, cy)
        c.line(cx, cy + mo*dy, cx, cy + (mo+ml)*dy)

def generate_pdf(cards_dir, output_pdf, cartas, page_w=A4[0], page_h=A4[1]):
    c = canvas.Canvas(str(output_pdf), pagesize=A4)
    card_w = CARD_W_MM * mm
    card_h = CARD_H_MM * mm
    margin_x = (page_w - COLS * card_w) / 2
    margin_y = (page_h - ROWS * card_h) / 2

    total_pages = (len(cartas) + CARDS_PER_PAGE - 1) // CARDS_PER_PAGE

    for page_idx in range(total_pages):
        start = page_idx * CARDS_PER_PAGE
        end = min(start + CARDS_PER_PAGE, len(cartas))
        page_cards = cartas[start:end]

        for i, carta in enumerate(page_cards):
            col = i % COLS
            row = i // COLS
            x = margin_x + col * card_w
            y = page_h - margin_y - (row + 1) * card_h

            img_path = cards_dir / f"{carta['id']}.png"
            if img_path.exists():
                c.drawImage(str(img_path), x, y, card_w, card_h)
            draw_cut_marks(c, x, y, card_w, card_h)

        c.setFont("Helvetica", 8)
        c.drawString(10*mm, 5*mm, f"Era Uma Vez - Pagina {page_idx+1}/{total_pages}")
        c.showPage()
        print(f"  Pagina {page_idx+1}/{total_pages}")

    c.save()
    print(f"PDF salvo: {output_pdf}")

def generate_back_pdf(cartas, back_img_normal, back_img_final, output_pdf):
    c = canvas.Canvas(str(output_pdf), pagesize=A4)
    page_w, page_h = A4
    card_w = CARD_W_MM * mm
    card_h = CARD_H_MM * mm
    margin_x = (page_w - COLS * card_w) / 2
    margin_y = (page_h - ROWS * card_h) / 2
    
    num_cards = len(cartas)
    total_pages = (num_cards + CARDS_PER_PAGE - 1) // CARDS_PER_PAGE

    for page_idx in range(total_pages):
        start = page_idx * CARDS_PER_PAGE
        end = min(start + CARDS_PER_PAGE, num_cards)
        page_cards = cartas[start:end]
        
        for i, carta in enumerate(page_cards):
            col = (COLS - 1) - (i % COLS)  # Espelhado para frente-e-verso
            row = i // COLS
            x = margin_x + col * card_w
            y = page_h - margin_y - (row + 1) * card_h
            
            tipo = carta.get("tipo", "")
            img_path = back_img_final if tipo == "Final" else back_img_normal
            
            if img_path.exists():
                c.drawImage(str(img_path), x, y, card_w, card_h)
            draw_cut_marks(c, x, y, card_w, card_h)
            
        c.setFont("Helvetica", 8)
        c.drawString(10*mm, 5*mm, f"Era Uma Vez (Verso) - Pagina {page_idx+1}/{total_pages}")
        c.showPage()
        print(f"  Verso pagina {page_idx+1}/{total_pages}")
    c.save()
    print(f"PDF verso salvo: {output_pdf}")

def main():
    cards_dir = Path("cartas_prontas")
    back_img_normal = Path("templates/verso.png")
    back_img_final = Path("templates/verso_final.png")

    with open("cartas.json", "r", encoding="utf-8") as f:
        cartas = json.load(f)

    print(f"Gerando PDF frente ({len(cartas)} cartas)...")
    generate_pdf(cards_dir, Path("baralho_frente.pdf"), cartas)

    if back_img_normal.exists():
        print(f"Gerando PDF verso...")
        generate_back_pdf(cartas, back_img_normal, back_img_final, Path("baralho_verso.pdf"))
    else:
        print("Aviso: templates/verso.png nao encontrado, PDF de verso nao gerado.")

    print("Concluido!")

if __name__ == "__main__":
    main()
