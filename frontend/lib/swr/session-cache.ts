// SessionStorage-backed SWR cache provider, scoped by userId.
// Why sessionStorage (not localStorage): auto-clear on tab close reduces
// data-leak risk on shared computers. Why scope by userId: prevents user A's
// cache leaking into user B's session after logout.

import type { Cache, State } from 'swr';

const STORAGE_KEY_PREFIX = 'swr-cache:';

type SWREntry = State<unknown, unknown>;

// Track the currently active cache so a single pair of module-level listeners
// can persist it. Re-creating listeners per factory call leaked in dev
// StrictMode and on login/logout cycles.
let activeKey: string | null = null;
let activeMap: Map<string, SWREntry> | null = null;
let listenersBound = false;

function persist() {
  if (!activeKey || !activeMap) return;
  try {
    sessionStorage.setItem(
      activeKey,
      JSON.stringify(Array.from(activeMap.entries())),
    );
  } catch {
    // quota exceeded or storage unavailable — silently ignore
  }
}

function bindListenersOnce() {
  if (listenersBound || typeof window === 'undefined') return;
  window.addEventListener('beforeunload', persist);
  // pagehide covers mobile Safari where beforeunload is unreliable
  window.addEventListener('pagehide', persist);
  listenersBound = true;
}

export function createSessionCache(userId: number | null): Cache<unknown> {
  if (typeof window === 'undefined') return new Map<string, SWREntry>();
  if (userId === null) {
    activeKey = null;
    activeMap = null;
    return new Map<string, SWREntry>(); // guest — no persist
  }

  const storageKey = `${STORAGE_KEY_PREFIX}${userId}`;
  let initial: [string, SWREntry][] = [];
  try {
    const raw = sessionStorage.getItem(storageKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) initial = parsed as [string, SWREntry][];
    }
  } catch {
    // corrupt storage — start fresh
  }

  const map = new Map<string, SWREntry>(initial);
  activeKey = storageKey;
  activeMap = map;
  bindListenersOnce();

  return map;
}

export function clearSessionCache(userId: number): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(`${STORAGE_KEY_PREFIX}${userId}`);
  } catch {
    // ignore
  }
  if (activeKey === `${STORAGE_KEY_PREFIX}${userId}`) {
    activeKey = null;
    activeMap = null;
  }
}
