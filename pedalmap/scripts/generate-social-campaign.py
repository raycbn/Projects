"""Generate PedalMap's August social campaign assets.

Inputs are the approved cinematic photographs under
public/social/campaign-august/raw. Outputs are ready-to-publish JPGs in
4:5 (feed), 1:1 carousel and 9:16 (Reel covers / video scenes).
"""

from __future__ import annotations

from pathlib import Path
from typing import Iterable

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
CAMPAIGN = ROOT / "public" / "social" / "campaign-august"
RAW = CAMPAIGN / "raw"
POSTS = CAMPAIGN / "posts"
CAROUSEL = CAMPAIGN / "carousel"
COVERS = CAMPAIGN / "reel-covers"
SCENES = CAMPAIGN / "reels" / "scenes"
LOGO = ROOT / "public" / "brand" / "pedalmap-logo-hq.png"

FOREST = "#0d3b2b"
FOREST_DARK = "#071d16"
SIGNAL = "#caff33"
MIST = "#edf5f1"
WHITE = "#ffffff"
STONE = "#b8c7c0"

FONT_REGULAR = "/usr/share/fonts/truetype/macos/Inter-Regular.ttf"
FONT_SEMIBOLD = "/usr/share/fonts/truetype/macos/Inter-SemiBold.ttf"
FONT_HEAVY = "/usr/share/fonts/truetype/jetbrains-mono/JetBrainsMono-ExtraBold.ttf"


def font(size: int, heavy: bool = False, semibold: bool = False) -> ImageFont.FreeTypeFont:
    path = FONT_HEAVY if heavy else FONT_SEMIBOLD if semibold else FONT_REGULAR
    return ImageFont.truetype(path, size=size)


def cover(image: Image.Image, size: tuple[int, int], focus_y: float = 0.5) -> Image.Image:
    image = image.convert("RGB")
    w, h = size
    scale = max(w / image.width, h / image.height)
    nw, nh = round(image.width * scale), round(image.height * scale)
    image = image.resize((nw, nh), Image.Resampling.LANCZOS)
    x = max(0, (nw - w) // 2)
    y = max(0, min(nh - h, round((nh - h) * focus_y)))
    return image.crop((x, y, x + w, y + h))


def gradient_overlay(image: Image.Image, top_alpha: int = 190, bottom_alpha: int = 205) -> Image.Image:
    layer = Image.new("RGBA", image.size, (0, 0, 0, 0))
    px = layer.load()
    height = image.height
    for y in range(height):
        p = y / max(1, height - 1)
        # Keep the whole headline area dark, then darken again for the CTA.
        edge = max(1 - p / 0.58, (p - 0.52) / 0.48, 0)
        alpha = int((top_alpha if p < 0.5 else bottom_alpha) * min(1, edge))
        for x in range(image.width):
            px[x, y] = (3, 24, 18, alpha)
    return Image.alpha_composite(image.convert("RGBA"), layer)


def rounded_rect(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], fill: str, radius: int = 28) -> None:
    draw.rounded_rectangle(box, radius=radius, fill=fill)


def wordmark(canvas: Image.Image, x: int, y: int, dark: bool = False, scale: float = 1.0) -> None:
    icon_size = round(74 * scale)
    icon = Image.open(LOGO).convert("RGBA").resize((icon_size, icon_size), Image.Resampling.LANCZOS)
    canvas.alpha_composite(icon, (x, y))
    draw = ImageDraw.Draw(canvas)
    color = FOREST if dark else WHITE
    draw.text(
        (x + icon_size + round(18 * scale), y + round(5 * scale)),
        "PedalMap",
        fill=color,
        font=font(round(42 * scale), semibold=True),
    )


def tracking_text(
    draw: ImageDraw.ImageDraw,
    xy: tuple[int, int],
    text: str,
    fnt: ImageFont.FreeTypeFont,
    fill: str,
    spacing: int = 5,
) -> None:
    x, y = xy
    for char in text:
        draw.text((x, y), char, font=fnt, fill=fill)
        x += round(draw.textlength(char, font=fnt)) + spacing


def fit_lines(
    draw: ImageDraw.ImageDraw,
    lines: Iterable[str],
    max_width: int,
    start_size: int,
    min_size: int = 48,
) -> ImageFont.FreeTypeFont:
    for size in range(start_size, min_size - 1, -2):
        candidate = font(size, heavy=True)
        if max(draw.textlength(line, font=candidate) for line in lines) <= max_width:
            return candidate
    return font(min_size, heavy=True)


