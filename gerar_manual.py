from fpdf import FPDF
import os

class ManualPDF(FPDF):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Load custom fonts
        self.add_font('PirataOne', '', 'fontes/PirataOne.ttf')
        try:
            self.add_font('Cinzel', '', 'fontes/Cinzel-Variable.ttf')
            self.has_cinzel = True
        except:
            self.has_cinzel = False

    def add_page(self, *args, **kwargs):
        super().add_page(*args, **kwargs)
        # Add the lighter version of verso.png
        bg_path = 'templates/verso_claro.png'
        if os.path.exists(bg_path):
            self.image(bg_path, x=0, y=0, w=148, h=210)
        else:
            self.set_fill_color(245, 235, 220)
            self.rect(0, 0, 148, 210, style='F')

    def header(self):
        # Set font for the header
        self.set_font('PirataOne', '', 20)
        self.set_text_color(79, 32, 21)
        # Move to the right
        self.cell(0, 10, 'Era Uma Vez', align='C', new_x='LMARGIN', new_y='NEXT')
        self.ln(5)

    def footer(self):
        # Position at 1.5 cm from bottom
        self.set_y(-15)
        self.set_font('helvetica', 'I', 8)
        self.set_text_color(100, 100, 100)
        # Page number
        self.cell(0, 10, f'Página {self.page_no()}', align='C', new_x='LMARGIN', new_y='NEXT')

    def chapter_title(self, title):
        self.set_font('PirataOne', '', 24)
        self.set_text_color(139, 26, 26)
        self.cell(0, 10, title, align='C', new_x='LMARGIN', new_y='NEXT')
        self.ln(4)
        
    def sub_title(self, text):
        self.set_font('helvetica', 'B', 12)
        self.set_text_color(79, 32, 21)
        self.cell(0, 8, text, new_x='LMARGIN', new_y='NEXT')

    def chapter_body(self, text):
        self.set_font('helvetica', '', 11)
        self.set_text_color(20, 20, 20)
        self.multi_cell(0, 5.5, text)
        self.ln(4)
        
    def add_image_example(self, image_path, title, desc):
        self.set_font('helvetica', 'B', 12)
        self.set_text_color(79, 32, 21)
        self.cell(0, 6, title, new_x='LMARGIN', new_y='NEXT')
        
        self.set_font('helvetica', '', 10)
        self.set_text_color(20, 20, 20)
        self.multi_cell(0, 5, desc)
        
        y = self.get_y()
        if os.path.exists(image_path):
            self.image(image_path, x=self.get_x() + 44, y=y, w=40)
            self.set_y(y + 60)
        else:
            self.cell(0, 10, f'[Imagem não encontrada: {image_path}]', new_x='LMARGIN', new_y='NEXT')
            self.ln(10)
            
    def add_story_example(self, cards, story_text):
        # cards is a list of tuples: (image_path, highlight_word)
        self.set_font('helvetica', '', 11)
        self.set_text_color(20, 20, 20)
        self.multi_cell(0, 5.5, story_text)
        self.ln(4)
        
        y = self.get_y()
        x_offset = 15
        for card in cards:
            if os.path.exists(card):
                self.image(card, x=x_offset, y=y, w=30)
            x_offset += 35
        self.set_y(y + 45) # Height of card is approx 42mm

