"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./Marquee.module.css";

// Scrolls its text only when it would otherwise clip. Short text sits still and
// renders exactly like a normal span; long text loops seamlessly (a duplicate
// copy follows after a gap). Re-measures on text change and resize.
export default function Marquee({ text, className }) {
  const wrapRef = useRef(null);
  const textRef = useRef(null);
  const [over, setOver] = useState(false);

  useEffect(() => {
    const measure = () => {
      const w = wrapRef.current;
      const t = textRef.current;
      if (!w || !t) return;
      setOver(t.scrollWidth > w.clientWidth + 2);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [text]);

  return (
    <span ref={wrapRef} className={`${styles.wrap} ${className || ""}`}>
      <span ref={textRef} className={`${styles.track} ${over ? styles.scroll : ""}`}>
        <span className={styles.seg}>{text}</span>
        {over && (
          <span className={styles.seg} aria-hidden="true">
            {text}
          </span>
        )}
      </span>
    </span>
  );
}