def headline(
    draw: ImageDraw.ImageDraw,
    lines: list[str],
    x: int,
    y: int,
    max_width: int,
    start_size: int,
    accent_line: int | None = None,
    line_gap: float = 0.88,
) -> int:
    fnt = fit_lines(draw, lines, max_width, start_size)
    step = round(fnt.size * line_gap)
    for index, line in enumerate(lines):
        draw.text((x, y), line, font=fnt, fill=SIGNAL if index == accent_line else WHITE)
        y += step
    return y


def add_footer(canvas: Image.Image, cta: str = "PLANIFICA GRATIS", url: str = "pedalmap.es") -> None:
    draw = ImageDraw.Draw(canvas)
    w, h = canvas.size
    pill_w, pill_h = min(520, w - 128), 74
    y = h - 126
    rounded_rect(draw, (64, y, 64 + pill_w, y + pill_h), SIGNAL, 30)
    draw.text((94, y + 18), cta, font=font(25, semibold=True), fill=FOREST_DARK)
    url_w = draw.textlength(url, font=font(27, semibold=True))
    draw.text((w - 64 - url_w, y + 20), url, font=font(27, semibold=True), fill=WHITE)


def save_jpg(image: Image.Image, path: Path, quality: int = 94) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.convert("RGB").save(path, "JPEG", quality=quality, optimize=True, progressive=True)
    print(path.relative_to(ROOT))


def photo_post(
    source: str,
    output: str,
    lines: list[str],
    kicker: str,
    subtitle: str,
    accent_line: int | None = None,
    focus_y: float = 0.5,
) -> None:
    canvas = cover(Image.open(RAW / source), (1080, 1350), focus_y)
    canvas = gradient_overlay(canvas, 210, 225)
    wordmark(canvas, 64, 52)
    draw = ImageDraw.Draw(canvas)
    tracking_text(draw, (66, 173), kicker.upper(), font(20, semibold=True), SIGNAL, 4)
    y = headline(draw, lines, 64, 225, 952, 78, accent_line)
    draw.multiline_text(
        (66, y + 22),
        subtitle,
        fill=WHITE,
        font=font(28, semibold=True),
        spacing=8,
    )
    add_footer(canvas)
    save_jpg(canvas, POSTS / output)


def solid_slide(
    output: str,
    index: str,
    lines: list[str],
    subtitle: str,
    accent_line: int | None = None,
) -> None:
    canvas = Image.new("RGBA", (1080, 1080), FOREST_DARK)
    draw = ImageDraw.Draw(canvas)
    # Editorial route line.
    draw.line([(720, -40), (620, 260), (840, 520), (700, 850), (920, 1120)], fill=FOREST, width=94)
    for x, y in [(620, 260), (840, 520), (700, 850)]:
        draw.ellipse((x - 15, y - 15, x + 15, y + 15), fill=SIGNAL)
    wordmark(canvas, 64, 54)
    tracking_text(draw, (66, 170), index, font(24, semibold=True), SIGNAL, 5)
    y = headline(draw, lines, 64, 245, 900, 82, accent_line)
    draw.multiline_text((68, y + 34), subtitle, fill=STONE, font=font(30), spacing=10)
    draw.text((66, 998), "DESLIZA  →", fill=SIGNAL, font=font(22, semibold=True))
    save_jpg(canvas, CAROUSEL / output)


def photo_slide(
    source: str,
    output: str,
    index: str,
    lines: list[str],
    subtitle: str,
    focus_y: float = 0.5,
) -> None:
    canvas = cover(Image.open(RAW / source), (1080, 1080), focus_y)
    canvas = gradient_overlay(canvas, 210, 230)
    wordmark(canvas, 64, 54)
    draw = ImageDraw.Draw(canvas)
    tracking_text(draw, (66, 172), index, font(22, semibold=True), SIGNAL, 4)
    y = headline(draw, lines, 64, 236, 930, 72, 1 if len(lines) > 1 else None)
    draw.multiline_text((68, y + 28), subtitle, fill=WHITE, font=font(29, semibold=True), spacing=8)
    draw.text((66, 998), "DESLIZA  →", fill=SIGNAL, font=font(22, semibold=True))
    save_jpg(canvas, CAROUSEL / output)