def gerar_manual():
    # A5 size
    pdf = ManualPDF(format='A5')
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()
    
    # Title
    pdf.set_font('PirataOne', '', 45)
    pdf.set_text_color(139, 26, 26)
    pdf.cell(0, 20, 'MANUAL DO CONTADOR', align='C', new_x='LMARGIN', new_y='NEXT')
    
    if pdf.has_cinzel:
        pdf.set_font('Cinzel', '', 14)
    else:
        pdf.set_font('helvetica', 'I', 12)
        
    pdf.set_text_color(79, 32, 21)
    pdf.cell(0, 10, 'A arte de contar histórias e vencer (feliz para sempre!)', align='C', new_x='LMARGIN', new_y='NEXT')
    pdf.ln(10)
    
    # Intro
    pdf.chapter_body(
        "Era uma vez... um grupo de amigos que se reuniu para contar a maior história de "
        "todos os tempos. Neste jogo colaborativo e competitivo, você e seus amigos criarão um "
        "conto de fadas juntos, mas apenas um de vocês terá a honra de dar o final feliz à história!"
    )
    
    # Objetivo
    pdf.chapter_title('1. O Objetivo')
    pdf.chapter_body(
        "Ser o primeiro jogador a se livrar de todas as suas Cartas de História, guiando a narrativa "
        "para que ela termine de forma lógica usando a sua carta de Final (Felizes Para Sempre)."
    )
    
    # Preparacao
    pdf.chapter_title('2. Preparação (Setup)')
    pdf.chapter_body("Separe as Cartas de Finais das Cartas de História e embaralhe ambos os montes separadamente. "
                     "A quantidade de cartas que cada jogador recebe depende do número de pessoas na mesa:")
    pdf.sub_title("Distribuição das Cartas:")
    pdf.chapter_body(
        "- 2 a 3 jogadores: 10 Cartas de História + 1 Final\n"
        "- 4 a 5 jogadores: 8 Cartas de História + 1 Final\n"
        "- 6+ jogadores: 6 Cartas de História + 1 Final"
    )
    pdf.chapter_body("A sua Carta de Final deve ser mantida em segredo! "
                     "O jogador com a barba mais comprida (ou quem tomou café por último) começa como o primeiro Narrador.")

    # Componentes
    pdf.add_page()
    pdf.chapter_title('3. As Cartas do Jogo')
    pdf.chapter_body(
        "O baralho é composto por Cartas de História (usadas para criar a narrativa) e Cartas de Finais "
        "(o seu objetivo secreto)."
    )
    
    cartas_dir = 'cartas_prontas'
    pdf.add_image_example(
        os.path.join(cartas_dir, 'A31.png'), 
        "Personagem & Lugar", 
        "Personagens vivem a história (Ex: Rei). Lugares são onde as coisas acontecem (Ex: Cidade, Floresta)."
    )
    pdf.add_image_example(
        os.path.join(cartas_dir, 'A09.png'), 
        "Coisa & Aspecto", 
        "Coisas são objetos importantes (Ex: Comida, Espada). Aspectos dão cor à história (Ex: Belo, Sombrio)."
    )
    pdf.add_page()
    pdf.add_image_example(
        os.path.join(cartas_dir, 'A01.png'), 
        "Evento", 
        "Ações, conflitos e reviravoltas na trama. Ex: Competição."
    )
    pdf.add_image_example(
        os.path.join(cartas_dir, 'A39.png'), 
        "Carta de Final (Felizes Para Sempre)", 
        "A carta que encerra o jogo. Você deve guardar essa carta em segredo e conduzir a história para que ela faça total sentido no final!"
    )
    
    # Regras de turno e encadeamento
    pdf.add_page()
    pdf.chapter_title('4. O Turno do Narrador')
    pdf.chapter_body(
        "O Narrador atual começa a inventar um conto de fadas. Sempre que ele mencionar algo que represente o conceito exato de uma de "
        "suas Cartas de História, ele coloca essa carta na mesa virada para cima.\n\n"
        "E O MAIS IMPORTANTE: O Narrador pode continuar jogando múltiplas cartas na mesa durante o seu turno! Ele não precisa "
        "parar na primeira carta. Se ninguém o interromper, ele pode encadear quantas cartas quiser, desde que conte uma "
        "história coesa e ininterrupta que ligue todos os elementos."
    )
    
    pdf.sub_title("Exemplo de Encadeamento:")
    exemplo_texto = (
        "\"O poderoso REI (A31) percebeu que seu povo estava faminto. Ele então ordenou que reunissem "
        "toda a COMIDA (A09) dos estoques e cavalgou depressa até a CIDADE (A24) mais próxima para distribuir.\""
    )
    pdf.add_story_example([
        os.path.join(cartas_dir, 'A31.png'),
        os.path.join(cartas_dir, 'A09.png'),
        os.path.join(cartas_dir, 'A24.png')
    ], exemplo_texto)
    
    pdf.chapter_body(
        "A REGRA DE OURO: A história deve fluir e fazer sentido! Jogar palavras soltas apressadamente só "
        "para descer as cartas na mesa é estritamente proibido e o jogador será penalizado."
    )
    
    # Puxando cartas
    pdf.add_page()
    pdf.sub_title("Quando comprar cartas?")
    pdf.chapter_body(
        "O Narrador pode decidir passar a vez voluntariamente caso não saiba como continuar a história. "
        "Neste caso, ele deve COMPRAR 1 CARTA DE HISTÓRIA do baralho. O jogador à esquerda assume como novo Narrador.\n"
        "Sempre que o Narrador atual for interrompido (ou travado pelos outros jogadores num desafio), ele também COMPRA 1 CARTA."
    )
    
    pdf.chapter_title('5. Como Roubar a Cena')
    pdf.chapter_body(
        "Enquanto o Narrador fala, qualquer outro jogador pode roubar o turno de duas formas:"
    )
    
    pdf.sub_title("1. Interrupção por Citação")
    pdf.chapter_body(
        "Se o Narrador disser uma palavra (ou conceito) idêntica à carta na sua mão, você a joga imediatamente na mesa "
        "e assume a história! O antigo Narrador compra 1 carta e passa a vez para você."
    )
    
    pdf.sub_title("2. Carta de Interrupção Especial")
    pdf.chapter_body(
        "Se você tem uma carta com o selo vermelho 'INTERRUPÇÃO', você pode jogá-la logo após o Narrador baixar "
        "uma carta do MESMO GRUPO (Personagem, Evento, etc). Exemplo: Ele baixa 'Rei'. Você joga uma Interrupção de Personagem. "
        "O Narrador antigo compra 1 carta."
    )
    
    pdf.add_page()
    pdf.chapter_title('6. O Fim (Felizes Para Sempre)')
    pdf.chapter_body(
        "Quando o Narrador consegue baixar a sua ÚLTIMA Carta de História, ele deve narrar uma conclusão natural que leve "
        "exatamente à frase escrita em seu 'Felizes Para Sempre', e baixá-la na mesa.\n"
        "Se a mesa concordar que fez sentido, ele VENCE O JOGO!\n"
        "Se for julgado sem sentido, ele recolhe a carta de Final, compra 1 Carta de História, e perde a vez."
    )
    
    output_path = 'manual_regras.pdf'
    pdf.output(output_path)
    print(f"Manual gerado com sucesso em: {output_path}")

if __name__ == "__main__":
    gerar_manual()
