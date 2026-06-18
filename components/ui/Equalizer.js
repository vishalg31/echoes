import styles from "./Equalizer.module.css";

// Animated equalizer bars — the "music is playing" signal. Inherits colour from
// the parent (currentColor), animates only when `playing`. Pure CSS, so it
// freezes under prefers-reduced-motion via the global rule.
export default function Equalizer({ playing = true, bars = 4, className = "" }) {
  return (
    <span className={`${styles.eq} ${playing ? styles.on : ""} ${className}`} aria-hidden>
      {Array.from({ length: bars }).map((_, i) => (
        <span key={i} style={{ animationDelay: `${i * 0.16}s` }} />
      ))}
    </span>
  );
}
