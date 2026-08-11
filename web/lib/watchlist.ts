"use client";

import { useCallback, useEffect, useState } from "react";

const KEY = "sonar:watchlist";

function read(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

/* Module-level store so every useWatchlist() instance on the page shares
   one Set and re-renders together — a plain per-hook useState only syncs
   across browser tabs (via the storage event), not within the same tab. */
let store = read();
const listeners = new Set<() => void>();

function write(next: Set<string>) {
  store = next;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(KEY, JSON.stringify([...next]));
  }
  listeners.forEach((l) => l());
}

/**
 * The board is a static export with no backend, so "watching" an
 * opportunity is per-browser (localStorage), not shared between team
 * members. It exists to stop the Gradhack failure mode — "nothing was
 * watching it" — for whoever has the tab open.
 */
export function useWatchlist() {
  const [ids, setIds] = useState<Set<string>>(store);

  useEffect(() => {
    setIds(read());
    const notify = () => setIds(store);
    listeners.add(notify);
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) write(read());
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(notify);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const toggle = useCallback((id: string) => {
    const next = new Set(store);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    write(next);
  }, []);

  return { ids, isWatching: (id: string) => ids.has(id), toggle };
}
