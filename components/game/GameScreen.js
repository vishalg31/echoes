"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from "framer-motion";
import { Play, Pause, X, Star, RotateCw, ChevronLeft, Share2, Check, Bookmark, Trophy } from "lucide-react";
import SearchInput from "./SearchInput";
import SongCard from "./SongCard";
import TellMeMoreDrawer from "./TellMeMoreDrawer";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import Equalizer from "@/components/ui/Equalizer";
import Counter from "@/components/ui/Counter";
import Marquee from "@/components/ui/Marquee";
import ProfilePage from "@/components/profile/ProfilePage";
import { recommendTasteMatch, recommendDeepDive, songId } from "@/lib/recommend";
import { searchTracks, profileArt } from "@/lib/api";
import { buildShareUrl as buildProfileUrl } from "@/lib/storage";
import { resolveTheme } from "@/lib/themes";
import { paletteFromImage } from "@/lib/palette";
import styles from "./GameScreen.module.css";

const PAGE_DEEP_DEFAULT = "#15101f";
const PAGE_DEEP2_DEFAULT = "#1c1530";
const PAGE_ACCENT_RGB_DEFAULT = "155, 60, 140"; // plum, matches globals.css

// signature spring (matches the IPL trump-card feel) + stagger variants
const MODE_SPRING = { type: "spring", stiffness: 230, damping: 22 };
const MODE_GRID_VARIANTS = { hidden: {}, show: { transition: { staggerChildren: 0.12 } } };
const MODE_CARD_VARIANTS = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 140, damping: 18 } },
};

// chain-length milestones → a quiet celebratory toast when you hit one
const CHAIN_MILESTONES = {
  3: { title: "3 in a row", sub: "Your chain is forming" },
  5: { title: "5-song chain", sub: "Now you're digging" },
  10: { title: "Double digits", sub: "10 songs deep" },
  15: { title: "15 and counting", sub: "Serious crate work" },
  20: { title: "20-song chain", sub: "Unstoppable" },
  25: { title: "25 deep", sub: "Certified explorer" },
};

// Paint the page background from a song's album-art mood (or reset to base).
function applyPageMood(mood) {
  if (typeof document === "undefined") return;
  const root = document.documentElement.style;
  root.setProperty("--page-deep", mood ? mood.deep : PAGE_DEEP_DEFAULT);
  root.setProperty("--page-deep2", mood ? mood.deep2 : PAGE_DEEP2_DEFAULT);
  root.setProperty("--page-accent-rgb", mood ? mood.accentRgb : PAGE_ACCENT_RGB_DEFAULT);
  if (mood) root.setProperty("--page-accent", mood.accent);
}

