"""
Módulo compartilhado de carregamento de modelos de geração de imagens.

O SDXL Lightning requer uma sequência de carregamento não trivial (UNet externo +
scheduler customizado), por isso este módulo centraliza essa lógica evitando
duplicação entre gerar_imagens.py, gerar_templates_xl.py e comparar_modelos.py.

As otimizações de memória (cpu_offload, vae_tiling, vae_slicing) são fornecidas
nativamente pelo diffusers e aplicadas aqui de forma consistente para a RTX 3050 Ti
(4GB VRAM).
"""
import warnings
from functools import lru_cache
import torch
from diffusers import StableDiffusionXLPipeline, UNet2DConditionModel, EulerDiscreteScheduler, DPMSolverMultistepScheduler
from diffusers import StableDiffusionPipeline
from transformers import CLIPTokenizer
from huggingface_hub import hf_hub_download
from safetensors.torch import load_file

# Suprime warnings internos do diffusers/huggingface_hub sobre argumentos deprecated
# que são chamados por from_pretrained (fora do nosso controle)
warnings.filterwarnings("ignore", message=".*local_dir_use_symlinks.*", category=UserWarning)
warnings.filterwarnings("ignore", message=".*upcast_vae.*", category=FutureWarning)

# Configurações canônicas do projeto
SDXL_BASE = "stabilityai/stable-diffusion-xl-base-1.0"
LIGHTNING_REPO = "ByteDance/SDXL-Lightning"
LIGHTNING_CKPT = "sdxl_lightning_4step_unet.safetensors"

# Resolução de produção: proporção 5:7, nativa para SDXL (sem distorções)
CARD_W = 768
CARD_H = 1024

# Passos e guidance do Lightning (fixos — alterar quebra a qualidade)
LIGHTNING_STEPS = 4
LIGHTNING_GUIDANCE = 0.0
PRODUCTION_STEPS = LIGHTNING_STEPS
PRODUCTION_GUIDANCE = LIGHTNING_GUIDANCE

# Com guidance_scale=0 no SDXL Lightning, o negative prompt tem efeito mínimo.
# O controle de estilo é feito exclusivamente pelo positive prompt.
# "matte" e "textured paper" são sinais fortes de mídia plana/2D que o SDXL reconhece bem.
ILLUSTRATION_STYLE_BOOST = "fairytale storybook watercolor illustration, detailed, magical atmosphere, no text"
ILLUSTRATION_NEGATIVE_PROMPT = (
    "text, watermark, signature, low quality, blurry, cropped, modern clothes, urban, city, car, technology"
)
CLIP_MAX_TOKENS = 77


@lru_cache(maxsize=1)
def get_sdxl_tokenizers() -> tuple[CLIPTokenizer, CLIPTokenizer]:
    tokenizer = CLIPTokenizer.from_pretrained(SDXL_BASE, subfolder="tokenizer", local_files_only=True)
    tokenizer_2 = CLIPTokenizer.from_pretrained(SDXL_BASE, subfolder="tokenizer_2", local_files_only=True)
    tokenizer.model_max_length = 10_000
    tokenizer_2.model_max_length = 10_000
    return tokenizer, tokenizer_2


def prompt_token_length(prompt: str) -> int:
    tokenizer, tokenizer_2 = get_sdxl_tokenizers()
    return max(len(tokenizer.tokenize(prompt)) + 2, len(tokenizer_2.tokenize(prompt)) + 2)


def build_illustration_prompt(base_prompt: str) -> str:
    prompt = f"{base_prompt}, {ILLUSTRATION_STYLE_BOOST}"
    if prompt_token_length(prompt) <= CLIP_MAX_TOKENS:
        return prompt

    clauses = [clause.strip() for clause in base_prompt.split(",") if clause.strip()]
    while len(clauses) > 1:
        clauses.pop()
        prompt = f"{', '.join(clauses)}, {ILLUSTRATION_STYLE_BOOST}"
        if prompt_token_length(prompt) <= CLIP_MAX_TOKENS:
            return prompt

    return f"{clauses[0]}, {ILLUSTRATION_STYLE_BOOST}"


