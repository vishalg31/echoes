"use client";

import { useEffect, useState } from "react";
import { Play, Check, ExternalLink } from "lucide-react";
import { getTrackInfo, wikiSummary, youtubeSearchUrl } from "@/lib/api";
import styles from "./TellMeMoreDrawer.module.css";

// Spec 5.2 — drawer opens instantly with skeletons; Last.fm getInfo + Wikipedia
// fire in parallel and render as they arrive. No MusicBrainz in V0.
export default function TellMeMoreDrawer({ card, onClose, onLikeWinner }) {
  const [info, setInfo] = useState(undefined); // undefined = loading
  const [wiki, setWiki] = useState(undefined);

  useEffect(() => {
    let alive = true;
    getTrackInfo(card.artist, card.track)
      .then((d) => alive && setInfo(d))
      .catch(() => alive && setInfo(null));
    wikiSummary(card.track)
      .then((d) => alive && setWiki(d))
      .catch(() => alive && setWiki(null));
    return () => {
      alive = false;
    };
  }, [card.artist, card.track]);

  const bothFailed = info === null && wiki === null;

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.drawer} onClick={(e) => e.stopPropagation()}>
        <div className={styles.head}>
          {card.albumArt && (
            <div className={styles.thumb} style={{ backgroundImage: `url(${card.albumArt})` }} />
          )}
          <div className={styles.headText}>
            <h2>{card.track}</h2>
            <p>
              {card.artist}
              {card.year ? ` · ${card.year}` : ""}
            </p>
          </div>
        </div>

        {/* Wikipedia */}
        <div className={styles.section}>
          <h3>About</h3>
          {wiki === undefined ? (
            <Skeletons />
          ) : wiki?.extract ? (
            <p>{wiki.extract}</p>
          ) : (
            <p style={{ opacity: 0.6 }}>No Wikipedia entry found for this track.</p>
          )}
        </div>

        {/* Last.fm bio snippet */}
        {(info === undefined || info?.wiki) && (
          <div className={styles.section}>
            <h3>Last.fm</h3>
            {info === undefined ? <Skeletons /> : <p>{info.wiki}</p>}
          </div>
        )}

        {bothFailed && (
          <div className={styles.section}>
            <p style={{ opacity: 0.6 }}>
              Not much written about this one yet. Give it a listen and judge for yourself.
            </p>
          </div>
        )}

        <a
          className={styles.yt}
          href={youtubeSearchUrl(card.artist, card.track)}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Play size={15} fill="currentColor" strokeWidth={0} /> Play full song on YouTube
          <ExternalLink size={14} />
        </a>

        <div className={styles.ctaRow}>
          <button className={`${styles.cta} ${styles.like}`} onClick={onLikeWinner}>
            <Check size={16} /> Got it, I like this
          </button>
          <button className={`${styles.cta} ${styles.skip}`} onClick={onClose}>
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}

function Skeletons() {
  return (
    <>
      <div className={styles.skeleton} />
      <div className={styles.skeleton} />
      <div className={styles.skeleton} />
    </>
  );
}