export default function GameScreen({
  profile,
  onKnowSong,
  onSaveSong,
  onSession,
  onReset,
  seedRequest,
  onSeedConsumed,
}) {
  const [mode, setMode] = useState(null); // null | taste_match | artist_deep_dive
  const [input, setInput] = useState(null); // {artist, track?}
  const [round, setRound] = useState(0);
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [chain, setChain] = useState([]); // [{track, artist}]
  const [known, setKnown] = useState(
    new Set((profile?.known_songs || []).map((k) => (typeof k === "string" ? k : k.id)))
  );
  const [saved, setSaved] = useState(
    new Set((profile?.saved_songs || []).map((k) => (typeof k === "string" ? k : k.id)))
  );
  const [drawerCard, setDrawerCard] = useState(null);
  const [copied, setCopied] = useState(false);
  const [winnerId, setWinnerId] = useState(null);
  const [themeLabel, setThemeLabel] = useState("");
  const [nowPlaying, setNowPlaying] = useState(null); // the card whose preview is loaded
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [confirm, setConfirm] = useState(null); // { title, message, confirmLabel, onConfirm }
  const [toast, setToast] = useState(null); // { id, title, sub } milestone celebration
  const [art, setArt] = useState(null); // profile imagery for the home page
  const isMobile = useIsMobile();

  const playedIds = useRef(new Set());
  const sessionRef = useRef(null); // { id, started_at } for the active session
  const audioRef = useRef(null); // single shared preview player

  // ---------- playback (one controller for the whole screen) ----------
  function togglePlay(card) {
    if (!card?.previewUrl) return;
    const el = audioRef.current;
    if (!el) return;
    if (nowPlaying?.id === card.id) {
      if (playing) el.pause();
      else el.play().catch(() => {});
      return;
    }
    setNowPlaying(card);
    el.src = card.previewUrl;
    el.currentTime = 0;
    el.play().catch(() => {});
  }

  function stopPlayback() {
    audioRef.current?.pause?.();
    setNowPlaying(null);
    setPlaying(false);
    setProgress(0);
  }

  // page background follows the now-playing song, or the round's top pick
  useEffect(() => {
    let alive = true;
    const hero = nowPlaying || candidates[0];
    if (hero?.albumArt) {
      paletteFromImage(hero.albumArt).then((m) => alive && applyPageMood(m));
    } else {
      applyPageMood(null);
    }
    return () => {
      alive = false;
    };
  }, [nowPlaying, candidates]);

  // reset the page tint when leaving the game
  useEffect(() => () => applyPageMood(null), []);

  function genSessionId() {
    return typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `s_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  }

  // upsert the current session (one growing row) into Dexie via page.js
  function saveSession(m, chainArr) {
    if (!sessionRef.current) return;
    onSession?.({
      id: sessionRef.current.id,
      started_at: sessionRef.current.started_at,
      mode: m,
      chain: chainArr.map((c) => c.track),
      rounds_played: chainArr.length,
    });
  }

  // resolve the user's era/theme name once, for the home hub
  useEffect(() => {
    let alive = true;
    resolveTheme(profile)
      .then((t) => alive && setThemeLabel(t?.label || ""))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [profile]);

  // load imagery for the home profile page (artist photo, album, song covers)
  useEffect(() => {
    let alive = true;
    profileArt(profile)
      .then((a) => alive && setArt(a))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [profile]);

  // "Match from this" in the profile Discoveries tab seeds a fresh Taste Match
  useEffect(() => {
    if (!seedRequest) return;
    startTaste({ track: seedRequest.track, artist: seedRequest.artist });
    onSeedConsumed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedRequest]);

  // ---------- round loaders ----------
  async function loadTasteRound(nextInput) {
    setLoading(true);
    try {
      const { candidates: cands, fallbackLog } = await recommendTasteMatch(
        nextInput,
        profile,
        playedIds.current
      );
      cands.forEach((c) => playedIds.current.add(c.id));
      if (fallbackLog.length) console.log("[Echoes fallback]", fallbackLog);
      setCandidates(cands);
    } finally {
      setLoading(false);
    }
  }

  async function loadDeepRound(artist) {
    setLoading(true);
    try {
      const { candidates: cands, fallbackLog } = await recommendDeepDive(
        artist,
        profile,
        playedIds.current
      );
      cands.forEach((c) => playedIds.current.add(c.id));
      if (fallbackLog.length) console.log("[Echoes fallback]", fallbackLog);
      setCandidates(cands);
    } finally {
      setLoading(false);
    }
  }

  // ---------- starts ----------
  async function startTaste(trackObj) {
    const inp = { artist: trackObj.artist, track: trackObj.track };
    setMode("taste_match");
    setInput(inp);
    setChain([{ track: inp.track, artist: inp.artist }]);
    setRound(1);
    playedIds.current = new Set();
    playedIds.current.add(songId(inp.artist, inp.track));
    sessionRef.current = { id: genSessionId(), started_at: Date.now() };
    saveSession("taste_match", [{ track: inp.track, artist: inp.artist }]);
    await loadTasteRound(inp);
  }

  async function startTasteFromSeed(seedTitle) {
    // resolve a bare title to {track, artist} via Last.fm search
    const res = await searchTracks(seedTitle, 1).catch(() => []);
    if (res[0]) return startTaste({ track: res[0].track, artist: res[0].artist });
    // last resort: treat the seed as both
    return startTaste({ track: seedTitle, artist: profile.favourite_artist });
  }

  async function startDeep(artist) {
    setMode("artist_deep_dive");
    setInput({ artist });
    setChain([]);
    setRound(1);
    playedIds.current = new Set();
    sessionRef.current = { id: genSessionId(), started_at: Date.now() };
    await loadDeepRound(artist);
  }

  // ---------- actions ----------
  function handleKnow(card) {
    setKnown((prev) => {
      const next = new Set(prev);
      next.add(card.id);
      return next;
    });
    onKnowSong?.({
      id: card.id,
      track: card.track,
      artist: card.artist,
      year: card.year || "",
      album: card.album || "",
      albumArt: card.albumArt || null,
      previewUrl: card.previewUrl || null,
      tags: card.tags || [],
      listeners: card.listeners ?? null,
    });
  }

  // toggle "save for later" — a personal queue of songs to revisit
  function handleSave(card) {
    setSaved((prev) => {
      const next = new Set(prev);
      if (next.has(card.id)) next.delete(card.id);
      else next.add(card.id);
      return next;
    });
    onSaveSong?.({
      id: card.id,
      track: card.track,
      artist: card.artist,
      year: card.year || "",
      album: card.album || "",
      albumArt: card.albumArt || null,
      previewUrl: card.previewUrl || null,
      tags: card.tags || [],
      listeners: card.listeners ?? null,
    });
  }

  // add the chosen card to the chain and load the next set
  async function advanceRound(card) {
    handleKnow(card); // a winner you picked counts as a song you know
    const nextChain = [...chain, { track: card.track, artist: card.artist }];
    setChain(nextChain);
    setRound((r) => r + 1);
    saveSession(mode, nextChain);
    const milestone = CHAIN_MILESTONES[nextChain.length];
    if (milestone) setToast({ id: Date.now(), ...milestone });
    if (mode === "taste_match") {
      const inp = { artist: card.artist, track: card.track };
      setInput(inp);
      await loadTasteRound(inp);
    } else {
      await loadDeepRound(input.artist);
    }
  }

  // desktop / drawer: play the ⭐ flourish on the chosen card, then advance
  async function handlePick(card) {
    if (winnerId) return; // guard against double-pick during the flourish
    setWinnerId(card.id);
    await new Promise((r) => setTimeout(r, 750));
    setWinnerId(null);
    await advanceRound(card);
  }

  async function reroll() {
    if (loading || winnerId) return;
    if (mode === "taste_match") await loadTasteRound(input);
    else await loadDeepRound(input.artist);
  }

  function backToModes() {
    stopPlayback();
    setMode(null);
    setCandidates([]);
    setChain([]);
    setRound(0);
    playedIds.current = new Set();
  }

  // stop the preview if its card is no longer on screen (new round / re-roll)
  useEffect(() => {
    if (nowPlaying && !candidates.some((c) => c.id === nowPlaying.id)) stopPlayback();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidates]);

  // desktop: once all 3 are handled (known or saved) and none picked, auto-deal
  // a fresh set so there's no dead-end. Mobile's deck handles this itself.
  useEffect(() => {
    if (isMobile || loading || winnerId || candidates.length === 0) return;
    const allHandled = candidates.every((c) => known.has(c.id) || saved.has(c.id));
    if (!allHandled) return;
    const t = setTimeout(() => reroll(), 750);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidates, known, saved, isMobile, loading, winnerId]);

  // Echoes wordmark = home. Mid-mode it confirms before clearing the chain.
  function handleHome() {
    if (!mode) return; // already on the home (mode-select) screen
    setConfirm({
      title: "Leave this run?",
      message: "This clears your current chain and returns you to the home screen.",
      confirmLabel: "Leave run",
      onConfirm: () => {
        setConfirm(null);
        backToModes();
      },
    });
  }

  function copyChain() {
    const txt = chain.map((c) => c.track).join(" → ");
    const url = buildProfileUrl(profile);
    navigator.clipboard
      ?.writeText(`My Echoes chain: ${txt}\n${url}`)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {});
  }

  // ---------- render: home = profile page ----------
  if (!mode) {
    return (
      <>
        <div className="pageTexture" />
        <main className={styles.screen}>
          <div className={styles.inner}>
            <ProfilePage
              profile={profile}
              themeLabel={themeLabel}
              art={art}
              onReset={onReset}
              onMatchFrom={(seed) => startTaste(seed)}
              play={
                <>
                  <div className={styles.modeIntro}>
                    <h1>How do you want to explore?</h1>
                    <p>
                      Two ways in. Go deep on an artist you already love, or chase the vibe of a
                      single song across the whole map.
                    </p>
                  </div>
                  <motion.div
                    className={styles.modeGrid}
                    variants={MODE_GRID_VARIANTS}
                    initial="hidden"
                    animate="show"
                  >
                    <DeepDiveCard profile={profile} onStart={startDeep} />
                    <TasteMatchCard
                      profile={profile}
                      onStartTrack={startTaste}
                      onStartSeed={startTasteFromSeed}
                    />
                  </motion.div>
                </>
              }
            />
          </div>
        </main>
        {confirm && <ConfirmDialog {...confirm} onCancel={() => setConfirm(null)} />}
      </>
    );
  }

  // ---------- render: rounds ----------
  const seedLabel =
    mode === "taste_match"
      ? input?.track
        ? `Matching the vibe of “${input.track}” by ${input.artist}`
        : ""
      : `Digging into ${input?.artist}`;

  return (
    <>
      <div className="pageTexture" />
      <main className={styles.screen}>
        <div className={styles.inner}>
          <Topbar onHome={handleHome} knownCount={known.size} savedCount={saved.size} />

          <div className={styles.roundHead}>
            <span className={styles.eyebrow}>Round {round}</span>
            <h1>{mode === "taste_match" ? "Taste Match" : "Artist Deep Dive"}</h1>
            <p className={styles.seed}>{seedLabel}</p>
          </div>

          {!loading && candidates.length === 0 ? (
            <div className={styles.emptyState}>
              <h2>You&rsquo;ve explored everything here.</h2>
              <p>
                That&rsquo;s a deep run. Start a fresh dive or switch to Taste Match to keep the
                chain going.
              </p>
              <button className={styles.startBtn} onClick={backToModes} style={{ maxWidth: 260 }}>
                <ChevronLeft size={16} /> Back to modes
              </button>
            </div>
          ) : loading ? (
            <div className={styles.cardGrid}>
              {[0, 1, 2].map((i) => (
                <div key={i} className={styles.loadCard} />
              ))}
            </div>
          ) : isMobile ? (
            <CardDeck
              candidates={candidates}
              known={known}
              saved={saved}
              onKnow={handleKnow}
              onToggleSave={handleSave}
              onTellMore={setDrawerCard}
              onWinner={advanceRound}
              onNeedMore={reroll}
              nowPlayingId={playing ? nowPlaying?.id : null}
              onTogglePlay={togglePlay}
            />
          ) : (
            <motion.div
              className={styles.cardGrid}
              variants={MODE_GRID_VARIANTS}
              initial="hidden"
              animate="show"
              key={candidates.map((c) => c.id).join("|")}
            >
              {candidates.map((c) => (
                <motion.div key={c.id} variants={MODE_CARD_VARIANTS}>
                  <SongCard
                    card={c}
                    known={known.has(c.id)}
                    isSaved={saved.has(c.id)}
                    isWinner={winnerId === c.id}
                    dimmed={winnerId && winnerId !== c.id}
                    isPlaying={playing && nowPlaying?.id === c.id}
                    onTogglePlay={() => togglePlay(c)}
                    onToggleSave={() => handleSave(c)}
                    onKnow={() => handleKnow(c)}
                    onTellMore={() => setDrawerCard(c)}
                    onPick={() => handlePick(c)}
                  />
                </motion.div>
              ))}
            </motion.div>
          )}

          {!loading && candidates.length > 0 && (
            <div className={styles.roundActions}>
              {candidates.every((c) => known.has(c.id)) && (
                <span className={styles.allKnownHint}>
                  You know all three. Pick a favourite to keep the chain, or get a fresh set.
                </span>
              )}
              <button className={styles.ghostBtn} onClick={reroll} disabled={loading || !!winnerId}>
                <RotateCw size={15} /> Show me 3 new ones
              </button>
            </div>
          )}

          {chain.length > 0 && (
            <div className={styles.chain}>
              <div className={styles.chainHead}>
                <span className={styles.chainLabel}>Your session chain</span>
                <button className={styles.ghostBtn} onClick={copyChain}>
                  {copied ? (
                    <>
                      <Check size={14} /> Copied
                    </>
                  ) : (
                    <>
                      <Share2 size={14} /> Share chain
                    </>
                  )}
                </button>
              </div>
              <div className={styles.chainRow}>
                {chain.map((c, i) => (
                  <span key={`${c.track}-${i}`} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span className={`${styles.chainItem} ${i === chain.length - 1 ? styles.current : ""}`}>
                      {c.track}
                    </span>
                    {i < chain.length - 1 && <span className={styles.chainArrow}>→</span>}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      <audio
        ref={audioRef}
        hidden
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setProgress(0);
        }}
        onTimeUpdate={(e) => {
          const el = e.currentTarget;
          if (el.duration) setProgress(el.currentTime / el.duration);
        }}
      />

      {nowPlaying && (
        <NowPlayingBar
          card={nowPlaying}
          playing={playing}
          progress={progress}
          onToggle={() => togglePlay(nowPlaying)}
          onClose={stopPlayback}
        />
      )}

      {drawerCard && (
        <TellMeMoreDrawer
          card={drawerCard}
          onClose={() => setDrawerCard(null)}
          onLikeWinner={() => {
            handleKnow(drawerCard);
            const c = drawerCard;
            setDrawerCard(null);
            handlePick(c);
          }}
        />
      )}

      <MilestoneToast toast={toast} onDone={() => setToast(null)} />

      {confirm && <ConfirmDialog {...confirm} onCancel={() => setConfirm(null)} />}
    </>
  );
}

/* ---------- small pieces ---------- */

// A quiet celebratory toast for chain milestones. Auto-dismisses; keyed on the
// toast id so a re-render mid-playback (progress ticks) doesn't reset its timer.
function MilestoneToast({ toast, onDone }) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onDone, 2800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast?.id]);
  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          key={toast.id}
          className={styles.toast}
          initial={{ opacity: 0, y: -18, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -12, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 300, damping: 24 }}
        >
          <span className={styles.toastIcon}>
            <Trophy size={18} />
          </span>
          <div>
            <div className={styles.toastTitle}>{toast.title}</div>
            <div className={styles.toastSub}>{toast.sub}</div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Hide the bar when scrolling down, reveal when scrolling up or near the top.
function useHideOnScroll(threshold = 8) {
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);
  useEffect(() => {
    lastY.current = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      const diff = y - lastY.current;
      if (Math.abs(diff) < threshold) return;
      if (y < 80) setHidden(false); // always visible near the top
      else setHidden(diff > 0); // down → hide, up → show
      lastY.current = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);
  return hidden;
}

// true on phone-width screens. SSR-safe: false until mounted, then live.
function useIsMobile(maxWidth = 600) {
  const [m, setM] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${maxWidth}px)`);
    const update = () => setM(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [maxWidth]);
  return m;
}

