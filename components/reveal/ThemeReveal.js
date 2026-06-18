"use client";

import { useEffect, useState } from "react";
import { resolveTheme, applyTheme } from "@/lib/themes";
import { albumCover, itunesLookup } from "@/lib/api";
import styles from "./ThemeReveal.module.css";

// Spec 2.2 sequence:
// "Building your world..." (resolve+apply theme, fetch album art) -> black ->
// song titles fade in one by one -> album art blooms behind -> final line ->
// onDone (page reveals beneath, now themed).
export default function ThemeReveal({ profile, onComplete }) {
  const [phase, setPhase] = useState("building"); // building | titles
  const [step, setStep] = useState(0);
  const [art, setArt] = useState(null);

  const titles = (profile?.top_songs?.length ? profile.top_songs : [profile?.favourite_album])
    .filter(Boolean)
    .slice(0, 3);

  // resolve theme + art, then move to titles after a minimum beat
  useEffect(() => {
    let alive = true;
    const start = Date.now();
    (async () => {
      try {
        const theme = await resolveTheme(profile);
        if (alive) applyTheme(theme);
      } catch {
        /* keep default theme */
      }
      let a = null;
      try {
        if (profile?.favourite_album) {
          a = await albumCover(profile.favourite_artist, profile.favourite_album);
        }
        if (!a && titles[0]) {
          const t = await itunesLookup(profile.favourite_artist, titles[0]);
          a = t?.artwork || null;
        }
      } catch {
        /* gradient fallback */
      }
      if (alive && a) setArt(a);

      const wait = Math.max(0, 1500 - (Date.now() - start));
      setTimeout(() => alive && setPhase("titles"), wait);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // title sequence
  useEffect(() => {
    if (phase !== "titles") return;
    const n = titles.length || 1;
    const timers = [];
    for (let i = 0; i < n; i++) {
      timers.push(setTimeout(() => setStep(i + 1), 300 + i * 1000));
    }
    const finalAt = 300 + n * 1000 + 500;
    timers.push(setTimeout(() => setStep(n + 1), finalAt)); // final line
    timers.push(setTimeout(() => onComplete?.(), finalAt + 2000));
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  return (
    <div className={styles.screen}>
      {phase === "building" && (
        <div className={styles.building}>
          <span className={styles.buildingText}>Building your world…</span>
        </div>
      )}

      {phase === "titles" && (
        <>
          <div
            className={`${styles.bloom} ${art ? "" : styles.bloomFallback}`}
            style={{
              backgroundImage: art ? `url(${art})` : undefined,
              opacity: step >= 1 ? 1 : 0,
              transform: step >= 1 ? "scale(1)" : "scale(0.85)",
            }}
          />
          <div className={styles.vignette} />
          <div className={styles.content}>
            {titles.map((t, i) => (
              <div
                key={`${t}-${i}`}
                className={styles.title}
                style={{
                  opacity: step >= i + 1 ? 1 : 0,
                  transform: step >= i + 1 ? "translateY(0)" : "translateY(16px)",
                }}
              >
                {t}
              </div>
            ))}
            <div
              className={styles.final}
              style={{
                opacity: step >= titles.length + 1 ? 1 : 0,
                transform: step >= titles.length + 1 ? "translateY(0)" : "translateY(10px)",
              }}
            >
              Your musical world is ready.
            </div>
          </div>
        </>
      )}
    </div>
  );
}
