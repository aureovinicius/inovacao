#!/usr/bin/env python3
# Emoldura capturas de tela para a Google Play no tema do "Painel da Copa · 2026".
#
# COMO USAR (no seu PC, onde estão as capturas):
#   1. Instale o Pillow:      pip install Pillow
#   2. Coloque suas capturas em  store/shots/raw/  nomeadas em ordem:
#        01.png 02.png 03.png 04.png 05.png
#      (a ordem define qual legenda cada uma recebe — veja CAPTIONS abaixo)
#   3. Rode:                   python store/frame-screenshots.py
#   4. As versões prontas saem em  store/shots/framed/  (1080×1920, 9:16)
#
# Ajuste os textos em CAPTIONS para casar com a ordem das suas imagens.
# Se tiver mais/menos imagens, é só editar a lista.

import os, glob
from PIL import Image, ImageDraw, ImageFont, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, "shots", "raw")
OUT = os.path.join(HERE, "shots", "framed")
os.makedirs(OUT, exist_ok=True)

# Legendas por imagem, na ordem dos arquivos (01, 02, 03, ...).
CAPTIONS = [
    "Tudo da Copa num só painel",
    "Probabilidades por um modelo próprio",
    "Classificação dos 12 grupos",
    "Resumo diário das notícias por IA",
    "Calendário completo, filtro por fase",
]

# Tela final (proporção 9:16 aceita pela Play).
W, H = 1080, 1920
BG_TOP, BG_BOT = (12, 17, 24), (16, 26, 43)        # tema do app
GREEN = (90, 209, 127)
TEXT = (233, 238, 245)

# Fontes: tenta DejaVu (Linux); cai para a fonte padrão se não achar.
def load_font(size, bold=True):
    candidates = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold
        else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/Library/Fonts/Arial Bold.ttf" if bold else "/Library/Fonts/Arial.ttf",
        "C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf",
    ]
    for c in candidates:
        if os.path.exists(c):
            return ImageFont.truetype(c, size)
    return ImageFont.load_default()

def gradient_bg():
    top = Image.new("RGB", (W, H), BG_TOP)
    bot = Image.new("RGB", (W, H), BG_BOT)
    mask = Image.new("L", (W, H)); md = mask.load()
    for y in range(H):
        v = int(255 * (y / H) ** 1.2)
        for x in range(W):
            md[x, y] = v
    bg = Image.composite(bot, top, mask).convert("RGBA")
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(glow).ellipse([W//2-360, -200, W//2+360, 520], fill=(31, 157, 85, 90))
    glow = glow.filter(ImageFilter.GaussianBlur(120))
    return Image.alpha_composite(bg, glow)

def wrap(draw, text, font, max_w):
    words, lines, cur = text.split(), [], ""
    for w in words:
        t = (cur + " " + w).strip()
        if draw.textlength(t, font=font) <= max_w:
            cur = t
        else:
            lines.append(cur); cur = w
    if cur:
        lines.append(cur)
    return lines

def rounded(img, radius):
    mask = Image.new("L", img.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, img.size[0], img.size[1]], radius=radius, fill=255)
    out = img.convert("RGBA")
    out.putalpha(mask)
    return out

def frame(shot_path, caption, out_path):
    bg = gradient_bg()
    draw = ImageDraw.Draw(bg)

    # Legenda (auto-ajuste + quebra de linha)
    margin = 80
    size = 64
    while size > 30:
        f = load_font(size, bold=True)
        lines = wrap(draw, caption, f, W - 2*margin)
        if len(lines) <= 2:
            break
        size -= 4
    y = 96
    for ln in lines:
        tw = draw.textlength(ln, font=f)
        draw.text(((W - tw) / 2, y), ln, font=f, fill=TEXT)
        y += f.size + 8
    # acento verde
    draw.rounded_rectangle([(W-96)//2, y + 14, (W+96)//2, y + 22], radius=4, fill=GREEN)

    cap_bottom = y + 60

    # Screenshot dentro de uma "moldura" arredondada
    shot = Image.open(shot_path).convert("RGBA")
    avail_w = W - 2*150
    avail_h = H - cap_bottom - 90
    scale = min(avail_w / shot.width, avail_h / shot.height)
    sw, sh = int(shot.width * scale), int(shot.height * scale)
    shot = shot.resize((sw, sh), Image.LANCZOS)
    shot = rounded(shot, 40)

    sx = (W - sw) // 2
    sy = cap_bottom + (avail_h - sh) // 2

    # sombra
    shadow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle([sx, sy+16, sx+sw, sy+sh+16], radius=40, fill=(0, 0, 0, 150))
    shadow = shadow.filter(ImageFilter.GaussianBlur(30))
    bg = Image.alpha_composite(bg, shadow)
    # borda sutil
    ImageDraw.Draw(bg).rounded_rectangle([sx-2, sy-2, sx+sw+2, sy+sh+2], radius=42, outline=(40, 56, 80, 255), width=3)
    bg.alpha_composite(shot, (sx, sy))

    bg.convert("RGB").save(out_path, "PNG")
    print("✓", os.path.basename(out_path))

def main():
    files = sorted(glob.glob(os.path.join(RAW, "*.png")) + glob.glob(os.path.join(RAW, "*.jpg")))
    if not files:
        print(f"Coloque suas capturas em {RAW}/ (01.png, 02.png, ...) e rode de novo.")
        return
    for i, fp in enumerate(files):
        cap = CAPTIONS[i] if i < len(CAPTIONS) else ""
        frame(fp, cap, os.path.join(OUT, f"{i+1:02d}-framed.png"))
    print(f"\nProntas em {OUT}/")

if __name__ == "__main__":
    main()
