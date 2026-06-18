"use client";

import { useEffect } from "react";
import styles from "./ConfirmDialog.module.css";

// In-app confirm in the Echoes dark identity (replaces window.confirm).
// Esc or backdrop click = cancel; confirm button is autofocused.
export default function ConfirmDialog({
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
}) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onCancel?.();
      if (e.key === "Enter") onConfirm?.();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onConfirm, onCancel]);

  return (
    <div className={styles.backdrop} onClick={onCancel}>
      <div
        className={styles.card}
        role="alertdialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        {title && <h2 className={styles.title}>{title}</h2>}
        {message && <p className={styles.message}>{message}</p>}
        <div className={styles.actions}>
          <button className={`${styles.btn} ${styles.cancel}`} onClick={onCancel}>
            {cancelLabel}
          </button>
          <button className={`${styles.btn} ${styles.confirm}`} onClick={onConfirm} autoFocus>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
