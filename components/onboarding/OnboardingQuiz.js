"use client";

import { useEffect, useRef, useState } from "react";
import { DECADES, emptyProfile } from "@/lib/profile";
import { searchArtists, searchTracks, searchAlbums } from "@/lib/api";
import styles from "./OnboardingQuiz.module.css";

const TOTAL = 5;

// Which live search each step runs (iTunes). Step 0 (name) and step 4 (decade)
// have no search.
function searchKindFor(step) {
  if (step === 1) return "artist";
  if (step === 2) return "track";
  if (step === 3) return "album";
  return null;
}

export default function OnboardingQuiz({ onComplete }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState(emptyProfile());

  // per-question working text (artist / album / song / overrated inputs)
  const [text, setText] = useState("");
  // the value just chosen from the dropdown — suppresses re-searching it
  const [picked, setPicked] = useState("");

  function set(field, value) {
    setAnswers((a) => ({ ...a, [field]: value }));
  }

  // On the songs question, a typed-but-not-yet-added song counts — commit it
  // when the user presses Next so they don't have to press Enter first.
  function commitPendingSong() {
    if (step !== 2) return;
    const clean = text.trim();
    if (!clean || answers.top_songs.length >= 3) return;
    if (answers.top_songs.some((s) => s.toLowerCase() === clean.toLowerCase())) return;
    set("top_songs", [...answers.top_songs, clean]);
  }

  function goNext() {
    commitPendingSong();
    setText("");
    setPicked("");
    if (step < TOTAL - 1) {
      setStep((s) => s + 1);
    } else {
      finish();
    }
  }

  function goBack() {
    setText("");
    setPicked("");
    setStep((s) => Math.max(0, s - 1));
  }

  // album (step 3) is optional — clear it and move on
  function skipAlbum() {
    set("favourite_album", "");
    setText("");
    setPicked("");
    setStep((s) => s + 1);
  }

  function finish() {
    // Theme is derived later (theming step); ship the captured answers as-is.
    const profile = { ...answers };
    onComplete?.(profile);
  }

  // ----- live autocomplete (Last.fm), debounced -----
  // suggestions: [{ label, value }]. label is shown, value is what gets stored.
  const [suggestions, setSuggestions] = useState([]);
  const [searching, setSearching] = useState(false);
  const sugTimer = useRef(null);

  useEffect(() => {
    const kind = searchKindFor(step);
    const q = text.trim();
    if (sugTimer.current) clearTimeout(sugTimer.current);
    // nothing to search, or the text is exactly what was just picked → no dropdown
    if (!kind || q.length < 2 || q === picked.trim()) {
      setSuggestions([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    sugTimer.current = setTimeout(async () => {
      try {
        let list = [];
        if (kind === "artist") {
          const r = await searchArtists(q, 6);
          list = r.map((name) => ({ label: name, value: name }));
        } else if (kind === "track") {
          const r = await searchTracks(q, 6);
          list = r.map((t) => ({ label: `${t.track} · ${t.artist}`, value: t.track }));
        } else if (kind === "album") {
          const r = await searchAlbums(q, 6);
          list = r.map((a) => ({ label: `${a.album} · ${a.artist}`, value: a.album }));
        }
        // collapse duplicate values (e.g. several "Purple Rain" releases) so a
        // pick highlights exactly one chip, not every same-named result
        const seen = new Set();
        list = list.filter((x) => (seen.has(x.value) ? false : seen.add(x.value)));
        setSuggestions(list);
      } catch {
        setSuggestions([]);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => sugTimer.current && clearTimeout(sugTimer.current);
  }, [step, text, picked]);

  // ----- can we advance? -----
  const canAdvance = (() => {
    switch (step) {
      case 0:
        return true; // name is optional
      case 1:
        return answers.favourite_artist.trim().length > 0;
      case 2:
        return answers.top_songs.length > 0 || text.trim().length > 0;
      case 3:
        return true; // album is optional
      case 4:
        return answers.decade.length > 0;
      default:
        return false;
    }
  })();

  const isLast = step === TOTAL - 1;

  // Enter on a text question advances (when the step allows it)
  const onEnterAdvance = () => {
    if (canAdvance) goNext();
  };

  return (
    <div className={styles.screen}>
      <div className={styles.inner}>
        {step === 0 && (
          <div className={styles.brand}>
            <span className={styles.brandMark} aria-hidden>🎸</span>
            <h1 className={styles.brandTitle}>Echoes</h1>
            <p className={styles.brandTagline}>
              A music discovery game shaped by your taste. Answer a few quick questions and
              we&rsquo;ll build you a world to explore.
            </p>
          </div>
        )}
        <div className={styles.progressRow}>
          <span className={styles.progressLabel}>
            Question {step + 1} of {TOTAL}
          </span>
          <div className={styles.progressTrack}>
            <div
              className={styles.progressFill}
              style={{ width: `${((step + 1) / TOTAL) * 100}%` }}
            />
          </div>
        </div>

        {/* key on step so the entrance animation replays each question */}
        <div className={styles.question} key={step}>
          {step === 0 && (
            <TextQuestion
              heading={<>First things first,<br />what should we call you?</>}
              sub="A name or nickname for your profile. You can skip this."
              optional
              placeholder="Your name or nickname…"
              value={answers.name}
              text={text}
              setText={setText}
              suggestions={[]}
              searching={false}
              onPick={(v) => {
                set("name", v);
                setText(v);
                setPicked(v);
              }}
              onType={(v) => {
                setText(v);
                set("name", v);
              }}
              onEnter={onEnterAdvance}
            />
          )}

          {step === 1 && (
            <TextQuestion
              heading={<>Who&rsquo;s your favourite<br />artist or band?</>}
              sub="This tunes your very first set of discoveries, you can explore further later."
              placeholder="Type an artist or band…"
              value={answers.favourite_artist}
              text={text}
              setText={setText}
              suggestions={suggestions}
              searching={searching}
              onPick={(v) => {
                set("favourite_artist", v);
                setText(v);
                setPicked(v);
              }}
              onType={(v) => {
                setText(v);
                set("favourite_artist", v);
              }}
            />
          )}

          {step === 2 && (
            <MultiSongQuestion
              songs={answers.top_songs}
              text={text}
              setText={setText}
              suggestions={suggestions}
              searching={searching}
              onAdd={(v) => {
                const clean = v.trim();
                if (!clean || answers.top_songs.length >= 3) return;
                if (answers.top_songs.some((s) => s.toLowerCase() === clean.toLowerCase())) return;
                set("top_songs", [...answers.top_songs, clean]);
                setText("");
              }}
              onRemove={(i) =>
                set("top_songs", answers.top_songs.filter((_, idx) => idx !== i))
              }
            />
          )}

          {step === 3 && (
            <TextQuestion
              heading={<>What&rsquo;s your<br />favourite album?</>}
              sub="We&rsquo;ll use its cover in your reveal moment and profile card. Skip if none comes to mind."
              optional
              placeholder="Type an album…"
              value={answers.favourite_album}
              text={text}
              setText={setText}
              suggestions={suggestions}
              searching={searching}
              onPick={(v) => {
                set("favourite_album", v);
                setText(v);
                setPicked(v);
              }}
              onType={(v) => {
                setText(v);
                set("favourite_album", v);
              }}
            />
          )}

          {step === 4 && (
            <DecadeQuestion
              selected={answers.decade}
              onSelect={(d) => set("decade", d)}
            />
          )}
        </div>

        <div className={styles.actions}>
          <button className={styles.back} onClick={goBack} disabled={step === 0}>
            ← Back
          </button>
          <div className={styles.rightActions}>
            {step === 3 && (
              <button className={styles.skip} onClick={skipAlbum}>
                Skip
              </button>
            )}
            <button className={styles.next} onClick={goNext} disabled={!canAdvance}>
              {isLast ? "Build my world →" : "Next →"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- sub-components ---------- */

function TextQuestion({ heading, sub, optional, placeholder, text, suggestions, searching, onPick, onType, onEnter }) {
  const inputRef = useRef(null);
  // focus without scrolling, so landing on step 0 keeps the Echoes branding in
  // view instead of jumping the input into focus (autoFocus would scroll).
  useEffect(() => {
    inputRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <>
      <h1 className={styles.heading}>
        {heading}
        {optional && <span className={styles.optionalTag}>optional</span>}
      </h1>
      <p className={styles.sub}>{sub}</p>
      <div className={styles.inputWrap}>
        <input
          ref={inputRef}
          className={styles.input}
          placeholder={placeholder}
          value={text}
          onChange={(e) => onType(e.target.value)}
          onKeyDown={(e) => {
            // Enter advances only where onEnter is wired (name step). Artist /
            // album have no Enter shortcut — pick from the dropdown instead.
            if (e.key === "Enter" && onEnter) {
              e.preventDefault();
              onEnter();
            }
          }}
        />
        {suggestions.length > 0 && (
          <div className={styles.suggestionList}>
            {suggestions.map((s) => (
              <button
                key={s.label}
                className={`${styles.suggestionChip} ${text === s.value ? styles.selected : ""}`}
                onClick={() => onPick(s.value)}
              >
                {s.label}
              </button>
            ))}
          </div>
        )}
        {searching && suggestions.length === 0 && text.trim().length >= 2 && (
          <p className={styles.searchHint}>Searching…</p>
        )}
      </div>
    </>
  );
}

function MultiSongQuestion({ songs, text, setText, suggestions, searching, onAdd, onRemove }) {
  const full = songs.length >= 3;
  return (
    <>
      <h1 className={styles.heading}>
        Three songs<br />you love.
      </h1>
      <p className={styles.sub}>
        These come back to you in your reveal moment. Add up to three. Pick from the list, or type and press Enter.
      </p>

      {songs.length > 0 && (
        <div className={styles.chosenList}>
          {songs.map((s, i) => (
            <span key={s} className={styles.chosenChip}>
              {s}
              <button
                className={styles.chosenRemove}
                onClick={() => onRemove(i)}
                aria-label={`Remove ${s}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <div className={styles.inputWrap}>
        <input
          className={styles.input}
          placeholder={full ? "That's three, nicely done." : "Type a song…"}
          value={text}
          autoFocus
          disabled={full}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onAdd(text);
            }
          }}
        />
        {!full && suggestions.length > 0 && (
          <div className={styles.suggestionList}>
            {suggestions.map((s) => (
              <button
                key={s.label}
                className={styles.suggestionChip}
                onClick={() => onAdd(s.value)}
              >
                {s.label}
              </button>
            ))}
          </div>
        )}
        {!full && searching && suggestions.length === 0 && text.trim().length >= 2 && (
          <p className={styles.searchHint}>Searching…</p>
        )}
        <p className={styles.countHint}>{songs.length} of 3 added</p>
      </div>
    </>
  );
}

function DecadeQuestion({ selected, onSelect }) {
  return (
    <>
      <h1 className={styles.heading}>
        Which decade<br />feels like home?
      </h1>
      <p className={styles.sub}>This shapes your theme and nudges what we surface.</p>
      <div className={styles.decadeGrid}>
        {DECADES.map((d) => (
          <button
            key={d}
            className={`${styles.decadeBtn} ${selected === d ? styles.selected : ""}`}
            onClick={() => onSelect(d)}
          >
            {d}
          </button>
        ))}
      </div>
    </>
  );
}