def reel_scene(
    folder: str,
    number: int,
    source: str | None,
    lines: list[str],
    subtitle: str = "",
    accent_line: int | None = None,
    cta: bool = False,
    focus_y: float = 0.5,
) -> None:
    if source:
        canvas = cover(Image.open(RAW / source), (1080, 1920), focus_y)
        canvas = gradient_overlay(canvas, 215, 235)
    else:
        canvas = Image.new("RGBA", (1080, 1920), FOREST_DARK)
        draw = ImageDraw.Draw(canvas)
        draw.line([(160, 1920), (380, 1410), (270, 1030), (720, 650), (820, -60)], fill=FOREST, width=130)
        for x, y in [(380, 1410), (270, 1030), (720, 650)]:
            draw.ellipse((x - 18, y - 18, x + 18, y + 18), fill=SIGNAL)
    wordmark(canvas, 66, 86, scale=1.05)
    draw = ImageDraw.Draw(canvas)
    y = headline(draw, lines, 66, 300, 948, 100, accent_line, 0.94)
    if subtitle:
        draw.multiline_text((70, y + 44), subtitle, fill=WHITE, font=font(34, semibold=True), spacing=12)
    if cta:
        # Reels reserve roughly the lower 25% for handle/caption/audio UI.
        rounded_rect(draw, (66, 1240, 660, 1338), SIGNAL, 36)
        draw.text((108, 1267), "CREA TU RUTA GRATIS", fill=FOREST_DARK, font=font(29, semibold=True))
        draw.text((70, 1375), "pedalmap.es", fill=WHITE, font=font(42, semibold=True))
    save_jpg(canvas, SCENES / folder / f"{number:02d}.jpg", 93)


