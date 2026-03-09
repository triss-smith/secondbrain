# installer/create_icon.py
"""Run once: python installer/create_icon.py"""
from pathlib import Path
from PIL import Image, ImageDraw


def make_icon() -> Image.Image:
    img = Image.new("RGBA", (256, 256), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    # Indigo circle background
    draw.ellipse([8, 8, 248, 248], fill=(99, 102, 241, 255))
    # White letter "S"
    draw.text((72, 60), "S", fill=(255, 255, 255, 255))
    return img


if __name__ == "__main__":
    icon = make_icon()
    sizes = [(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
    out = Path(__file__).parent / "icon.ico"
    icon.save(out, format="ICO", sizes=sizes)
    print(f"Saved {out}")
