"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { BottomNav } from "@/components/bottom-nav";
import { RestTimerProvider } from "@/components/rest-timer";
import { Splash } from "@/components/splash";
import { useSyncManager } from "@/components/sync-manager";
import { db } from "@/lib/db";
import { syncNow } from "@/lib/sync";

/**
 * Signed-in area. Sends visitors to /login, and users without a profile on
 * this device to /onboarding. Runs the sync engine in cloud mode.
 */
export default function AppLayout({ children }: LayoutProps<"/">) {
  const auth = useAuth();
  const router = useRouter();
  const userId = auth.status === "signed-in" ? auth.userId : null;
  const cloud = auth.status === "signed-in" && auth.mode === "cloud";

  // undefined while the query runs, null when there is no profile.
  const profile = useLiveQuery(
    async () => (userId ? ((await db.profiles.get(userId)) ?? null) : undefined),
    [userId],
  );
  const [initialSyncDone, setInitialSyncDone] = useState(false);

  useSyncManager(userId, cloud);

  useEffect(() => {
    if (auth.status === "signed-out") router.replace("/login");
  }, [auth.status, router]);

  // New device: download existing data before deciding the user is new.
  useEffect(() => {
    if (!userId || profile !== null) return;
    let cancelled = false;
    (cloud ? syncNow(userId) : Promise.resolve()).finally(() => {
      if (!cancelled) setInitialSyncDone(true);
    });
    return () => {
      cancelled = true;
    };
  }, [userId, profile, cloud]);

  useEffect(() => {
    if (profile === null && initialSyncDone) router.replace("/onboarding");
  }, [profile, initialSyncDone, router]);

  if (!profile) return <Splash />;

  return (
    <RestTimerProvider>
      <div className="flex min-h-dvh flex-col">
        <main className="mx-auto w-full max-w-lg flex-1 px-4 pt-[calc(env(safe-area-inset-top)+1.25rem)] pb-44">
          {children}
        </main>
        <BottomNav />
      </div>
    </RestTimerProvider>
  );
}
