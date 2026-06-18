// Local-first profile store (spec 14.6): Dexie / IndexedDB.
// Replaces the cookie as the source of truth. The schema mirrors the planned
// Supabase tables (spec 15.4) 1:1 so the eventual login migration is a straight
// copy, not a reshape.
//
// The DB is constructed lazily on first use so this module is safe to import in
// SSR'd client components: IndexedDB is only touched inside browser-only calls
// (effects + event handlers), never at import time on the server.

import Dexie from "dexie";
import { emptyProfile } from "./profile";

const PROFILE_ID = "me"; // single local profile row

let _db = null;
function db() {
  if (_db) return _db;
  const d = new Dexie("echoes");
  d.version(1).stores({
    // mirrors Supabase `profiles` (one row locally) + `sessions`
    profile: "id",
    sessions: "id, started_at",
  });
  _db = d;
  return _db;
}

// ---- profile ----
export async function getProfile() {
  try {
    const row = await db().profile.get(PROFILE_ID);
    if (!row) return null;
    const { id, ...profile } = row; // strip the Dexie key
    return { ...emptyProfile(), ...profile };
  } catch {
    return null;
  }
}

export async function saveProfileDb(profile) {
  try {
    await db().profile.put({ id: PROFILE_ID, ...profile, updated_at: Date.now() });
  } catch {
    /* storage unavailable (private mode etc.) — fail soft */
  }
}

export async function clearAll() {
  try {
    await db().profile.clear();
    await db().sessions.clear();
  } catch {
    /* ignore */
  }
}

// ---- sessions ----
// Upsert the current session by id so a growing chain updates one row.
export async function upsertSession(session) {
  if (!session?.id) return;
  try {
    await db().sessions.put(session);
  } catch {
    /* ignore */
  }
}

export async function getSessions() {
  try {
    return await db().sessions.orderBy("started_at").toArray();
  } catch {
    return [];
  }
}