// dim background for the peeking cards behind the top one
function ghostBg(c) {
  return c?.albumArt
    ? `url(${c.albumArt}) center/cover`
    : "linear-gradient(135deg, var(--accent-soft), var(--card-bg-alt))";
}

// Mobile: a stack of cards. The top card is live and draggable; 1-2 peek behind
// it. Swipe right (or "Pick winner") flings it into the chain and loads the next
// set; swipe left (or "Not for me") passes; "I know this" marks it and advances.
// The buttons drive the same exits as the gestures so both feel identical.
const FLING = 600;
function CardDeck({ candidates, known, saved, onKnow, onToggleSave, onTellMore, onWinner, onNeedMore, nowPlayingId, onTogglePlay }) {
  const [i, setI] = useState(0);
  const busy = useRef(false);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-240, 240], [-13, 13]);
  const pickOp = useTransform(x, [40, 150], [0, 1]);
  const passOp = useTransform(x, [-150, -40], [1, 0]);

  // reset to the first card whenever the set changes (new round / re-roll)
  useEffect(() => {
    setI(0);
    busy.current = false;
    x.set(0);
    y.set(0);
  }, [candidates]);

  const card = candidates[Math.min(i, candidates.length - 1)];
  if (!card) return null;
  const isLast = i >= candidates.length - 1;
  const ghosts = candidates.slice(i + 1, i + 3); // up to 2 behind the top

  function recenter() {
    animate(x, 0, { type: "spring", stiffness: 320, damping: 30 });
    animate(y, 0, { type: "spring", stiffness: 320, damping: 30 });
  }

  // advance to the next card in the set (or ask the parent for a fresh set)
  function advance() {
    if (isLast) {
      onNeedMore(); // reloads the set → effect resets the deck
    } else {
      setI((n) => n + 1);
      x.set(0);
      y.set(0);
      busy.current = false;
    }
  }

  // fling the top card off-screen in a direction, then run `after`
  function fling(dir, after) {
    if (busy.current) return;
    busy.current = true;
    const mv = dir === "down" ? y : x;
    const to = dir === "right" ? FLING : dir === "left" ? -FLING : FLING;
    animate(mv, to, {
      type: "spring",
      stiffness: 220,
      damping: 26,
      velocity: dir === "down" ? 600 : 400,
      onComplete: after,
    });
  }

  function know() {
    onKnow(card);
    fling("left", advance);
  }
  function skip() {
    fling("down", advance); // pass: next card, not marked known
  }
  function winner() {
    fling("right", () => onWinner(card));
  }

  function onDragEnd(_e, info) {
    if (busy.current) return;
    const { offset, velocity } = info;
    if (offset.x > 110 || velocity.x > 700) return winner();
    if (offset.x < -110 || velocity.x < -700) return skip();
    if (offset.y > 170 || velocity.y > 850) return skip();
    recenter();
  }

  return (
    <div className={styles.deck}>
      <div className={styles.deckProgress}>
        {candidates.map((c, idx) => (
          <span
            key={c.id}
            className={`${styles.deckDot} ${idx === i ? styles.deckDotOn : ""} ${
              known.has(c.id) ? styles.deckDotKnown : ""
            }`}
          />
        ))}
        <span className={styles.deckCount}>
          {i + 1} / {candidates.length}
        </span>
      </div>

      <div className={styles.stack}>
        {ghosts
          .map((g, idx) => (
            <div
              key={g.id}
              className={styles.ghost}
              style={{ "--depth": idx + 1, zIndex: 2 - idx }}
            >
              <div className={styles.ghostArt} style={{ background: ghostBg(g) }} />
            </div>
          ))
          .reverse()}

        <motion.div
          key={card.id}
          className={styles.top}
          style={{ x, y, rotate }}
          drag
          dragMomentum={false}
          dragElastic={0.9}
          onDragEnd={onDragEnd}
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 24 }}
        >
          <motion.span className={`${styles.swipeTag} ${styles.swipePick}`} style={{ opacity: pickOp }} aria-hidden>
            Pick
          </motion.span>
          <motion.span className={`${styles.swipeTag} ${styles.swipePass}`} style={{ opacity: passOp }} aria-hidden>
            Pass
          </motion.span>
          <SongCard
            card={card}
            known={known.has(card.id)}
            isSaved={saved?.has(card.id)}
            isPlaying={nowPlayingId === card.id}
            onTogglePlay={() => onTogglePlay(card)}
            onToggleSave={() => onToggleSave(card)}
            onKnow={know}
            onSkip={skip}
            onTellMore={() => onTellMore(card)}
            onPick={winner}
          />
        </motion.div>
      </div>

      <p className={styles.deckHint}>
        Swipe right to pick it, left to pass. Or use the buttons.
      </p>
    </div>
  );
}

