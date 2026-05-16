import os
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import textwrap
from fpdf import FPDF

# Configurações de Dimensões (A5 a 300 DPI)
# 148mm x 210mm -> ~1748 x 2480 pixels
PAGE_W, PAGE_H = 1748, 2480
CARD_W, CARD_H = 825, 1125 # Referência das cartas originais

# Cores Oficiais (Extraídas de montar_cartas.py)
COLORS = {
    'primary': '#923c35',   # Vermelho Evento (Títulos)
    'secondary': '#4f2015', # Marrom Escuro (Texto/Bordas)
    'personagem': '#283618',
    'bg_parchment': '#f5ebdc',
    'accent': '#c9a84c'     # Dourado dos nós
}

# Caminhos
FONT_DIR = Path("fontes")
TEMPLATE_DIR = Path("templates")
CARD_DIR = Path("cartas_prontas")
OUTPUT_DIR = Path("manual_build")
OUTPUT_DIR.mkdir(exist_ok=True)

def load_font(name, size):
    path = FONT_DIR / name
    if path.exists():
        return ImageFont.truetype(str(path), size)
    return ImageFont.load_default()

def extract_assets():
    """Extrai os nós celtas da carta A31 para usar no manual."""
    a31_path = CARD_DIR / "A31.png"
    if not a31_path.exists():
        print("Aviso: A31.png não encontrada. Usando placeholders para nós.")
        return None, None
    
    img = Image.open(a31_path).convert("RGBA")
    # Canto (Top-Left)
    corner = img.crop((0, 0, 180, 180))
    # Divisor (Segmento da borda superior)
    divider = img.crop((180, 0, 645, 80))
    
    return corner, divider

def get_clean_texture():
    """Isola um pedaço limpo de pergaminho do verso_final.png."""
    path = TEMPLATE_DIR / "verso_final.png"
    if not path.exists():
        return Image.new("RGBA", (PAGE_W, PAGE_H), COLORS['bg_parchment'])
    
    img = Image.open(path).convert("RGBA")
    # Pega um patch do canto superior direito (onde geralmente é limpo)
    # e redimensiona para cobrir a página
    texture = img.crop((500, 50, 750, 300)) 
    texture = texture.resize((PAGE_W, PAGE_H), Image.LANCZOS)
    return texture