def main() -> None:
    for directory in (POSTS, CAROUSEL, COVERS, SCENES):
        directory.mkdir(parents=True, exist_ok=True)

    photo_post(
        "pedalmap-ad-road-dawn.png",
        "01-tu-proxima-ruta.jpg",
        ["TU PRÓXIMA", "RUTA EMPIEZA", "ANTES DE SALIR."],
        "PedalMap · Campaña 01",
        "Mapa · desnivel · viento · superficie · GPX",
        accent_line=2,
        focus_y=0.42,
    )
    photo_post(
        "pedalmap-ad-gravel-wind.png",
        "02-el-viento-se-planifica.jpg",
        ["EL VIENTO", "NO SE ADIVINA.", "SE PLANIFICA."],
        "Viento real sobre tu ruta",
        "Comprueba cara, cola y la mejor hora para rodar.",
        accent_line=2,
        focus_y=0.35,
    )
    photo_post(
        "pedalmap-ad-gps-closeup.png",
        "03-de-pedalmap-a-tu-gps.jpg",
        ["PLANEA AQUÍ.", "RUEDA CON", "TU GPS."],
        "GPX para Garmin · Wahoo · móvil",
        "Tu track, listo para salir.",
        accent_line=2,
        focus_y=0.5,
    )
    photo_post(
        "pedalmap-ad-grupeta.png",
        "04-toda-la-grupeta.jpg",
        ["UNA RUTA.", "TODA LA", "GRUPETA."],
        "Pack Grupeta · 4 plazas Premium",
        "Planificad juntos. Rodad mejor.",
        accent_line=2,
        focus_y=0.42,
    )

    solid_slide(
        "01-cover.jpg",
        "GUÍA RÁPIDA · 01/05",
        ["3 COSAS QUE", "MIRAR ANTES", "DE SALIR"],
        "Guárdalo para tu próxima ruta.",
        2,
    )
    photo_slide(
        "pedalmap-ad-road-dawn.png",
        "02-desnivel.jpg",
        "01 · DESNIVEL",
        ["LOS KM", "ENGAÑAN."],
        "Los metros positivos te dicen\ncómo será de verdad la salida.",
        focus_y=0.4,
    )
    photo_slide(
        "pedalmap-ad-gravel-wind.png",
        "03-viento.jpg",
        "02 · VIENTO",
        ["CARA, COLA", "O LATERAL."],
        "Mira el viento sobre cada tramo\ny elige la mejor hora.",
        focus_y=0.36,
    )
    photo_slide(
        "pedalmap-ad-grupeta.png",
        "04-superficie.jpg",
        "03 · SUPERFICIE",
        ["TU BICI", "MANDA."],
        "Carretera, gravel o MTB:\nno deberían recibir la misma ruta.",
        focus_y=0.5,
    )
    solid_slide(
        "05-cta.jpg",
        "PEDALMAP · 05/05",
        ["PLANIFICA UNA VEZ.", "DISFRUTA TODA", "LA RUTA."],
        "Gratis para empezar → pedalmap.es",
        2,
    )

    # Three reel covers.
    for source, output, lines, accent, subtitle in [
        (
            "pedalmap-ad-road-dawn.png",
            "reel-01-antes-de-salir.jpg",
            ["NO ES SOLO", "EL MAPA."],
            1,
            "Es saber qué te espera.",
        ),
        (
            "pedalmap-ad-gravel-wind.png",
            "reel-02-viento.jpg",
            ["¿VIENTO", "DE CARA?"],
            1,
            "Entérate antes de salir.",
        ),
        (
            "pedalmap-ad-gps-closeup.png",
            "reel-03-gpx.jpg",
            ["GPX LISTO.", "CASCO PUESTO."],
            0,
            "Garmin · Wahoo · móvil",
        ),
    ]:
        reel_scene("covers", 1, source, lines, subtitle, accent, True)
        generated = SCENES / "covers" / "01.jpg"
        (COVERS / output).write_bytes(generated.read_bytes())

    # Reel 1: brand/product promise.
    reel_scene("reel-01-antes-de-salir", 1, "pedalmap-ad-road-dawn.png", ["LA RUTA", "EMPIEZA ANTES", "DE SALIR."], accent_line=2)
    reel_scene("reel-01-antes-de-salir", 2, None, ["DISTANCIA.", "DESNIVEL.", "SUPERFICIE."], "Todo en una sola ruta.", 1)
    reel_scene("reel-01-antes-de-salir", 3, "pedalmap-ad-gravel-wind.png", ["Y EL VIENTO", "TRAMO A TRAMO."], "Cara · cola · lateral", 1)
    reel_scene("reel-01-antes-de-salir", 4, "pedalmap-ad-gps-closeup.png", ["GPX LISTO", "PARA TU GPS."], "Garmin · Wahoo · móvil", 0)
    reel_scene("reel-01-antes-de-salir", 5, "pedalmap-ad-road-dawn.png", ["PLANIFICA.", "LUEGO RUEDA."], "PedalMap · Hecho en España", 1, True)

    # Reel 2: wind hook.
    reel_scene("reel-02-viento", 1, "pedalmap-ad-gravel-wind.png", ["¿VIENTO", "DE CARA?"], "No te enteres cuando ya duele.", 1)
    reel_scene("reel-02-viento", 2, None, ["PEDALMAP CRUZA", "EL VIENTO CON", "TU DIRECCIÓN."], accent_line=2)
    reel_scene("reel-02-viento", 3, "pedalmap-ad-gravel-wind.png", ["CARA.", "COLA.", "LATERAL."], "Sobre la línea de tu ruta.", 1)
    reel_scene("reel-02-viento", 4, "pedalmap-ad-road-dawn.png", ["ELIGE", "LA MEJOR HORA."], "Y sal con el viento a favor.", 1)
    reel_scene("reel-02-viento", 5, "pedalmap-ad-gravel-wind.png", ["MIRA EL VIENTO", "ANTES DE SALIR."], "Gratis para empezar", 1, True)

    # Reel 3: GPX / device.
    reel_scene("reel-03-gpx", 1, "pedalmap-ad-gps-closeup.png", ["TU RUTA.", "TU GPS."], "Sin vueltas.", 1)
    reel_scene("reel-03-gpx", 2, None, ["1. PLANIFICA", "2. REVISA", "3. EXPORTA"], "Mapa · desnivel · viento · GPX", 2)
    reel_scene(
        "reel-03-gpx",
        3,
        "pedalmap-ad-road-dawn.png",
        ["UN TRACK", "QUE QUIERES", "RODAR"],
        accent_line=None,
    )
    reel_scene("reel-03-gpx", 4, "pedalmap-ad-gps-closeup.png", ["GARMIN.", "WAHOO.", "MÓVIL."], "El mismo GPX.", 1)
    reel_scene("reel-03-gpx", 5, "pedalmap-ad-gps-closeup.png", ["GPX LISTO.", "CASCO PUESTO."], "PedalMap", 0, True)


if __name__ == "__main__":
    main()
