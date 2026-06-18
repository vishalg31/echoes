// Album-art colour engine for the art-led dark UI (design identity, 2026-06-18).
// Built on node-vibrant: median-cut quantisation into named swatches
// (Vibrant / DarkVibrant / LightVibrant / Muted / DarkMuted / LightMuted) —
// the same approach Spotify/Apple-style adaptive UIs use. We map those swatches
// to a "mood": a punchy accent for highlights + a deep art-tinted background.
//
// iTunes/mzstatic art serves Access-Control-Allow-Origin: *, but we still
// pre-load the image with crossOrigin="anonymous" so the canvas never taints.
//
// Returns (cached per URL):
//   { accent, accentRgb, accentText, deep, deep2, light }
// `null` means extraction failed — callers fall back to the brand defaults.

import { Vibrant } from "node-vibrant/browser";

const cache = new Map();

export function paletteFromImage(url) {
  if (!url || typeof window === "undefined") return Promise.resolve(null);
  if (cache.has(url)) return cache.get(url);
  const p = extract(url).catch(() => null);
  cache.set(url, p);
  return p;
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

async function extract(url) {
  const img = await loadImage(url);
  const palette = await new Vibrant(img, { quality: 3 }).getPalette();
  return toMood(palette);
}

function toMood(p) {
  if (!p) return null;
  const accentSw =
    p.Vibrant || p.LightVibrant || p.DarkVibrant || p.Muted || p.LightMuted || p.DarkMuted;
  if (!accentSw) return null;

  const [ar, ag, ab] = normaliseAccent(...accentSw.rgb);
  const [ah] = rgbToHsl(ar, ag, ab);

  // background hue from a dark swatch so the page bg reads as "this album"
  const darkSw = p.DarkMuted || p.DarkVibrant || p.Muted || accentSw;
  const [dh, ds] = rgbToHsl(...darkSw.rgb);
  const deepSat = Math.min(0.45, Math.max(0.18, ds));

  // brightest swatch's luminance — flags rare mostly-light artwork
  const bright = p.LightVibrant || p.LightMuted || p.Vibrant || accentSw;
  const [, , bl] = rgbToHsl(...bright.rgb);

  return {
    accent: rgbStr(ar, ag, ab),
    accentRgb: `${ar}, ${ag}, ${ab}`,
    accentText: rgbStr(...hslToRgb(ah, 0.7, 0.74)), // bright label/text tint
    deep: rgbStr(...hslToRgb(dh, deepSat, 0.07)), // gradient top — art-tinted black
    deep2: rgbStr(...hslToRgb(dh, deepSat, 0.12)), // gradient bottom
    light: bl > 0.7,
  };
}

// Push the chosen swatch to a vibrant, readable accent: floor saturation, pin
// lightness into a confident band so dark or washed art still pops.
function normaliseAccent(r, g, b) {
  let [h, s, l] = rgbToHsl(r, g, b);
  s = Math.max(0.55, Math.min(0.92, s));
  l = Math.max(0.5, Math.min(0.64, l));
  return hslToRgb(h, s, l);
}

// ---- colour-space helpers ----
function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  const d = max - min;
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
        break;
      case g:
        h = ((b - r) / d + 2) * 60;
        break;
      default:
        h = ((r - g) / d + 4) * 60;
    }
  }
  return [h, s, l];
}

function hslToRgb(h, s, l) {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

function rgbStr(r, g, b) {
  return `rgb(${r}, ${g}, ${b})`;
}
