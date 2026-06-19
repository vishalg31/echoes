"use client";

// Ambient music-equalizer that lives behind the content: a row of bars that
// pulse like a sound wave, tinted by the active theme accent (--page-accent-rgb,
// so it follows the era / playing song). Decorative only — hidden from a11y and
// frozen under prefers-reduced-motion.
import styles from "./RhythmWave.module.css";

const BARS = 56;

export default function RhythmWave() {
  return (
    <div className={styles.wrap} aria-hidden="true">
      {Array.from({ length: BARS }).map((_, i) => (
        <span
          key={i}
          className={styles.bar}
          style={{
            // stagger + vary so the row ripples instead of bouncing in unison
            animationDelay: `${((i * 5) % 14) * -0.13}s`,
            animationDuration: `${1.0 + ((i * 7) % 10) * 0.11}s`,
          }}
        />
      ))}
    </div>
  );
}