// Persistent now-playing strip — the always-there "this is a music app" anchor.
// Tinted live by the playing song's album-art mood (--page-accent).
function NowPlayingBar({ card, playing, progress, onToggle, onClose }) {
  return (
    <div className={styles.nowBar}>
      <div className={styles.nowProgress} style={{ width: `${Math.round((progress || 0) * 100)}%` }} />
      <div
        className={styles.nowArt}
        style={{
          backgroundImage: card.albumArt ? `url(${card.albumArt})` : undefined,
        }}
      >
        {playing && (
          <span className={styles.nowEq}>
            <Equalizer playing />
          </span>
        )}
      </div>
      <div className={styles.nowMeta}>
        <Marquee text={card.track} className={styles.nowTrack} />
        <div className={styles.nowArtist}>{card.artist}</div>
      </div>
      <button className={styles.nowPlay} onClick={onToggle} title={playing ? "Pause" : "Play"}>
        {playing ? (
          <Pause size={16} fill="currentColor" strokeWidth={0} />
        ) : (
          <Play size={16} fill="currentColor" strokeWidth={0} />
        )}
      </button>
      <button className={styles.nowClose} onClick={onClose} title="Stop">
        <X size={15} />
      </button>
    </div>
  );
}

// In-round top bar. The wordmark returns to your profile (confirming first so a
// live chain isn't lost). The known/saved counts are quiet status, not buttons.
function Topbar({ onHome, knownCount = 0, savedCount = 0 }) {
  const hidden = useHideOnScroll();
  return (
    <header className={`${styles.topbar} ${hidden ? styles.topbarHidden : ""}`}>
      <button className={styles.wordmark} onClick={onHome} title="Back to your profile">
        Echoes
      </button>
      <div className={styles.topActions}>
        {knownCount > 0 && (
          <span className={styles.knownChip}>
            <Star size={13} fill="currentColor" strokeWidth={0} /> <Counter value={knownCount} /> known
          </span>
        )}
        {savedCount > 0 && (
          <span className={`${styles.knownChip} ${styles.savedChip}`}>
            <Bookmark size={13} /> <Counter value={savedCount} /> saved
          </span>
        )}
        <button className={styles.ghostBtn} onClick={onHome}>
          <ChevronLeft size={15} /> Profile
        </button>
      </div>
    </header>
  );
}

