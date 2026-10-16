"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useSignedIn } from "@/components/auth-provider";
import { ProfileForm, type ProfileFormValues } from "@/components/profile-form";
import { useSyncStatus } from "@/components/sync-manager";
import { Button, Card, PageTitle } from "@/components/ui";
import { clearLocalData, db, hasUnsyncedChanges, touchedFields } from "@/lib/db";
import { supabase } from "@/lib/supabase";
import { syncNow } from "@/lib/sync";

export default function ProfilePage() {
  const auth = useSignedIn();
  const router = useRouter();
  const profile = useLiveQuery(() => db.profiles.get(auth.userId), [auth.userId]);
  const [saved, setSaved] = useState(false);
  const sync = useSyncStatus();

  async function save({ weight_kg: _weight, ...values }: ProfileFormValues) {
    void _weight;
    await db.profiles.update(auth.userId, { ...values, ...touchedFields() });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function signOut() {
    if (!supabase) return;
    // Send pending changes first so signing out loses nothing when online.
    await syncNow(auth.userId);
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
            <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3 text-sm">
              <p className={sync.state === "error" ? "text-danger" : "text-muted"}>{syncLabel(sync)}</p>
              <button
                onClick={() => syncNow(auth.userId)}
                disabled={sync.state === "syncing"}
                className="shrink-0 font-semibold text-accent disabled:opacity-50"
              >
                Sincronizar
              </button>
            </div>
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

function syncLabel(sync: ReturnType<typeof useSyncStatus>) {
  if (sync.state === "syncing") return "Sincronizando…";
  if (sync.state === "offline") return "Sem internet. Os dados ficam salvos no aparelho.";
  if (sync.state === "error") return `Erro ao sincronizar: ${sync.error}`;
  if (sync.lastSyncAt)
    return `Sincronizado às ${new Date(sync.lastSyncAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
  return "Ainda não sincronizado";
}