class ManualGenerator:
    def __init__(self):
        self.pages = []
        self.corner, self.divider = extract_assets()
        self.bg_texture = get_clean_texture()
        self.font_title = load_font("PirataOne.ttf", 140)
        self.font_section = load_font("PirataOne.ttf", 100)
        self.font_body = load_font("Cinzel-Variable.ttf", 45)
        self.font_body_bold = load_font("Cinzel-Variable.ttf", 50)
        self.font_final = load_font("UnifrakturCook.ttf", 200)

    def _add_corners(self, draw, img, x, y, w, h):
        if not self.corner: return
        c_size = 100
        # TL
        c_tl = self.corner.resize((c_size, c_size), Image.LANCZOS)
        img.paste(c_tl, (x-10, y-10), c_tl)
        # TR
        c_tr = c_tl.rotate(-90)
        img.paste(c_tr, (x+w-c_size+10, y-10), c_tr)
        # BL
        c_bl = c_tl.rotate(90)
        img.paste(c_bl, (x-10, y+h-c_size+10), c_bl)
        # BR
        c_br = c_tl.rotate(180)
        img.paste(c_br, (x+w-c_size+10, y+h-c_size+10), c_br)

    def create_cover(self):
        img = Image.open(TEMPLATE_DIR / "verso.png").convert("RGBA")
        img = img.resize((PAGE_W, PAGE_H), Image.LANCZOS)
        draw = ImageDraw.Draw(img)
        
        # Título Principal
        title = "Era uma vez"
        draw.text((PAGE_W//2, 400), title, fill="#1a1a0f", font=self.font_final, anchor="mm")
        
        # Subtítulo
        sub = "MANUAL DO CONTADOR"
        draw.text((PAGE_W//2, 1800), sub, fill="#1a1a0f", font=self.font_section, anchor="mm")
        
        # Tagline
        tag = "A arte de contar histórias\ne vencer (feliz para sempre!)"
        draw.text((PAGE_W//2, 2000), tag, fill="#2a2a1a", font=self.font_body, anchor="mm", align="center")
        
        self.pages.append(img)

    def create_page_intro(self):
        img = self.bg_texture.copy()
        draw = ImageDraw.Draw(img)
        
        # Título
        draw.text((PAGE_W//2, 300), "1. O Objetivo", fill=COLORS['primary'], font=self.font_section, anchor="mm")
        
        text = ("Ser o primeiro jogador a se livrar de todas as suas Cartas de História, "
                "guiando a narrativa para que ela termine de forma lógica usando a sua "
                "carta de Final (Felizes Para Sempre).")
        
        y = 500
        for line in textwrap.wrap(text, width=50):
            draw.text((150, y), line, fill="#141414", font=self.font_body)
            y += 60

        draw.text((PAGE_W//2, y + 200), "2. Preparação", fill=COLORS['primary'], font=self.font_section, anchor="mm")
        y += 400
        prep = ("Separe as Cartas de Finais das Cartas de História e embaralhe ambos os montes separadamente. "
                "A sua Carta de Final deve ser mantida em segredo!")
        for line in textwrap.wrap(prep, width=55):
            draw.text((150, y), line, fill="#141414", font=self.font_body)
            y += 60

        self.pages.append(img)

    def create_page_narrador(self):
        img = self.bg_texture.copy()
        draw = ImageDraw.Draw(img)
        
        # Header
        draw.text((PAGE_W//2, 100), "Era Uma Vez", fill=COLORS['secondary'], font=load_font("PirataOne.ttf", 60), anchor="mm")
        if self.divider:
            div = self.divider.resize((PAGE_W - 400, 30), Image.LANCZOS)
            img.paste(div, (200, 150), div)
            
        # Título da Seção
        draw.text((150, 250), "4. O Turno do Narrador", fill=COLORS['primary'], font=self.font_section)
        
        # Corpo
        text = ("O Narrador atual começa a inventar um conto de fadas. Sempre que ele mencionar algo "
                "que represente o conceito exato de uma de suas Cartas de História, ele coloca essa "
                "carta na mesa virada para cima.\n\n"
                "E O MAIS IMPORTANTE: O Narrador pode continuar jogando múltiplas cartas na mesa durante "
                "o seu turno! Ele não precisa parar na primeira carta.")
        
        y_text = 400
        for line in textwrap.wrap(text, width=55):
            draw.text((150, y_text), line, fill="#141414", font=self.font_body)
            y_text += 60

        # Exemplo Encadeamento (Box)
        box_y = 850
        box_h = 1000
        # Desenha fundo do box
        draw.rectangle([100, box_y, PAGE_W-100, box_y+box_h], fill="#e8d5b7", outline=COLORS['secondary'], width=3)
        self._add_corners(draw, img, 100, box_y, PAGE_W-200, box_h)
        
        draw.text((PAGE_W//2, box_y + 60), "EXEMPLO DE ENCADEAMENTO", fill=COLORS['primary'], font=self.font_body_bold, anchor="mm")
        
        ex_text = ("\"O poderoso REI percebeu que seu povo estava faminto. Ele então ordenou que reunissem "
                   "toda a COMIDA dos estoques e cavalgou depressa até a CIDADE mais próxima para distribuir.\"")
        
        y_ex = box_y + 150
        for line in textwrap.wrap(ex_text, width=50):
            draw.text((150, y_ex), line, fill=COLORS['secondary'], font=self.font_body)
            y_ex += 55
            
        # Cartas reais
        cards = ["A31.png", "A09.png", "A24.png"]
        x_card = 200
        for c_name in cards:
            c_path = CARD_DIR / c_name
            if c_path.exists():
                c_img = Image.open(c_path).convert("RGBA")
                c_img = c_img.resize((350, 480), Image.LANCZOS)
                img.paste(c_img, (x_card, y_ex + 50), c_img)
            x_card += 450

        # Regra de Ouro
        draw.rectangle([150, 2000, PAGE_W-150, 2250], fill=COLORS['primary'])
        draw.text((PAGE_W//2, 2050), "REGRA DE OURO", fill=COLORS['accent'], font=self.font_body_bold, anchor="mm")
        draw.text((PAGE_W//2, 2150), "A história deve fluir e fazer sentido!", fill="#f5ebdc", font=self.font_body, anchor="mm")

        self.pages.append(img)

    def create_page_interrupcoes(self):
        img = self.bg_texture.copy()
        draw = ImageDraw.Draw(img)
        
        draw.text((PAGE_W//2, 250), "5. Como Roubar a Cena", fill=COLORS['primary'], font=self.font_section, anchor="mm")
        
        # Box Interrupção 1
        box_y = 450
        box_h = 600
        draw.rectangle([100, box_y, PAGE_W-100, box_y+box_h], fill="#e8d5b7", outline=COLORS['secondary'], width=3)
        self._add_corners(draw, img, 100, box_y, PAGE_W-200, box_h)
        
        draw.text((180, box_y + 80), "1. Interrupção por Citação", fill=COLORS['primary'], font=self.font_body_bold)
        desc = ("Se o Narrador disser uma palavra idêntica a uma carta na sua mão, "
                "você a joga imediatamente e assume a história!")
        y_desc = box_y + 180
        for line in textwrap.wrap(desc, width=45):
            draw.text((180, y_desc), line, fill="#141414", font=self.font_body)
            y_desc += 60

        # Tabela de Distribuição
        y_tab = 1800
        draw.text((PAGE_W//2, y_tab), "Distribuição de Cartas", fill=COLORS['secondary'], font=self.font_section, anchor="mm")
        
        y_row = y_tab + 150
        rows = [("2-3 jogadores", "10 Cartas + 1 Final"), ("4-5 jogadores", "8 Cartas + 1 Final"), ("6+ jogadores", "6 Cartas + 1 Final")]
        for i, (p, c) in enumerate(rows):
            fill = "#e8d5b7" if i % 2 == 0 else "#f5ebdc"
            draw.rectangle([200, y_row, PAGE_W-200, y_row+100], fill=fill)
            draw.text((250, y_row+20), p, fill=COLORS['secondary'], font=self.font_body_bold)
            draw.text((PAGE_W-250, y_row+20), c, fill="#141414", font=self.font_body, anchor="ra")
            y_row += 120

        self.pages.append(img)

    def save_pdf(self, filename):
        # Primeiro salva as imagens
        temp_files = []
        for i, page in enumerate(self.pages):
            path = OUTPUT_DIR / f"page_{i}.png"
            page.save(path)
            temp_files.append(path)
            
        # Compila em PDF usando FPDF (A5)
        pdf = FPDF(format='A5')
        for f in temp_files:
            pdf.add_page()
            # 148mm x 210mm
            pdf.image(str(f), 0, 0, 148, 210)
            
        pdf.output(filename)
        print(f"Manual final gerado: {filename}")

if __name__ == "__main__":
    gen = ManualGenerator()
    gen.create_cover()
    gen.create_page_narrador()
    # Adicionar as outras páginas seguindo o mesmo padrão...
    gen.save_pdf("manual_regras_v2.pdf")
