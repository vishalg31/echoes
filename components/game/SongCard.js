"use client";

import { useEffect, useState } from "react";
import { Play, Pause, Star, Check, SkipForward, Info, Bookmark, BookmarkCheck } from "lucide-react";
import { paletteFromImage } from "@/lib/palette";
import Equalizer from "@/components/ui/Equalizer";
import styles from "./SongCard.module.css";

// deterministic gradient when no album art
function gradientFor(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360;
  return `linear-gradient(135deg, hsl(${h},45%,42%) 0%, hsl(${(h + 40) % 360},50%,32%) 100%)`;
}

// Art-led dark card. Playback is controlled by the parent (one shared player),
// so this component is presentational: it reflects isPlaying and calls
// onTogglePlay. Its accent is pulled live from its own album art.
export default function SongCard({
  card,
  known,
  isSaved,
  isWinner,
  dimmed,
  isPlaying,
  onTogglePlay,
  onToggleSave,
  onKnow,
  onSkip,
  onTellMore,
  onPick,
}) {
  const [mood, setMood] = useState(null);

  useEffect(() => {
    let alive = true;
    setMood(null);
    if (card.albumArt) {
      paletteFromImage(card.albumArt).then((m) => alive && setMood(m));
    }
    return () => {
      alive = false;
    };
  }, [card.albumArt]);

  const moodVars = mood
    ? {
        "--mood-accent": mood.accent,
        "--mood-rgb": mood.accentRgb,
        "--mood-text": mood.accentText,
      }
    : undefined;

  return (
    <div
      className={`${styles.card} ${isWinner ? styles.winner : ""} ${dimmed ? styles.dimmed : ""} ${
        mood ? styles.moodOn : ""
      }`}
      style={moodVars}
    >
      <div className={styles.artWrap}>
        <div
          className={styles.art}
          style={{
            background: card.albumArt
              ? `url(${card.albumArt})`
              : gradientFor(card.id || card.track),
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        <div className={styles.artScrim} />
        {known && <span className={styles.knownBadge}>Known</span>}
        {isPlaying && (
          <span className={styles.cardEq}>
            <Equalizer playing />
          </span>
        )}
        {isWinner && (
          <div className={styles.winnerOverlay}>
            <span className={styles.burstRing} />
            <span className={styles.burstRing} style={{ animationDelay: "0.09s" }} />
            <div className={styles.sparks} aria-hidden>
              {Array.from({ length: 10 }).map((_, k) => (
                <span key={k} style={{ "--a": `${k * 36}deg`, animationDelay: `${k * 0.012}s` }} />
              ))}
            </div>
            <Star className={styles.winnerStar} size={40} fill="currentColor" strokeWidth={1.5} />
            <span>Winner</span>
          </div>
        )}
        {card.previewUrl && (
          <button
            className={`${styles.playFab} ${isPlaying ? styles.playFabOn : ""}`}
            onClick={onTogglePlay}
            title={isPlaying ? "Pause preview" : "Play 30s preview"}
            aria-label={isPlaying ? "Pause preview" : "Play preview"}
          >
            {isPlaying ? (
              <Pause size={18} fill="currentColor" strokeWidth={0} />
            ) : (
              <Play size={18} fill="currentColor" strokeWidth={0} />
            )}
          </button>
        )}
      </div>

      <div className={styles.body}>
        <div className={styles.titleRow}>
          <h3 className={styles.title}>{card.track}</h3>
          {onToggleSave && (
            <button
              className={`${styles.saveBtn} ${isSaved ? styles.saveBtnOn : ""}`}
              onClick={onToggleSave}
              title={isSaved ? "Saved for later" : "Save for later"}
              aria-label={isSaved ? "Remove from saved" : "Save for later"}
            >
              {isSaved ? (
                <BookmarkCheck size={18} fill="currentColor" strokeWidth={1.5} />
              ) : (
                <Bookmark size={18} />
              )}
            </button>
          )}
        </div>
        <p className={styles.meta}>
          {card.artist}
          {card.year ? ` · ${card.year}` : ""}
        </p>
        {card.why && <p className={styles.why}>{card.why}</p>}

        <div className={styles.actions}>
          <button
            className={`${styles.action} ${styles.actKnow} ${known ? styles.on : ""}`}
            onClick={onKnow}
          >
            {known ? (
              <>
                <Check size={15} /> Known
              </>
            ) : (
              <>
                <Check size={15} /> I know this
              </>
            )}
          </button>
          {onSkip && (
            <button className={`${styles.action} ${styles.actSkip}`} onClick={onSkip}>
              <SkipForward size={15} /> Skip
            </button>
          )}
          <button className={`${styles.action} ${styles.actMore}`} onClick={onTellMore}>
            <Info size={15} /> Tell me more
          </button>
          <button className={`${styles.action} ${styles.primary}`} onClick={onPick}>
            <Star size={15} fill="currentColor" strokeWidth={0} /> Pick winner
          </button>
        </div>
      </div>
    </div>
  );
}
