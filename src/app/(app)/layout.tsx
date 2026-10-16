"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { BottomNav } from "@/components/bottom-nav";
import { Splash } from "@/components/splash";
import { db } from "@/lib/db";
import { pullProfileIfMissing, pushProfile } from "@/lib/profile";

/**
 * Signed-in area. Sends visitors to /login, and users without a profile on
 * this device to /onboarding.
 */
export default function AppLayout({ children }: LayoutProps<"/">) {
  const auth = useAuth();
  const router = useRouter();
  const userId = auth.status === "signed-in" ? auth.userId : null;

  // undefined while the query runs, null when there is no profile.
  const profile = useLiveQuery(
    async () => (userId ? ((await db.profiles.get(userId)) ?? null) : undefined),
    [userId],
  );
  const [pullDone, setPullDone] = useState(false);

  useEffect(() => {
    if (auth.status === "signed-out") router.replace("/login");
  }, [auth.status, router]);

  // New device: try to fetch the profile before sending the user to onboarding.
  useEffect(() => {
    if (!userId || profile !== null) return;
    let cancelled = false;
    pullProfileIfMissing(userId).finally(() => {
      if (!cancelled) setPullDone(true);
    });
    return () => {
      cancelled = true;
    };
  }, [userId, profile]);

  useEffect(() => {
    if (profile === null && pullDone) router.replace("/onboarding");
  }, [profile, pullDone, router]);

  // Retry pending profile changes on start and whenever the network returns.
  useEffect(() => {
    if (!userId) return;
    const push = () => void pushProfile(userId);
    push();
    window.addEventListener("online", push);
    return () => window.removeEventListener("online", push);
  }, [userId]);

  if (!profile) return <Splash />;

  return (
    <div className="flex min-h-dvh flex-col">
      <main className="mx-auto w-full max-w-lg flex-1 px-4 pt-[calc(env(safe-area-inset-top)+1.25rem)] pb-28">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
