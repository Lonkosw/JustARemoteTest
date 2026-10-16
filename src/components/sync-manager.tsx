"use client";

import { useEffect, useSyncExternalStore } from "react";
import { getSyncStatus, subscribeSyncStatus, syncNow, watchLocalChanges } from "@/lib/sync";

const PERIODIC_MS = 60_000;

/** Keeps IndexedDB and Supabase in sync while the app is open. */
export function useSyncManager(userId: string | null, enabled: boolean) {
  useEffect(() => {
    if (!userId || !enabled) return;
    const run = () => void syncNow(userId);

    run();
    const stopWatching = watchLocalChanges(run);
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") run();
    }, PERIODIC_MS);
    const onVisible = () => document.visibilityState === "visible" && run();
    window.addEventListener("online", run);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      stopWatching();
      clearInterval(interval);
      window.removeEventListener("online", run);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [userId, enabled]);
}

export function useSyncStatus() {
  return useSyncExternalStore(subscribeSyncStatus, getSyncStatus, getSyncStatus);
}
