"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, Sparkles, RotateCcw, Compass } from "lucide-react";
import { albumTracks, songInfo, albumInfo } from "@/lib/api";
import { ERAS, DEFAULT_DECADE, DEFAULT_THEME, eraTheme } from "@/lib/eras";
import { getSessions } from "@/lib/db";
import { genreMap, eraSpread, rarestFind, totals, badges, fmtCount } from "@/lib/fingerprint";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import styles from "./ProfilePage.module.css";

const TABS = ["Your World", "Play", "Stats"];

// localStorage flag so the first-run helper shows once. "Start over" clears it
// (see handleReset in app/page.js) so a fresh profile sees the tour again.
const TOUR_KEY = "echoes_tour_seen";

// The post-quiz home: your world up top, the two games behind the Play tab, your
// taste fingerprint + library under Stats. Replaces the old mode-select splash
// and the profile modal. `play` is the two game cards, passed in from GameScreen
// so they keep their own state/handlers.
export default function ProfilePage({ profile, themeLabel, art, play, onReset, onMatchFrom, onMatchSeed, onDeepDive }) {
  const [tab, setTab] = useState("Your World");
  const [useEra, setUseEra] = useState(true); // land in the user's era theme; toggle to the neutral default
  const [sessions, setSessions] = useState([]);
  const [confirmReset, setConfirmReset] = useState(false);
  const [info, setInfo] = useState(null); // { title, variants } for the Wikipedia sheet
  const [showTour, setShowTour] = useState(false); // first-run "where are the games" helper

  // show the helper once per profile (checked client-side to avoid a hydration
  // mismatch). Dismissing or jumping to Play marks it seen.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (!localStorage.getItem(TOUR_KEY)) setShowTour(true);
    } catch {}
  }, []);

  function dismissTour() {
    setShowTour(false);
    try {
      localStorage.setItem(TOUR_KEY, "1");
    } catch {}
  }

  const name = (profile?.name || "").trim();
  const artistName = profile?.favourite_artist || "";
  const albumName = profile?.favourite_album || "";

  // the user picked their decade in the quiz (profile.decade) → era theme.
  // hide the toggle when their era is already the default (no two identical themes).
  const userDecade = profile?.decade || "";
  const userTheme = eraTheme(userDecade);
  const showEraToggle = !!userTheme && userDecade !== DEFAULT_DECADE;
  const active = useEra && userTheme ? userTheme : DEFAULT_THEME;

  // session history for stats + chains
  useEffect(() => {
    let alive = true;
    getSessions()
      .then((s) => alive && setSessions(s))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  // wash the page in the active theme (the user's era by default, the neutral 00s when toggled off)
  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement.style;
    const apply = (t) => {
      root.setProperty("--page-deep", t.deep);
      root.setProperty("--page-deep2", t.deep2);
      root.setProperty("--page-accent-rgb", t.accentRgb);
    };
    apply(active);
    return () => apply(DEFAULT_THEME);
  }, [active]);

  // local accent for tile touches, following the active theme
  const accentVars = { "--pa": `rgb(${active.accentRgb})`, "--pa-rgb": active.accentRgb };

  const fp = {
    genres: genreMap(profile?.known_songs),
    eras: eraSpread(profile?.known_songs),
    rare: rarestFind(profile?.known_songs),
    tot: totals(profile?.known_songs, sessions),
    badges: badges(profile?.known_songs, sessions),
  };

  return (
    <div className={styles.page} style={accentVars}>
      {/* greeting */}
      <div className={styles.headRow}>
        <div>
          <div className={styles.wordmark}>Echoes</div>
          <span className={styles.kicker}>{name ? "Welcome back" : "Your music world"}</span>
          <h1 className={styles.greeting}>
            {name ? (
              <>
                Hey <span className={styles.brandText}>{name}</span>
              </>
            ) : (
              <span className={styles.brandText}>Your world</span>
            )}
          </h1>
        </div>
        <div className={styles.headActions}>
          {showEraToggle && (
            <button
              className={styles.colorToggle}
              onClick={() => setUseEra((v) => !v)}
              title="Switch between the default theme and your era's colours"
            >
              <Sparkles size={14} /> Theme: {useEra ? ERAS[userDecade].label : "Default"}
            </button>
          )}
          <button className={styles.resetBtn} onClick={() => setConfirmReset(true)}>
            <RotateCcw size={14} /> Start over
          </button>
        </div>
      </div>

      {/* tabs */}
      <div className={styles.tabs}>
        {TABS.map((t) => (
          <button
            key={t}
            className={`${styles.tab} ${tab === t ? styles.tabOn : ""} ${
              t === "Play" && tab !== "Play" ? styles.tabPlay : ""
            }`}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      {/* first-run helper: points new users to the two games behind Play.
          Hidden once they're on Play (the cards speak for themselves there). */}
      <AnimatePresence>
        {showTour && tab !== "Play" && (
          <motion.div
            className={styles.tour}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            <button className={styles.tourClose} onClick={dismissTour} aria-label="Dismiss">
              ×
            </button>
            <div className={styles.tourIcon} aria-hidden>
              <Compass size={18} />
            </div>
            <div className={styles.tourBody}>
              <div className={styles.tourTitle}>New here? Start in Play</div>
              <p className={styles.tourText}>
                Two ways in. <strong>Artist Deep Dive</strong> goes deep on an artist you already
                love. <strong>Taste Match</strong> chases one song&rsquo;s vibe across the whole map.
              </p>
              <div className={styles.tourActions}>
                <button
                  className={styles.tourGo}
                  onClick={() => {
                    setTab("Play");
                    dismissTour();
                  }}
                >
                  <Play size={14} /> Take me to Play
                </button>
                <button className={styles.tourSkip} onClick={dismissTour}>
                  Maybe later
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        >
          {tab === "Your World" && (
            <YourWorld
              art={art}
              artistName={artistName}
              albumName={albumName}
              albumArtist={art?.albumArtist || ""}
              onInfo={setInfo}
            />
          )}
          {tab === "Play" && <div className={styles.playWrap}>{play}</div>}
          {tab === "Stats" && (
            <StatsTab fp={fp} profile={profile} sessions={sessions} onMatchFrom={onMatchFrom} />
          )}
        </motion.div>
      </AnimatePresence>

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

      {info && (
        <InfoSheet
          info={info}
          onClose={() => setInfo(null)}
          onMatchFrom={onMatchFrom}
          onMatchSeed={onMatchSeed}
          onDeepDive={onDeepDive}
        />
      )}
    </div>
  );
}

/* ---------- Your World: the art wall ---------- */

function gradientFor(seed = "") {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360;
  return `linear-gradient(135deg, hsl(${h},45%,40%), hsl(${(h + 40) % 360},50%,28%))`;
}

function YourWorld({ art, artistName, albumName, albumArtist, onInfo }) {
  const songs = art?.songs || [];
  return (
    <div className={styles.world}>
      <button
        className={`${styles.tile} ${styles.artistTile}`}
        onClick={() => artistName && onInfo({ type: "artist", title: artistName })}
      >
        <div
          className={styles.tileArt}
          style={{ background: art?.artist ? `url(${art.artist}) center/cover` : gradientFor(artistName) }}
        />
        <div className={styles.tileScrim} />
        <div className={styles.tileMeta}>
          <span className={styles.tileKicker}>Favourite artist</span>
          <span className={styles.tileTitle}>{artistName}</span>
        </div>
        <span className={styles.infoDot} aria-hidden>i</span>
      </button>

      {albumName && (
        <button
          className={`${styles.tile} ${styles.albumTile}`}
          onClick={() =>
            onInfo({
              type: "album",
              title: albumName,
              album: albumName,
              artists: [albumArtist, artistName].filter(Boolean),
            })
          }
        >
          <div
            className={styles.tileArt}
            style={{ background: art?.album ? `url(${art.album}) center/cover` : gradientFor(albumName) }}
          />
          <div className={styles.tileScrim} />
          <div className={styles.tileMeta}>
            <span className={styles.tileKicker}>Favourite album</span>
            <span className={styles.tileTitle}>{albumName}</span>
          </div>
          <span className={styles.infoDot} aria-hidden>i</span>
        </button>
      )}

      {songs.length > 0 && (
        <div className={styles.songRow}>
          {songs.map((s, i) => (
            <button
              key={`${s.title}-${i}`}
              className={styles.songCard}
              onClick={() => onInfo({ type: "song", title: s.title })}
            >
              <div
                className={styles.songArt}
                style={{ background: s.art ? `url(${s.art}) center/cover` : gradientFor(s.title) }}
              />
              <span className={styles.songKicker}>Song {i + 1}</span>
              <span className={styles.songLabel}>{s.title}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Wikipedia title candidates for an artist / album / song.
function variantsFor(info) {
  const { type, title, album, artists = [] } = info;
  if (type === "album") {
    const v = [album, `${album} (album)`];
    for (const a of artists) v.push(`${album} (${a} album)`);
    return [...new Set(v)];
  }
  if (type === "song") return [title, `${title} (song)`];
  return [title, `${title} (band)`, `${title} (musician)`];
}

// A Wikipedia summary sheet for an artist / album / song. Tries title variants,
// skips disambiguation pages, shows the extract + a link to the full article.
// For an album it also lists the tracks, each with a Match button.
function InfoSheet({ info, onClose, onMatchFrom, onMatchSeed, onDeepDive }) {
  const [data, setData] = useState(undefined); // undefined = loading, null = none
  const [tracks, setTracks] = useState(null); // album tracklist (null = loading)

  useEffect(() => {
    let alive = true;
    setData(undefined);
    (async () => {
      // Songs and albums come from iTunes + Last.fm (Wikipedia title-guessing is
      // wrong for common titles like "Temperature" / "Polly" / "Revolver", which
      // resolve to the physics / name / firearm articles). Artists stay on Wiki.
      if (info.type === "song") {
        const s = await songInfo(info.title, info.artist).catch(() => null);
        if (alive) setData(s && s.extract ? s : null);
        return;
      }
      if (info.type === "album") {
        const a = await albumInfo(info.album || info.title, info.artists || []).catch(() => null);
        if (alive) setData(a && a.extract ? a : null);
        return;
      }
      for (const v of variantsFor(info)) {
        try {
          const r = await fetch(`/api/wiki?title=${encodeURIComponent(v)}`);
          const d = await r.json();
          if (d && !d.missing && d.type !== "disambiguation" && d.extract) {
            if (alive)
              setData({
                extract: d.extract,
                thumb: d.thumbnail?.source || null,
                url:
                  d.content_urls?.desktop?.page ||
                  `https://en.wikipedia.org/wiki/${encodeURIComponent(v.replace(/ /g, "_"))}`,
              });
            return;
          }
        } catch {
          /* try next variant */
        }
      }
      if (alive) setData(null);
    })();
    return () => {
      alive = false;
    };
  }, [info]);

  // album tracklist (try each candidate artist until one returns tracks)
  useEffect(() => {
    if (info.type !== "album") return;
    let alive = true;
    setTracks(null);
    (async () => {
      for (const a of info.artists || []) {
        const list = await albumTracks(a, info.album).catch(() => []);
        if (list.length) {
          if (alive) setTracks(list);
          return;
        }
      }
      if (alive) setTracks([]);
    })();
    return () => {
      alive = false;
    };
  }, [info]);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const searchUrl = `https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(info.title)}`;

  return (
    <div className={styles.sheetBackdrop} onClick={onClose}>
      <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
        <button className={styles.sheetClose} onClick={onClose} aria-label="Close">
          ×
        </button>
        <h3 className={styles.sheetTitle}>{info.title}</h3>

        {info.type === "song" && onMatchSeed && (
          <div className={styles.sheetActions}>
            <button
              className={styles.sheetAction}
              onClick={() => {
                onMatchSeed(info.title);
                onClose();
              }}
            >
              ▶ Play Taste Match from this song
            </button>
          </div>
        )}
        {info.type === "artist" && onDeepDive && (
          <div className={styles.sheetActions}>
            <button
              className={styles.sheetAction}
              onClick={() => {
                onDeepDive(info.title);
                onClose();
              }}
            >
              ▶ Deep dive into {info.title}
            </button>
          </div>
        )}

        {data === undefined && <p className={styles.sheetBody}>Loading…</p>}
        {data === null && (
          <p className={styles.sheetBody}>
            No quick summary found.{" "}
            <a className={styles.sheetLink} href={searchUrl} target="_blank" rel="noreferrer">
              Search Wikipedia ↗
            </a>
          </p>
        )}
        {data && (
          <>
            {data.thumb && (
              <div className={styles.sheetThumb} style={{ backgroundImage: `url(${data.thumb})` }} />
            )}
            <p className={styles.sheetBody}>{data.extract}</p>
            {data.url && (
              <a className={styles.sheetLink} href={data.url} target="_blank" rel="noreferrer">
                {info.type === "artist" ? "Read more on Wikipedia ↗" : "More on Last.fm ↗"}
              </a>
            )}
          </>
        )}

        {info.type === "album" && (
          <div className={styles.trackBlock}>
            <div className={styles.trackHead}>Tracks</div>
            {tracks === null && <p className={styles.sheetBody}>Loading tracks…</p>}
            {tracks && tracks.length === 0 && (
              <p className={styles.sheetBody}>No tracklist available.</p>
            )}
            {tracks && tracks.length > 0 && (
              <ul className={styles.trackList}>
                {tracks.map((t, i) => (
                  <li key={`${t.track}-${i}`} className={styles.trackRow}>
                    <span className={styles.trackName}>
                      <span className={styles.trackNum}>{i + 1}</span>
                      {t.track}
                    </span>
                    {onMatchFrom && (
                      <button
                        className={styles.trackMatch}
                        onClick={() => {
                          onMatchFrom({ track: t.track, artist: t.artist });
                          onClose();
                        }}
                        title={`Start a Taste Match from ${t.track}`}
                      >
                        Match
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Stats tab: fingerprint + library ---------- */

function StatsTab({ fp, profile, sessions, onMatchFrom }) {
  const { genres, eras, rare, tot, badges: earned } = fp;
  const known = (profile?.known_songs || []).filter((k) => k && typeof k === "object" && k.track);
  const saved = (profile?.saved_songs || []).filter((k) => k && typeof k === "object" && k.track);
  const chains = sessions.filter((s) => (s.chain || []).length > 0);
  const [lib, setLib] = useState("Known");
  const [playingId, setPlayingId] = useState(null);
  const audioRef = useRef(null);

  useEffect(() => () => audioRef.current?.pause?.(), []);

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

  if (tot.songs === 0) {
    return (
      <p className={styles.empty}>
        Discover a few songs and your taste fingerprint appears here: your genres, the eras you
        explore, your rarest finds, and badges you earn.
      </p>
    );
  }

  const gMax = Math.max(1, ...genres.map((g) => g.count));
  const eMax = Math.max(1, ...eras.map((e) => e.count));
  const libList = lib === "Known" ? known : saved;

  return (
    <div className={styles.stats}>
      <div className={styles.totals}>
        <Stat n={tot.songs} label="discovered" />
        <Stat n={tot.artists} label="artists" />
        <Stat n={tot.sessions} label="sessions" />
        <Stat n={tot.longestChain} label="longest chain" />
      </div>

      <div className={styles.statCols}>
        {genres.length > 0 && (
          <div className={styles.statBlock}>
            <div className={styles.statHead}>Top genres</div>
            {genres.map((g) => (
              <Bar key={g.tag} label={g.tag} value={g.count} max={gMax} />
            ))}
          </div>
        )}
        {eras.length > 0 && (
          <div className={styles.statBlock}>
            <div className={styles.statHead}>Era spread</div>
            {eras.map((e) => (
              <Bar key={e.decade} label={e.decade} value={e.count} max={eMax} />
            ))}
          </div>
        )}
      </div>

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

      {/* library */}
      <div className={styles.statBlock}>
        <div className={styles.libTabs}>
          {["Known", "Saved", "Chains"].map((l) => (
            <button
              key={l}
              className={`${styles.libTab} ${lib === l ? styles.libTabOn : ""}`}
              onClick={() => setLib(l)}
            >
              {l}
              {l === "Known" && known.length > 0 ? ` ${known.length}` : ""}
              {l === "Saved" && saved.length > 0 ? ` ${saved.length}` : ""}
            </button>
          ))}
        </div>

        {lib === "Chains" ? (
          chains.length === 0 ? (
            <p className={styles.empty}>Your discovery chains from each session collect here.</p>
          ) : (
            <div className={styles.chainList}>
              {chains
                .slice()
                .reverse()
                .map((s) => (
                  <div key={s.id} className={styles.chainCard}>
                    <div className={styles.chainMode}>
                      {s.mode === "taste_match" ? "Taste Match" : "Artist Deep Dive"} ·{" "}
                      {s.chain.length} songs
                    </div>
                    <div className={styles.chainSeq}>{s.chain.join("  →  ")}</div>
                  </div>
                ))}
            </div>
          )
        ) : libList.length === 0 ? (
          <p className={styles.empty}>
            {lib === "Known"
              ? "Songs you mark as known show up here, playable and ready to match from."
              : "Songs you save for later land here, ready to play and match from."}
          </p>
        ) : (
          <div className={styles.discList}>
            {libList
              .slice()
              .reverse()
              .map((k) => (
                <div key={k.id} className={styles.discRow}>
                  <div
                    className={styles.discThumb}
                    style={{
                      background: k.albumArt
                        ? `url(${k.albumArt}) center/cover`
                        : gradientFor(k.track),
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
                        onClick={() => togglePlay(k)}
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
                        onClick={() => onMatchFrom({ track: k.track, artist: k.artist })}
                        title="Start a Taste Match from this song"
                      >
                        Match
                      </button>
                    )}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      <audio ref={audioRef} onEnded={() => setPlayingId(null)} hidden />
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

function Bar({ label, value, max }) {
  return (
    <div className={styles.bar}>
      <span className={styles.barLabel}>{label}</span>
      <span className={styles.barTrack}>
        <span className={styles.barFill} style={{ width: `${(value / max) * 100}%` }} />
      </span>
      <span className={styles.barVal}>{value}</span>
    </div>
  );
}
