// Profile persistence (spec 2.3): browser cookie + base64-in-URL share link.
// All functions are client-side only (guard for window/document).

import { emptyProfile } from "./profile";

const COOKIE = "echoes_profile";
const ONE_YEAR = 60 * 60 * 24 * 365;

// ---- base64 (URL-safe, UTF-8 safe) ----
export function encodeProfile(profile) {
  const json = JSON.stringify(profile);
  const b64 = btoa(unescape(encodeURIComponent(json)));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeProfile(str) {
  try {
    const b64 = str.replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(escape(atob(b64)));
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== "object") return null;
    // Fill any missing fields so older/partial links stay valid.
    return { ...emptyProfile(), ...parsed };
  } catch {
    return null;
  }
}

// ---- cookie ----
export function saveProfile(profile) {
  if (typeof document === "undefined") return;
  document.cookie = `${COOKIE}=${encodeProfile(profile)}; path=/; max-age=${ONE_YEAR}; samesite=lax`;
}

export function loadProfileFromCookie() {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp("(?:^|; )" + COOKIE + "=([^;]*)"));
  return match ? decodeProfile(match[1]) : null;
}

export function clearProfile() {
  if (typeof document === "undefined") return;
  document.cookie = `${COOKIE}=; path=/; max-age=0`;
}

// ---- URL share link ----
export function loadProfileFromUrl() {
  if (typeof window === "undefined") return null;
  const param = new URLSearchParams(window.location.search).get("profile");
  return param ? decodeProfile(param) : null;
}

export function buildShareUrl(profile) {
  const base =
    typeof window !== "undefined"
      ? window.location.origin + window.location.pathname
      : "";
  return `${base}?profile=${encodeProfile(profile)}`;
}
