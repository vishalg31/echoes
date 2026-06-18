"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import OnboardingQuiz from "@/components/onboarding/OnboardingQuiz";
import ThemeReveal from "@/components/reveal/ThemeReveal";
import GameScreen from "@/components/game/GameScreen";
import ProfileCard from "@/components/profile/ProfileCard";
import { loadProfileFromUrl, loadProfileFromCookie, clearProfile } from "@/lib/storage";
import { getProfile, saveProfileDb, clearAll, upsertSession } from "@/lib/db";
import { resolveTheme, applyTheme } from "@/lib/themes";

export default function Home() {
  const [phase, setPhase] = useState("loading"); // loading | onboarding | reveal | game
  const [profile, setProfile] = useState(null);
  const [showProfile, setShowProfile] = useState(false);
  const [seedRequest, setSeedRequest] = useState(null); // {track, artist} from Discoveries → Match

  // hydrate on mount: shared URL first, then local Dexie store, then a one-time
  // import of any legacy cookie profile so existing users don't lose anything.
  useEffect(() => {
    let alive = true;
    (async () => {
      const fromUrl = loadProfileFromUrl();
      let existing = fromUrl;
      if (!existing) existing = await getProfile();
      if (!existing) {
        const fromCookie = loadProfileFromCookie();
        if (fromCookie && fromCookie.favourite_artist) {
          await saveProfileDb(fromCookie); // migrate cookie → Dexie once
          clearProfile();
          existing = fromCookie;
        }
      }
      if (!alive) return;
      if (existing && existing.favourite_artist) {
        setProfile(existing);
        resolveTheme(existing).then(applyTheme).catch(() => {});
        setPhase("game"); // returning user / shared link → straight to game
      } else {
        setPhase("onboarding");
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  function handleQuizComplete(p) {
    setProfile(p);
    saveProfileDb(p);
    setPhase("reveal");
  }

  function handleKnowSong(entry) {
    // entry = { id, track, artist, year?, album?, albumArt?, tags?, listeners? }
    setProfile((prev) => {
      if (!prev) return prev;
      const list = prev.known_songs || [];
      const exists = list.some((k) => (typeof k === "string" ? k : k.id) === entry.id);
      const known = exists ? list : [...list, entry];
      const next = { ...prev, known_songs: known };
      saveProfileDb(next);
      return next;
    });
  }

  // toggle a song in the "save for later" queue (mirrors known_songs shape)
  function handleSaveSong(entry) {
    setProfile((prev) => {
      if (!prev) return prev;
      const list = prev.saved_songs || [];
      const exists = list.some((k) => (typeof k === "string" ? k : k.id) === entry.id);
      const saved = exists
        ? list.filter((k) => (typeof k === "string" ? k : k.id) !== entry.id)
        : [...list, entry];
      const next = { ...prev, saved_songs: saved };
      saveProfileDb(next);
      return next;
    });
  }

  function handleSession(session) {
    upsertSession(session);
  }

  function handleReset() {
    clearAll();
    clearProfile(); // also drop any legacy cookie
    setProfile(null);
    setShowProfile(false);
    // clear any ?profile= from the URL
    if (typeof window !== "undefined") window.history.replaceState({}, "", window.location.pathname);
    setPhase("onboarding");
  }

  return (
    <AnimatePresence mode="wait">
      {phase === "loading" && (
        <motion.div key="loading" style={{ minHeight: "100vh" }} {...PAGE_FADE} />
      )}

      {phase === "onboarding" && (
        <motion.div key="onboarding" {...PAGE_FADE}>
          <OnboardingQuiz onComplete={handleQuizComplete} />
        </motion.div>
      )}

      {phase === "reveal" && (
        <motion.div key="reveal" {...PAGE_FADE}>
          <ThemeReveal profile={profile} onComplete={() => setPhase("game")} />
        </motion.div>
      )}

      {phase === "game" && (
        <motion.div key="game" {...PAGE_FADE}>
          <GameScreen
            profile={profile}
            onKnowSong={handleKnowSong}
            onSaveSong={handleSaveSong}
            onSession={handleSession}
            onShowProfile={() => setShowProfile(true)}
            onReset={handleReset}
            seedRequest={seedRequest}
            onSeedConsumed={() => setSeedRequest(null)}
          />
          {showProfile && (
            <ProfileCard
              profile={profile}
              onClose={() => setShowProfile(false)}
              onReset={handleReset}
              onMatchFrom={(seed) => {
                setShowProfile(false);
                setSeedRequest(seed);
              }}
            />
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

const PAGE_FADE = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.4, ease: "easeInOut" },
};