function DeepDiveCard({ profile, onStart }) {
  const [artist, setArtist] = useState(profile?.favourite_artist || "");
  return (
    <motion.article
      className={styles.modeCard}
      variants={MODE_CARD_VARIANTS}
      whileHover={{ y: -6, scale: 1.012 }}
      transition={MODE_SPRING}
    >
      <div className={styles.modeMotif} aria-hidden>
        <div className={styles.vinyl} />
      </div>
      <span className={styles.modeKicker}>Deep Dive</span>
      <h2>Artist Deep Dive</h2>
      <p className={styles.desc}>
        Lesser-known tracks from an artist you love. We skip the obvious hits and surface the
        deep cuts.
      </p>
      <SearchInput
        kind="artist"
        initial={profile?.favourite_artist || ""}
        placeholder="Search an artist…"
        onSelect={(a) => setArtist(a)}
        onSubmitFree={(a) => setArtist(a)}
      />
      <button
        className={styles.startBtn}
        disabled={!artist.trim()}
        onClick={() => onStart(artist.trim())}
      >
        Dive into {artist || "…"} →
      </button>
    </motion.article>
  );
}

function TasteMatchCard({ profile, onStartTrack, onStartSeed }) {
  const [picked, setPicked] = useState(null); // {track, artist}
  const seed = profile?.top_songs?.[0] || "";

  // resolve the pre-filled seed title to {track, artist} so we can show the artist
  useEffect(() => {
    let alive = true;
    if (!picked && seed) {
      searchTracks(seed, 1)
        .then((r) => {
          if (alive && r[0]) setPicked({ track: r[0].track, artist: r[0].artist });
        })
        .catch(() => {});
    }
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <motion.article
      className={styles.modeCard}
      variants={MODE_CARD_VARIANTS}
      whileHover={{ y: -6, scale: 1.012 }}
      transition={MODE_SPRING}
    >
      <div className={styles.modeMotif} aria-hidden>
        <div className={styles.eqMotif}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <span key={i} style={{ animationDelay: `${i * 0.13}s` }} />
          ))}
        </div>
      </div>
      <span className={styles.modeKicker}>Taste Match</span>
      <h2>Taste Match</h2>
      <p className={styles.desc}>
        Start from one song and chase its mood across different artists. The winner of each
        round seeds the next, endlessly.
      </p>
      <SearchInput
        kind="track"
        initial={seed}
        placeholder="Search a song…"
        onSelect={(t) => setPicked(t)}
      />
      {picked && (
        <p className={styles.seedNote}>
          Starting from <strong>{picked.track}</strong> by {picked.artist}
        </p>
      )}
      <button
        className={styles.startBtn}
        disabled={!picked && !seed}
        onClick={() => (picked ? onStartTrack(picked) : onStartSeed(seed))}
      >
        {picked ? `Match “${picked.track}” by ${picked.artist} →` : seed ? `Match “${seed}” →` : "Match →"}
      </button>
    </motion.article>
  );
}
