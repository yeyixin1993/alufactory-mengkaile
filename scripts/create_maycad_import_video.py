#!/usr/bin/env python3
"""Create the MayCAD .scene import walkthrough video from verified UI captures."""

from __future__ import annotations

import math
import subprocess
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
FRAME_DIR = ROOT / "docs" / "media" / "maycad-import-video" / "frames"
OUTPUT = ROOT / "docs" / "media" / "maycad-scene-import-guide-cn.mp4"
WIDTH, HEIGHT = 1920, 1080
FPS = 30
FONT_REGULAR = "/System/Library/Fonts/STHeiti Light.ttc"
FONT_BOLD = "/System/Library/Fonts/STHeiti Medium.ttc"


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(FONT_BOLD if bold else FONT_REGULAR, size)


def cover(image: Image.Image, width: int = WIDTH, height: int = HEIGHT) -> Image.Image:
    scale = max(width / image.width, height / image.height)
    resized = image.resize((round(image.width * scale), round(image.height * scale)), Image.Resampling.LANCZOS)
    left = (resized.width - width) // 2
    top = (resized.height - height) // 2
    return resized.crop((left, top, left + width, top + height)).convert("RGB")


def load_capture(name: str) -> Image.Image:
    return cover(Image.open(FRAME_DIR / name))


def rounded(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], radius: int, fill, outline=None, width: int = 1) -> None:
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def centered(draw: ImageDraw.ImageDraw, text: str, y: int, text_font: ImageFont.FreeTypeFont, fill, max_width: int | None = None) -> None:
    if max_width and draw.textlength(text, font=text_font) > max_width:
        while text_font.size > 18 and draw.textlength(text, font=text_font) > max_width:
            text_font = font(text_font.size - 2, text_font.path == FONT_BOLD)
    bbox = draw.textbbox((0, 0), text, font=text_font)
    draw.text(((WIDTH - (bbox[2] - bbox[0])) / 2, y), text, font=text_font, fill=fill)


def arrow(draw: ImageDraw.ImageDraw, start: tuple[int, int], end: tuple[int, int], color=(37, 99, 235, 255), width: int = 14) -> None:
    draw.line((start, end), fill=color, width=width)
    angle = math.atan2(end[1] - start[1], end[0] - start[0])
    head = 34
    spread = 0.62
    p1 = (end[0] - head * math.cos(angle - spread), end[1] - head * math.sin(angle - spread))
    p2 = (end[0] - head * math.cos(angle + spread), end[1] - head * math.sin(angle + spread))
    draw.polygon((end, p1, p2), fill=color)


def click_target(draw: ImageDraw.ImageDraw, center: tuple[int, int], color=(37, 99, 235, 255)) -> None:
    for radius, alpha, width in ((42, 90, 8), (27, 170, 7), (10, 255, 0)):
        fill = color[:3] + (alpha,) if width == 0 else None
        draw.ellipse(
            (center[0] - radius, center[1] - radius, center[0] + radius, center[1] + radius),
            fill=fill,
            outline=color[:3] + (alpha,),
            width=max(1, width),
        )


