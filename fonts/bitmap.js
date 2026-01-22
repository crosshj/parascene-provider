// Bitmap text rendering utilities (font-free)
import sharp from "sharp";

function isValidHexColor(color) {
  return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color);
}

function hexToRgba(color) {
  if (!isValidHexColor(color)) {
    throw new Error(`Invalid hex color format: ${color}`);
  }
  const hex = color.replace("#", "");
  const expanded =
    hex.length === 3
      ? hex
          .split("")
          .map((c) => c + c)
          .join("")
      : hex;
  const int = parseInt(expanded, 16);
  return {
    r: (int >> 16) & 0xff,
    g: (int >> 8) & 0xff,
    b: int & 0xff,
    a: 255,
  };
}

// Minimal 5x7 bitmap font
const FONT_5X7 = {
  A: [0b01110, 0b10001, 0b11111, 0b10001, 0b10001, 0b10001, 0b10001],
  B: [0b11110, 0b10001, 0b11110, 0b10001, 0b10001, 0b10001, 0b11110],
  C: [0b01110, 0b10001, 0b10000, 0b10000, 0b10000, 0b10001, 0b01110],
  D: [0b11100, 0b10010, 0b10001, 0b10001, 0b10001, 0b10010, 0b11100],
  E: [0b11111, 0b10000, 0b11110, 0b10000, 0b10000, 0b10000, 0b11111],
  F: [0b11111, 0b10000, 0b11110, 0b10000, 0b10000, 0b10000, 0b10000],
  G: [0b01110, 0b10001, 0b10000, 0b10111, 0b10001, 0b10001, 0b01110],
  H: [0b10001, 0b10001, 0b11111, 0b10001, 0b10001, 0b10001, 0b10001],
  I: [0b11111, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b11111],
  J: [0b11111, 0b00010, 0b00010, 0b00010, 0b00010, 0b10010, 0b01100],
  K: [0b10001, 0b10010, 0b11100, 0b10010, 0b10001, 0b10001, 0b10001],
  L: [0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b11111],
  M: [0b10001, 0b11011, 0b10101, 0b10101, 0b10001, 0b10001, 0b10001],
  N: [0b10001, 0b10001, 0b11001, 0b10101, 0b10011, 0b10001, 0b10001],
  O: [0b01110, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110],
  P: [0b11110, 0b10001, 0b10001, 0b11110, 0b10000, 0b10000, 0b10000],
  Q: [0b01110, 0b10001, 0b10001, 0b10001, 0b10101, 0b10010, 0b01101],
  R: [0b11110, 0b10001, 0b10001, 0b11110, 0b10100, 0b10010, 0b10001],
  S: [0b01111, 0b10000, 0b10000, 0b01110, 0b00001, 0b00001, 0b11110],
  T: [0b11111, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100],
  U: [0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110],
  V: [0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01010, 0b00100],
  W: [0b10001, 0b10001, 0b10001, 0b10101, 0b10101, 0b10101, 0b01010],
  X: [0b10001, 0b10001, 0b01010, 0b00100, 0b01010, 0b10001, 0b10001],
  Y: [0b10001, 0b10001, 0b01010, 0b00100, 0b00100, 0b00100, 0b00100],
  Z: [0b11111, 0b00001, 0b00010, 0b00100, 0b01000, 0b10000, 0b11111],
  0: [0b01110, 0b10001, 0b10011, 0b10101, 0b11001, 0b10001, 0b01110],
  1: [0b00100, 0b01100, 0b00100, 0b00100, 0b00100, 0b00100, 0b01110],
  2: [0b01110, 0b10001, 0b00001, 0b00010, 0b00100, 0b01000, 0b11111],
  3: [0b11110, 0b00001, 0b00001, 0b00110, 0b00001, 0b00001, 0b11110],
  4: [0b00010, 0b00110, 0b01010, 0b10010, 0b11111, 0b00010, 0b00010],
  5: [0b11111, 0b10000, 0b11110, 0b00001, 0b00001, 0b10001, 0b01110],
  6: [0b01110, 0b10000, 0b11110, 0b10001, 0b10001, 0b10001, 0b01110],
  7: [0b11111, 0b00001, 0b00010, 0b00100, 0b01000, 0b01000, 0b01000],
  8: [0b01110, 0b10001, 0b10001, 0b01110, 0b10001, 0b10001, 0b01110],
  9: [0b01110, 0b10001, 0b10001, 0b01111, 0b00001, 0b00001, 0b01110],
  " ": [0, 0, 0, 0, 0, 0, 0],
  "-": [0, 0, 0, 0b11111, 0, 0, 0],
  ":": [0, 0b00100, 0, 0, 0b00100, 0, 0],
  ".": [0, 0, 0, 0, 0, 0b01100, 0b01100],
  ",": [0, 0, 0, 0, 0b00110, 0b00110, 0b00100],
  "!": [0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0, 0b00100],
  "?": [0b01110, 0b10001, 0b00001, 0b00010, 0b00100, 0, 0b00100],
};

function getGlyph(char) {
  if (FONT_5X7[char]) return FONT_5X7[char];
  const upper = FONT_5X7[char.toUpperCase()];
  if (upper) return upper;
  return FONT_5X7["?"];
}

export async function renderBitmapToPng({
  text,
  width,
  height,
  textColor,
  backgroundColor,
  pixelSize = 22,
  letterSpacing = 1,
}) {
  const bg = hexToRgba(backgroundColor);
  const fg = hexToRgba(textColor);
  const glyphW = 5 * pixelSize;
  const glyphH = 7 * pixelSize;
  const spacing = letterSpacing * pixelSize;
  const textWidth = Math.max(1, text.length * (glyphW + spacing) - spacing);
  const textHeight = glyphH;
  const offsetX = Math.floor((width - textWidth) / 2);
  const offsetY = Math.floor((height - textHeight) / 2);

  const channels = 4;
  const buffer = Buffer.alloc(width * height * channels);

  // Fill background
  for (let i = 0; i < width * height; i++) {
    buffer[i * 4 + 0] = bg.r;
    buffer[i * 4 + 1] = bg.g;
    buffer[i * 4 + 2] = bg.b;
    buffer[i * 4 + 3] = bg.a;
  }

  let cursorX = offsetX;
  for (const ch of text) {
    const glyph = getGlyph(ch);
    glyph.forEach((rowBits, row) => {
      for (let col = 0; col < 5; col++) {
        if (rowBits & (1 << (4 - col))) {
          const startX = cursorX + col * pixelSize;
          const startY = offsetY + row * pixelSize;
          for (let py = 0; py < pixelSize; py++) {
            const y = startY + py;
            if (y < 0 || y >= height) continue;
            const rowOffset = y * width * channels;
            for (let px = 0; px < pixelSize; px++) {
              const x = startX + px;
              if (x < 0 || x >= width) continue;
              const idx = rowOffset + x * channels;
              buffer[idx + 0] = fg.r;
              buffer[idx + 1] = fg.g;
              buffer[idx + 2] = fg.b;
              buffer[idx + 3] = fg.a;
            }
          }
        }
      }
    });
    cursorX += glyphW + spacing;
  }

  return sharp(buffer, {
    raw: {
      width,
      height,
      channels,
    },
  })
    .png()
    .toBuffer();
}
