"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useSignedIn } from "@/components/auth-provider";
import { formatDay } from "@/components/body-tab";
import { BackIcon, TrashIcon } from "@/components/icons";
import { PhotoImage } from "@/components/photo-image";
import { Splash } from "@/components/splash";
import { Card, Field, Input, Select } from "@/components/ui";
import { today, valueNear, listMeasurements } from "@/lib/body";
import { db } from "@/lib/db";
import { deletePhoto, POSE_LABELS, updatePhoto, type Pose } from "@/lib/photos";
import { formatKg } from "@/lib/workouts";

export default function PhotoPage() {
  return (
    <Suspense fallback={<Splash />}>
      <Photo />
    </Suspense>
  );
}

function Photo() {
  const id = useSearchParams().get("id") ?? "";
  const { userId } = useSignedIn();
  const router = useRouter();
  const data = useLiveQuery(async () => {
    const photo = await db.progress_photos.get(id);
    if (!photo || photo.deleted_at || photo.user_id !== userId) return null;
    return { photo, weight: valueNear(await listMeasurements(userId), "weight_kg", photo.taken_on) };
  }, [id, userId]);

  if (data === undefined) return <Splash />;
  if (data === null) return <Card className="text-center text-muted">Foto não encontrada.</Card>;
  const { photo, weight } = data;

  async function remove() {
    if (!confirm("Excluir esta foto? Ela também sai dos seus outros aparelhos.")) return;
    await deletePhoto(photo.id);
    router.replace("/evolucao?aba=corpo");
  }

  return (
    <>
      <header className="mb-4 flex items-center gap-2">
        <button aria-label="Voltar" onClick={() => router.back()} className="-ml-2 p-2">
          <BackIcon />
        </button>
        <div>
          <h1 className="text-xl font-bold">{formatDay(photo.taken_on)}</h1>
          <p className="text-sm text-muted">
            {POSE_LABELS[photo.pose ?? "other"]}
            {weight !== null && ` · ${formatKg(weight)} kg`}
          </p>
        </div>
      </header>

      <PhotoImage photo={photo} size="full" alt={`Foto de ${formatDay(photo.taken_on)}`} className="w-full rounded-2xl" />

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Field label="Data">
          <Input
            type="date"
            max={today()}
            value={photo.taken_on}
            onChange={(e) => e.target.value && updatePhoto(photo.id, { taken_on: e.target.value })}
          />
        </Field>
        <Field label="Pose">
          <Select value={photo.pose ?? "other"} onChange={(e) => updatePhoto(photo.id, { pose: e.target.value as Pose })}>
            {(Object.keys(POSE_LABELS) as Pose[]).map((p) => (
              <option key={p} value={p}>
                {POSE_LABELS[p]}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <button onClick={remove} className="mx-auto mt-8 flex items-center gap-2 text-sm font-semibold text-danger">
        <TrashIcon /> Excluir foto
      </button>
    </>
  );
}
