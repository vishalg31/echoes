"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { searchArtists, searchTracks } from "@/lib/api";
import styles from "./SearchInput.module.css";

// Autocomplete for "artist" or "track". onSelect returns:
//   kind="artist" → string
//   kind="track"  → { track, artist }
export default function SearchInput({ kind, initial = "", placeholder, onSelect, onSubmitFree, onClear }) {
  const [q, setQ] = useState(initial);
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const timer = useRef(null);
  const inputRef = useRef(null);
  // don't pop the dropdown for the pre-filled value — only once the user types
  const typed = useRef(false);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (!typed.current || !q || q.trim().length < 2) {
      setItems([]);
      return;
    }
    timer.current = setTimeout(async () => {
      try {
        if (kind === "artist") {
          const r = await searchArtists(q, 6);
          setItems(r.map((name) => ({ label: name, value: name })));
        } else {
          const r = await searchTracks(q, 6);
          setItems(r.map((t) => ({ label: `${t.track} · ${t.artist}`, value: t })));
        }
        setOpen(true);
      } catch {
        setItems([]);
      }
    }, 250);
    return () => timer.current && clearTimeout(timer.current);
  }, [q, kind]);

  function pick(item) {
    typed.current = false; // chosen value is committed; don't reopen on its text
    setQ(kind === "artist" ? item.value : item.value.track);
    setItems([]);
    setOpen(false);
    onSelect?.(item.value);
  }

  // wipe the field and any pending selection, then refocus to keep typing
  function clear() {
    typed.current = false;
    setQ("");
    setItems([]);
    setOpen(false);
    onClear?.();
    inputRef.current?.focus();
  }

  function handleKey(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (items.length) pick(items[0]);
      else if (onSubmitFree && q.trim()) onSubmitFree(q.trim());
    }
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.field}>
        <input
          ref={inputRef}
          className={styles.input}
          placeholder={placeholder}
          value={q}
          onChange={(e) => {
            typed.current = true;
            setQ(e.target.value);
          }}
          onKeyDown={handleKey}
          onFocus={() => items.length && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
        />
        {q && (
          <button
            type="button"
            className={styles.clearBtn}
            // onMouseDown so the input's onBlur doesn't fire first and swallow it
            onMouseDown={(e) => e.preventDefault()}
            onClick={clear}
            title="Clear"
            aria-label="Clear search"
          >
            <X size={16} />
          </button>
        )}
      </div>
      {open && items.length > 0 && (
        <ul className={styles.list}>
          {items.map((it, i) => (
            <li key={i}>
              <button className={styles.item} onClick={() => pick(it)}>
                {it.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