def load_sdxl_lightning() -> StableDiffusionXLPipeline:
    """
    Carrega o pipeline SDXL Lightning (4-step UNet) otimizado para 4GB VRAM.

    Sequência de carregamento:
    1. Instancia o UNet a partir da config do SDXL base
    2. Substitui os pesos pelo checkpoint Lightning (via safetensors)
    3. Cria o pipeline SDXL com o UNet modificado
    4. Configura o scheduler EulerDiscrete com timestep_spacing="trailing"
       (obrigatório para o Lightning)
    5. Aplica otimizações de memória do diffusers

    Returns:
        StableDiffusionXLPipeline pronto para uso, sem necessidade de .to("cuda")
        (o cpu_offload gerencia isso automaticamente).
    """
    offline = True
    try:
        UNet2DConditionModel.load_config(SDXL_BASE, subfolder="unet", local_files_only=True)
    except Exception:
        offline = False

    if offline:
        print("Carregando SDXL Lightning do cache local...")
    else:
        print("Carregando SDXL Lightning (primeira execução — ~6GB de download)...")

    unet_config = UNet2DConditionModel.load_config(SDXL_BASE, subfolder="unet", local_files_only=offline)
    unet = UNet2DConditionModel.from_config(unet_config).to("cuda", torch.float16)
    unet.load_state_dict(load_file(hf_hub_download(LIGHTNING_REPO, LIGHTNING_CKPT, local_files_only=offline), device="cuda"))

    pipe = StableDiffusionXLPipeline.from_pretrained(
        SDXL_BASE,
        unet=unet,
        torch_dtype=torch.float16,
        variant="fp16",
        local_files_only=offline,
    )
    pipe.scheduler = EulerDiscreteScheduler.from_config(
        pipe.scheduler.config,
        timestep_spacing="trailing",
    )
    if pipe.tokenizer is not None:
        pipe.tokenizer.clean_up_tokenization_spaces = False
    if getattr(pipe, "tokenizer_2", None) is not None:
        pipe.tokenizer_2.clean_up_tokenization_spaces = False

    # Otimizações de memória — necessárias para 4GB VRAM com SDXL
    # Ordem importa: tiling/slicing antes do cpu_offload,
    # pois os hooks de offload não propagam .to() corretamente após instalados.
    pipe.vae.enable_tiling()          # decodifica o VAE em tiles (evita OOM)
    pipe.vae.enable_slicing()         # processa imagens em lotes de 1 (segurança extra)
    pipe.enable_model_cpu_offload()   # move componentes para CPU quando ociosos
    # O mecanismo upcast_vae interno do diffusers faz o cast float32 só durante o decode,
    # garantindo compatibilidade com os latentes float16 do UNet. O FutureWarning é suprimido acima.

    print("SDXL Lightning pronto.")
    return pipe


def load_dreamshaper8() -> StableDiffusionPipeline:
    """
    Carrega o DreamShaper 8 (SD 1.5) para uso em testes comparativos.

    Nota: Resolução máxima confiável é 512x512. Para Poker Size (768x1024)
    é necessário redimensionar a imagem após a geração (qualidade inferior ao SDXL).
    Mantido apenas para referência histórica nos testes de comparação.

    Returns:
        StableDiffusionPipeline pronto para uso em CUDA.
    """
    print("Carregando DreamShaper 8 (SD 1.5)...")

    pipe = StableDiffusionPipeline.from_pretrained(
        "lykon/dreamshaper-8",
        torch_dtype=torch.float16,
        safety_checker=None,
        requires_safety_checker=False,
    ).to("cuda")
    pipe.enable_attention_slicing()

    try:
        pipe.enable_xformers_memory_efficient_attention()
        print("xformers habilitado.")
    except Exception:
        print("xformers não disponível, usando attention slicing padrão.")

    print("DreamShaper 8 pronto.")
    return pipe
