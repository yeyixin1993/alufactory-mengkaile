#!/usr/bin/env python3
"""Generate local JPG placeholders for catalog products.

Existing JPG files are left untouched unless --force is supplied, so running the
script after real product photos have been installed cannot overwrite them by
accident.
"""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "public" / "images" / "catalog"
FONT_PATH = "/System/Library/Fonts/STHeiti Medium.ttc"
WIDTH = 400
HEIGHT = 300

PLACEHOLDERS = (
    ("pegboard.jpg", "铝合金洞洞板", (37, 99, 235)),
    ("cabinet-door.jpg", "铝框门", (14, 116, 144)),
    ("art-frame.jpg", "相框", (124, 58, 237)),
    ("aluminum-plate.jpg", "铝板", (71, 85, 105)),
    ("marine-board.jpg", "俄罗斯全进口BBB海洋板", (180, 83, 9)),
    ("calligraphy-cabinet.jpg", "宜家舒法特柜子", (190, 24, 93)),
    ("wardrobe.jpg", "衣柜", (5, 150, 105)),
)


def font(size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(FONT_PATH, size)


def fitted_font(draw: ImageDraw.ImageDraw, text: str, max_width: int) -> ImageFont.FreeTypeFont:
    for size in range(34, 19, -1):
        candidate = font(size)
        if draw.textbbox((0, 0), text, font=candidate)[2] <= max_width:
            return candidate
    return font(19)


def create_placeholder(filename: str, label: str, accent: tuple[int, int, int]) -> Image.Image:
    image = Image.new("RGB", (WIDTH, HEIGHT), (248, 250, 252))
    draw = ImageDraw.Draw(image)

    # Colored header and a clearly placeholder-like working area.
    draw.rectangle((0, 0, WIDTH, 72), fill=accent)
    draw.rounded_rectangle(
        (32, 96, WIDTH - 32, HEIGHT - 30),
        radius=18,
        fill=(255, 255, 255),
        outline=(203, 213, 225),
        width=3,
    )

    title_font = fitted_font(draw, label, WIDTH - 48)
    title_box = draw.textbbox((0, 0), label, font=title_font)
    title_width = title_box[2] - title_box[0]
    draw.text(((WIDTH - title_width) / 2, 18), label, font=title_font, fill=(255, 255, 255))

    photo_font = font(25)
    photo_text = "产品图片占位"
    photo_box = draw.textbbox((0, 0), photo_text, font=photo_font)
    draw.text(
        ((WIDTH - (photo_box[2] - photo_box[0])) / 2, 126),
        photo_text,
        font=photo_font,
        fill=(51, 65, 85),
    )

    hint_font = font(15)
    hint = "请用同名 JPG 覆盖此文件"
    hint_box = draw.textbbox((0, 0), hint, font=hint_font)
    draw.text(
        ((WIDTH - (hint_box[2] - hint_box[0])) / 2, 176),
        hint,
        font=hint_font,
        fill=(100, 116, 139),
    )

    filename_font = font(13)
    filename_box = draw.textbbox((0, 0), filename, font=filename_font)
    draw.text(
        ((WIDTH - (filename_box[2] - filename_box[0])) / 2, 226),
        filename,
        font=filename_font,
        fill=accent,
    )
    return image


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--force", action="store_true", help="overwrite existing JPG files")
    args = parser.parse_args()

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    for filename, label, accent in PLACEHOLDERS:
        output = OUTPUT_DIR / filename
        if output.exists() and not args.force:
            print(f"skip existing: {output.relative_to(ROOT)}")
            continue
        create_placeholder(filename, label, accent).save(
            output,
            format="JPEG",
            quality=90,
            optimize=True,
            progressive=True,
        )
        print(f"created: {output.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
