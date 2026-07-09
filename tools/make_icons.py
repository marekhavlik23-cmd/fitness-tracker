"""Generate PWA icons (dumbbell on dark background) into icons/.

Run from the project root:  py -3 tools/make_icons.py
"""

from PIL import Image, ImageDraw

BG = (26, 30, 39)        # --surface
ACCENT = (74, 222, 128)  # --accent


def draw_dumbbell(size: int, content_scale: float) -> Image.Image:
    """Dumbbell centered on a solid square. content_scale shrinks the motif
    (maskable icons need the motif inside the central safe zone)."""
    img = Image.new("RGB", (size, size), BG)
    d = ImageDraw.Draw(img)

    def rect(cx, cy, w, h):
        # Rounded rect around center point; all inputs are fractions of size.
        s = content_scale * size
        x0 = size / 2 + (cx - w / 2) * s
        y0 = size / 2 + (cy - h / 2) * s
        x1 = size / 2 + (cx + w / 2) * s
        y1 = size / 2 + (cy + h / 2) * s
        d.rounded_rectangle([x0, y0, x1, y1], radius=0.045 * s, fill=ACCENT)

    rect(0.0, 0.0, 0.72, 0.09)      # bar
    rect(-0.26, 0.0, 0.115, 0.46)   # inner plate left
    rect(0.26, 0.0, 0.115, 0.46)    # inner plate right
    rect(-0.385, 0.0, 0.09, 0.32)   # outer plate left
    rect(0.385, 0.0, 0.09, 0.32)    # outer plate right
    return img


def main():
    draw_dumbbell(192, 0.92).save("icons/icon-192.png")
    draw_dumbbell(512, 0.92).save("icons/icon-512.png")
    # Maskable: motif within the central ~66% so any launcher mask keeps it whole.
    draw_dumbbell(512, 0.62).save("icons/icon-maskable-512.png")
    print("icons written: icon-192.png, icon-512.png, icon-maskable-512.png")


if __name__ == "__main__":
    main()
