"use client";

import { useEffect, useRef, useState } from "react";
import { albumCover } from "@/lib/api";
import { resolveTheme, themeSwatches } from "@/lib/themes";
import { buildShareUrl } from "@/lib/storage";
import { getSessions } from "@/lib/db";
import { genreMap, eraSpread, rarestFind, totals, badges, fmtCount } from "@/lib/fingerprint";
import { Play, Pause, Check, Share2 } from "lucide-react";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import styles from "./ProfileCard.module.css";

// Spec 3.9 + 14.1 — the profile as a destination. Identity is the original
// shareable card; Stats is the taste fingerprint; Discoveries is the playable
// known-songs list; Chains is past sessions. All data is local (Dexie).
const TABS = ["Identity", "Stats", "Known", "Saved", "Chains"];

export default function ProfileCard({ profile, onClose, onReset, onMatchFrom }) {
  const [art, setArt] = useState(null);
  const [swatches, setSwatches] = useState([]);
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState("Identity");
  const [sessions, setSessions] = useState([]);
  const [playingId, setPlayingId] = useState(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const audioRef = useRef(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const theme = await resolveTheme(profile);
        if (alive) setSwatches(themeSwatches(theme));
      } catch {
        /* ignore */
      }
      try {
        if (profile?.favourite_album) {
          const a = await albumCover(profile.favourite_artist, profile.favourite_album);
          if (alive && a) setArt(a);
        }
      } catch {
        /* gradient fallback via tint only */
      }
    })();
    return () => {
      alive = false;
    };
  }, [profile]);

  // local session history for Stats + Chains
  useEffect(() => {
    let alive = true;
    getSessions()
      .then((s) => alive && setSessions(s))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  // stop any preview when the card closes
  useEffect(() => () => audioRef.current?.pause?.(), []);

  // lock background scroll while the modal is open (mobile especially)
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const songs = (profile?.top_songs?.length ? profile.top_songs : [profile?.favourite_album])
    .filter(Boolean)
    .slice(0, 3);

  const knownList = (profile?.known_songs || []).filter((k) => k && typeof k === "object" && k.track);
  const savedList = (profile?.saved_songs || []).filter((k) => k && typeof k === "object" && k.track);

  const fp = {
    genres: genreMap(profile?.known_songs),
    eras: eraSpread(profile?.known_songs),
    rare: rarestFind(profile?.known_songs),
    tot: totals(profile?.known_songs, sessions),
    badges: badges(profile?.known_songs, sessions),
  };

  function copyLink() {
    const url = buildShareUrl(profile);
    navigator.clipboard?.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function togglePlay(song) {
    const el = audioRef.current;
    if (!el || !song.previewUrl) return;
    if (playingId === song.id) {
      el.pause();
      setPlayingId(null);
      return;
    }
    el.src = song.previewUrl;
    el.play().catch(() => {});
    setPlayingId(song.id);
  }

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.wrap} onClick={(e) => e.stopPropagation()}>
        <div className={styles.card}>
          <div
            className={styles.bg}
            style={{ backgroundImage: art ? `url(${art})` : "linear-gradient(135deg,#4a3b6b,#c1622e)" }}
          />
          <div className={styles.bgTint} />
          <div className={styles.inner}>
            <div className={styles.kicker}>My Echoes</div>

            <div className={styles.tabs}>
              {TABS.map((t) => (
                <button
                  key={t}
                  className={`${styles.tab} ${tab === t ? styles.tabOn : ""}`}
                  onClick={() => setTab(t)}
                >
                  {t}
                </button>
              ))}
            </div>

            <div className={styles.tabBody}>
            {tab === "Identity" && (
              <div className={styles.fade}>
                <div className={styles.songs}>
                  {songs.map((s, i) => (
                    <span key={`${s}-${i}`} className={styles.song}>
                      {s}
                    </span>
                  ))}
                </div>
                <div className={styles.badges}>
                  {profile?.favourite_artist && <span className={styles.badge}>{profile.favourite_artist}</span>}
                  {profile?.decade && <span className={styles.badge}>{profile.decade}</span>}
                </div>
                {swatches.length > 0 && (
                  <div className={styles.swatches}>
                    {swatches.map((c, i) => (
                      <span key={i} className={styles.swatch} style={{ background: c }} />
                    ))}
                  </div>
                )}
                <div className={styles.actions}>
                  <button className={`${styles.btn} ${styles.primary}`} onClick={copyLink}>
                    {copied ? (
                      <>
                        <Check size={15} /> Link copied
                      </>
                    ) : (
                      <>
                        <Share2 size={15} /> Copy share link
                      </>
                    )}
                  </button>
                  {onReset && (
                    <button
                      className={`${styles.btn} ${styles.secondary}`}
                      onClick={() => setConfirmReset(true)}
                    >
                      Start over
                    </button>
                  )}
                </div>
                <p className={styles.note}>Anyone who opens your link sees your world and theme.</p>
              </div>
            )}

            {tab === "Stats" && <StatsView fp={fp} />}

            {tab === "Known" && (
              <DiscoveriesView
                list={knownList}
                playingId={playingId}
                onTogglePlay={togglePlay}
                onMatchFrom={onMatchFrom}
                onClose={onClose}
                emptyText="Songs you mark as known show up here, playable and ready to match from."
              />
            )}

            {tab === "Saved" && (
              <DiscoveriesView
                list={savedList}
                playingId={playingId}
                onTogglePlay={togglePlay}
                onMatchFrom={onMatchFrom}
                onClose={onClose}
                emptyText="Songs you save for later land here, ready to play and match from when you come back."
              />
            )}

            {tab === "Chains" && <ChainsView sessions={sessions} />}
            </div>
          </div>
        </div>
        <button className={styles.close} onClick={onClose}>
          Close
        </button>
        <audio ref={audioRef} onEnded={() => setPlayingId(null)} hidden />
      </div>

      {confirmReset && (
        <ConfirmDialog
          title="Start over?"
          message="This clears your profile and chain, and takes you back to the questions."
          confirmLabel="Start over"
          onConfirm={() => {
            setConfirmReset(false);
            onReset?.();
          }}
          onCancel={() => setConfirmReset(false)}
        />
      )}
    </div>
  );
}