def caption(image: Image.Image, step: str, title: str, detail: str) -> Image.Image:
    result = image.convert("RGBA")
    overlay = Image.new("RGBA", result.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    rounded(draw, (55, 852, 1865, 1035), 34, (10, 20, 42, 238), outline=(255, 255, 255, 50), width=2)
    rounded(draw, (88, 890, 246, 993), 28, (37, 99, 235, 255))
    draw.text((167, 914), step, anchor="mm", font=font(34, True), fill="white")
    draw.text((282, 881), title, font=font(42, True), fill="white")
    draw.text((284, 946), detail, font=font(26), fill=(194, 210, 235, 255))
    return Image.alpha_composite(result, overlay).convert("RGB")


def intro_card() -> Image.Image:
    image = Image.new("RGB", (WIDTH, HEIGHT), "#07152f")
    pixels = image.load()
    for y in range(HEIGHT):
        for x in range(WIDTH):
            glow = max(0.0, 1.0 - math.hypot(x - 1420, y - 300) / 1100)
            pixels[x, y] = (
                round(7 + glow * 20),
                round(21 + glow * 70),
                round(47 + glow * 135),
            )
    draw = ImageDraw.Draw(image, "RGBA")
    for radius, alpha in ((360, 18), (250, 24), (140, 30)):
        draw.ellipse((1420 - radius, 300 - radius, 1420 + radius, 300 + radius), outline=(96, 165, 250, alpha), width=3)
    rounded(draw, (130, 120, 420, 188), 32, (37, 99, 235, 255))
    draw.text((275, 154), "萌开了 3D 设计器", anchor="mm", font=font(27, True), fill="white")
    draw.text((130, 290), "MayCAD .scene", font=font(82, True), fill="white")
    draw.text((130, 405), "一键导入全过程", font=font(82, True), fill=(110, 181, 255))
    draw.text((135, 555), "无需 AI  ·  型号精准匹配  ·  孔位可继续编辑", font=font(36), fill=(205, 222, 247))
    rounded(draw, (130, 720, 745, 830), 30, (255, 255, 255, 18), outline=(255, 255, 255, 50), width=2)
    draw.text((180, 755), "演示文件", font=font(24, True), fill=(119, 181, 255))
    draw.text((180, 795), "clothing_rack_2020_v2.scene", font=font(29, True), fill="white")
    draw.text((130, 950), "mengkaile.top", font=font(28, True), fill=(151, 181, 222))
    return image


def step_one() -> Image.Image:
    image = load_capture("01-designer-empty.png")
    draw = ImageDraw.Draw(image, "RGBA")
    rounded(draw, (1675, 16, 1900, 116), 24, (37, 99, 235, 38), outline=(37, 99, 235, 255), width=7)
    arrow(draw, (1500, 230), (1785, 98))
    click_target(draw, (1785, 70))
    return caption(image, "01", "打开 3D 设计器，点击「导入 MayCAD」", "文件选择器默认只显示 MayCAD 导出的 .scene 文件")


def step_two() -> Image.Image:
    background = load_capture("01-designer-empty.png").filter(ImageFilter.GaussianBlur(5)).convert("RGBA")
    veil = Image.new("RGBA", background.size, (5, 15, 35, 110))
    image = Image.alpha_composite(background, veil)
    draw = ImageDraw.Draw(image, "RGBA")
    rounded(draw, (460, 210, 1460, 725), 38, (255, 255, 255, 250), outline=(255, 255, 255, 255), width=2)
    rounded(draw, (520, 275, 1400, 550), 26, (244, 248, 255, 255), outline=(155, 190, 242, 255), width=3)
    rounded(draw, (570, 325, 690, 445), 26, (37, 99, 235, 255))
    draw.text((630, 385), ".scene", anchor="mm", font=font(23, True), fill="white")
    draw.text((735, 334), "clothing_rack_2020_v2.scene", font=font(34, True), fill=(15, 23, 42))
    draw.text((735, 402), "MayCAD 场景文件", font=font(27), fill=(75, 92, 120))
    draw.text((735, 455), "✓  本地读取，不上传 AI", font=font(25, True), fill=(22, 163, 74))
    rounded(draw, (755, 590, 1165, 665), 24, (37, 99, 235, 255))
    draw.text((960, 627), "选择并开始导入", anchor="mm", font=font(28, True), fill="white")
    arrow(draw, (1300, 705), (1125, 650))
    return caption(image.convert("RGB"), "02", "选择 MayCAD 导出的 .scene 文件", "本地确定性解析，不需要 Qwen、DeepSeek 或任何 API key")


def step_three() -> Image.Image:
    image = load_capture("02-tapping-choice.png")
    draw = ImageDraw.Draw(image, "RGBA")
    rounded(draw, (600, 680, 960, 785), 26, (37, 99, 235, 24), outline=(37, 99, 235, 255), width=6)
    arrow(draw, (425, 730), (605, 735))
    draw.text((228, 690), "本示例选择", font=font(28, True), fill=(37, 99, 235))
    draw.text((228, 730), "保持不攻丝", font=font(34, True), fill=(15, 23, 42))
    return caption(image, "03", "确认本次导入的端面攻丝方式", "可保持不攻丝，也可一键将全部型材两端设为攻丝")


def step_four() -> Image.Image:
    image = load_capture("03-imported-overview.png")
    draw = ImageDraw.Draw(image, "RGBA")
    rounded(draw, (444, 290, 982, 435), 22, (255, 255, 255, 10), outline=(245, 158, 11, 255), width=5)
    rounded(draw, (1400, 230, 1900, 845), 22, (37, 99, 235, 12), outline=(37, 99, 235, 210), width=5)
    draw.text((1150, 475), "模型自动生成", font=font(32, True), fill=(37, 99, 235))
    arrow(draw, (1330, 500), (1025, 610))
    return caption(image, "04", "9 根型材完成导入，结构与尺寸保持可编辑", "已验证型号直接一一对应；项目结构中保留 MayCAD 来源记录")


def step_five() -> Image.Image:
    image = load_capture("04-editable-drilling.png")
    draw = ImageDraw.Draw(image, "RGBA")
    rounded(draw, (1408, 140, 1905, 835), 24, (37, 99, 235, 10), outline=(37, 99, 235, 230), width=5)
    arrow(draw, (1250, 540), (1430, 435))
    rounded(draw, (965, 470, 1350, 600), 22, (255, 255, 255, 235), outline=(37, 99, 235, 150), width=3)
    draw.text((1000, 500), "导入后仍可修改", font=font(30, True), fill=(15, 23, 42))
    draw.text((1000, 548), "型号 · 长度 · 颜色 · 位置 · 旋转", font=font(23), fill=(55, 74, 105))
    return caption(image, "05", "导入结果不是图片，而是可继续编辑的 3D 模型", "选中任意型材，即可继续调整参数、加工与位置")


def step_six() -> Image.Image:
    source = load_capture("03-imported-overview.png")
    image = ImageEnhance.Brightness(source).enhance(0.66).convert("RGBA")
    crop = source.crop((1385, 210, 1915, 860)).resize((760, 930), Image.Resampling.LANCZOS)
    crop = crop.filter(ImageFilter.UnsharpMask(radius=2, percent=125, threshold=3))
    shadow = Image.new("RGBA", image.size, (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow, "RGBA")
    rounded(shadow_draw, (1050, 55, 1845, 1005), 36, (0, 0, 0, 110))
    shadow = shadow.filter(ImageFilter.GaussianBlur(18))
    image = Image.alpha_composite(image, shadow)
    panel = Image.new("RGBA", (795, 950), (255, 255, 255, 255))
    panel.paste(crop, (18, 10))
    image.alpha_composite(panel, (1035, 45))
    draw = ImageDraw.Draw(image, "RGBA")
    rounded(draw, (95, 230, 910, 650), 36, (255, 255, 255, 246))
    draw.text((160, 290), "加工记录完整导入", font=font(48, True), fill=(15, 23, 42))
    draw.text((160, 395), "4", font=font(100, True), fill=(37, 99, 235))
    draw.text((275, 438), "个通孔", font=font(34, True), fill=(55, 74, 105))
    draw.text((510, 395), "12", font=font(100, True), fill=(245, 158, 11))
    draw.text((670, 438), "个沉头孔", font=font(34, True), fill=(55, 74, 105))
    draw.text((160, 555), "无未知型号 · 无盲孔警告", font=font(29, True), fill=(22, 163, 74))
    return caption(image.convert("RGB"), "06", "本示例 9 根型材＋16 个孔位完整导入", "孔位、面、槽位和端部距离均可继续检查与修改")


def outro_card() -> Image.Image:
    image = Image.new("RGB", (WIDTH, HEIGHT), "#07152f")
    draw = ImageDraw.Draw(image, "RGBA")
    draw.ellipse((1080, -260, 2050, 710), fill=(37, 99, 235, 70))
    draw.ellipse((1320, 450, 2050, 1180), fill=(14, 165, 233, 35))
    rounded(draw, (145, 115, 430, 183), 30, (37, 99, 235, 255))
    draw.text((287, 149), "萌开了 3D 设计器", anchor="mm", font=font(27, True), fill="white")
    draw.text((145, 285), "MayCAD 设计", font=font(74, True), fill="white")
    draw.text((145, 385), "继续在萌开了编辑", font=font(74, True), fill=(110, 181, 255))
    checks = [
        "✓  .scene 本地解析，不调用 AI",
        "✓  已验证型材精准一一对应",
        "✓  型材与打孔记录可继续编辑",
        "✓  最后由客户人工审核确认",
    ]
    for index, line in enumerate(checks):
        draw.text((165, 560 + index * 72), line, font=font(31, True), fill=(215, 230, 250))
    rounded(draw, (1230, 690, 1765, 835), 36, (255, 255, 255, 245))
    draw.text((1497, 742), "现在开始设计", anchor="mm", font=font(31, True), fill=(37, 99, 235))
    draw.text((1497, 795), "mengkaile.top", anchor="mm", font=font(35, True), fill=(15, 23, 42))
    return image


@dataclass(frozen=True)
class Segment:
    image: Image.Image
    duration: float
    zoom: float = 0.018


def ken_burns(image: Image.Image, progress: float, amount: float) -> Image.Image:
    scale = 1.0 + amount * progress
    crop_w = round(WIDTH / scale)
    crop_h = round(HEIGHT / scale)
    left = round((WIDTH - crop_w) * (0.45 + progress * 0.05))
    top = round((HEIGHT - crop_h) * (0.48 - progress * 0.04))
    return image.crop((left, top, left + crop_w, top + crop_h)).resize((WIDTH, HEIGHT), Image.Resampling.LANCZOS)


def main() -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    segments = [
        Segment(intro_card(), 3.2, 0.010),
        Segment(step_one(), 4.5),
        Segment(step_two(), 4.5, 0.010),
        Segment(step_three(), 5.0, 0.012),
        Segment(step_four(), 6.0),
        Segment(step_five(), 5.2),
        Segment(step_six(), 5.2, 0.012),
        Segment(outro_card(), 4.2, 0.010),
    ]
    ffmpeg = subprocess.Popen(
        [
            "/opt/homebrew/bin/ffmpeg", "-y", "-hide_banner", "-loglevel", "warning",
            "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{WIDTH}x{HEIGHT}", "-r", str(FPS), "-i", "-",
            "-an", "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p",
            "-movflags", "+faststart", str(OUTPUT),
        ],
        stdin=subprocess.PIPE,
    )
    assert ffmpeg.stdin is not None
    previous: Image.Image | None = None
    fade_frames = round(FPS * 0.35)
    try:
        for segment in segments:
            frame_count = round(segment.duration * FPS)
            for index in range(frame_count):
                progress = index / max(1, frame_count - 1)
                frame = ken_burns(segment.image, progress, segment.zoom)
                if previous is not None and index < fade_frames:
                    frame = Image.blend(previous, frame, (index + 1) / fade_frames)
                ffmpeg.stdin.write(frame.convert("RGB").tobytes())
            previous = ken_burns(segment.image, 1.0, segment.zoom)
    finally:
        ffmpeg.stdin.close()
    if ffmpeg.wait() != 0:
        raise SystemExit("ffmpeg failed")
    print(OUTPUT)


if __name__ == "__main__":
    main()
