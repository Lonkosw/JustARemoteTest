"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/components/auth-provider";
import { ProfileForm, type ProfileFormValues } from "@/components/profile-form";
import { Splash } from "@/components/splash";
import { db, newRowFields } from "@/lib/db";
import { pushProfile } from "@/lib/profile";
import type { BodyMeasurement, Profile } from "@/lib/types";

export default function OnboardingPage() {
  const auth = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (auth.status === "signed-out") router.replace("/login");
  }, [auth.status, router]);

  if (auth.status !== "signed-in") return <Splash />;
  const { userId } = auth;

  async function save({ weight_kg, ...values }: ProfileFormValues) {
    const profile: Profile = { ...newRowFields(userId, userId), ...values };

    await db.transaction("rw", db.profiles, db.body_measurements, async () => {
      await db.profiles.put(profile);
      if (weight_kg) {
        const measurement: BodyMeasurement = {
          ...newRowFields(userId),
          measured_on: new Date().toLocaleDateString("sv-SE"),
          weight_kg,
          body_fat_pct: null,
          chest_cm: null,
          waist_cm: null,
          hips_cm: null,
          arm_cm: null,
          thigh_cm: null,
          calf_cm: null,
          notes: null,
        };
        await db.body_measurements.add(measurement);
      }
    });

    void pushProfile(userId);
    router.replace("/");
  }

  return (
    <main className="mx-auto max-w-lg px-4 pt-[calc(env(safe-area-inset-top)+2rem)] pb-10">
      <h1 className="text-2xl font-bold">Bem-vindo!</h1>
      <p className="mt-1 mb-6 text-muted">
        Conte um pouco sobre você. Dá para mudar tudo depois no Perfil.
      </p>
      <ProfileForm askWeight submitLabel="Começar" onSubmit={save} />
    </main>
  );
}