/* ---------- tab views ---------- */

function StatsView({ fp }) {
  const { genres, eras, rare, tot, badges: earned } = fp;
  if (tot.songs === 0) {
    return <p className={styles.emptyMini}>Discover a few songs and your taste fingerprint appears here.</p>;
  }
  const gMax = Math.max(1, ...genres.map((g) => g.count));
  const eMax = Math.max(1, ...eras.map((e) => e.count));
  return (
    <div className={styles.fade}>
      <div className={styles.totals}>
        <Stat n={tot.songs} label="discovered" />
        <Stat n={tot.artists} label="artists" />
        <Stat n={tot.sessions} label="sessions" />
        <Stat n={tot.longestChain} label="longest chain" />
      </div>

      {genres.length > 0 && (
        <div className={styles.statBlock}>
          <div className={styles.statHead}>Top genres</div>
          {genres.map((g) => (
            <div key={g.tag} className={styles.bar}>
              <span className={styles.barLabel}>{g.tag}</span>
              <span className={styles.barTrack}>
                <span className={styles.barFill} style={{ width: `${(g.count / gMax) * 100}%` }} />
              </span>
              <span className={styles.barVal}>{g.count}</span>
            </div>
          ))}
        </div>
      )}

      {eras.length > 0 && (
        <div className={styles.statBlock}>
          <div className={styles.statHead}>Era spread</div>
          {eras.map((e) => (
            <div key={e.decade} className={styles.bar}>
              <span className={styles.barLabel}>{e.decade}</span>
              <span className={styles.barTrack}>
                <span className={styles.barFill} style={{ width: `${(e.count / eMax) * 100}%` }} />
              </span>
              <span className={styles.barVal}>{e.count}</span>
            </div>
          ))}
        </div>
      )}

      {rare && (
        <div className={styles.statBlock}>
          <div className={styles.statHead}>Rarest find</div>
          <div className={styles.rare}>
            <strong>{rare.track}</strong> · {rare.artist}
            <span className={styles.rareSub}>{fmtCount(rare._l)} listeners</span>
          </div>
        </div>
      )}

      {earned.length > 0 && (
        <div className={styles.statBlock}>
          <div className={styles.statHead}>Badges</div>
          <div className={styles.badges}>
            {earned.map((b) => (
              <span key={b.key} className={styles.badge} title={b.hint}>
                {b.label}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ n, label }) {
  return (
    <div className={styles.statCell}>
      <div className={styles.statNum}>{n}</div>
      <div className={styles.statCap}>{label}</div>
    </div>
  );
}

function DiscoveriesView({ list, playingId, onTogglePlay, onMatchFrom, onClose, emptyText }) {
  if (list.length === 0) {
    return <p className={styles.emptyMini}>{emptyText}</p>;
  }
  return (
    <div className={`${styles.fade} ${styles.discList}`}>
      {list
        .slice()
        .reverse()
        .map((k) => (
          <div key={k.id} className={styles.discRow}>
            <div
              className={styles.discThumb}
              style={{
                backgroundImage: k.albumArt
                  ? `url(${k.albumArt})`
                  : "linear-gradient(135deg,#5a4b7b,#c1622e)",
              }}
            />
            <div className={styles.discMeta}>
              <div className={styles.discTrack}>{k.track}</div>
              <div className={styles.discSub}>
                {k.artist}
                {k.year ? ` · ${k.year}` : ""}
              </div>
            </div>
            <div className={styles.discBtns}>
              {k.previewUrl && (
                <button
                  className={styles.iconBtn}
                  onClick={() => onTogglePlay(k)}
                  title="Play 30s preview"
                >
                  {playingId === k.id ? (
                    <Pause size={13} fill="currentColor" strokeWidth={0} />
                  ) : (
                    <Play size={13} fill="currentColor" strokeWidth={0} />
                  )}
                </button>
              )}
              {onMatchFrom && (
                <button
                  className={styles.matchBtn}
                  onClick={() => {
                    onMatchFrom({ track: k.track, artist: k.artist });
                    onClose?.();
                  }}
                  title="Start a Taste Match from this song"
                >
                  Match
                </button>
              )}
            </div>
          </div>
        ))}
    </div>
  );
}

function ChainsView({ sessions }) {
  const rows = sessions.filter((s) => (s.chain || []).length > 0);
  if (rows.length === 0) {
    return <p className={styles.emptyMini}>Your discovery chains from each session will collect here.</p>;
  }
  return (
    <div className={`${styles.fade} ${styles.chainList}`}>
      {rows
        .slice()
        .reverse()
        .map((s) => (
          <div key={s.id} className={styles.chainCard}>
            <div className={styles.chainMode}>
              {s.mode === "taste_match" ? "Taste Match" : "Artist Deep Dive"} · {s.chain.length} songs
            </div>
            <div className={styles.chainSeq}>{s.chain.join("  →  ")}</div>
          </div>
        ))}
    </div>
  );
}
