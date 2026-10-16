"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useSignedIn } from "@/components/auth-provider";
import { ProfileForm, type ProfileFormValues } from "@/components/profile-form";
import { Button, Card, PageTitle } from "@/components/ui";
import { clearLocalData, db, hasUnsyncedChanges, touchedFields } from "@/lib/db";
import { pushProfile } from "@/lib/profile";
import { supabase } from "@/lib/supabase";

export default function ProfilePage() {
  const auth = useSignedIn();
  const router = useRouter();
  const profile = useLiveQuery(() => db.profiles.get(auth.userId), [auth.userId]);
  const [saved, setSaved] = useState(false);

  async function save({ weight_kg: _weight, ...values }: ProfileFormValues) {
    void _weight;
    await db.profiles.update(auth.userId, { ...values, ...touchedFields() });
    void pushProfile(auth.userId);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function signOut() {
    if (!supabase) return;
    if (
      (await hasUnsyncedChanges()) &&
      !confirm("Há dados ainda não enviados para a nuvem. Sair agora apaga esses dados deste aparelho. Sair mesmo assim?")
    ) {
      return;
    }
    await supabase.auth.signOut();
    await clearLocalData();
    router.replace("/login");
  }

  return (
    <>
      <PageTitle>Perfil</PageTitle>

      <Card className="mb-6">
        {auth.mode === "cloud" ? (
          <>
            <p className="text-sm text-muted">Conectado como</p>
            <p className="font-semibold">{auth.email}</p>
          </>
        ) : (
          <>
            <p className="font-semibold">Modo local</p>
            <p className="mt-1 text-sm text-muted">
              Supabase não configurado. Os dados ficam só neste navegador.
            </p>
          </>
        )}
      </Card>

      {profile && (
        <ProfileForm
          key={profile.id}
          initial={profile}
          submitLabel={saved ? "Salvo ✓" : "Salvar"}
          onSubmit={save}
        />
      )}

      {auth.mode === "cloud" && (
        <Button variant="danger" className="mt-8" onClick={signOut}>
          Sair da conta
        </Button>
      )}
    </>
  );
}
