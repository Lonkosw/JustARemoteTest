"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useSignedIn } from "@/components/auth-provider";
import { formatDay } from "@/components/body-tab";
import { BackIcon } from "@/components/icons";
import { PhotoImage } from "@/components/photo-image";
import { Splash } from "@/components/splash";
import { Card } from "@/components/ui";
import { listMeasurements, valueNear } from "@/lib/body";
import { db } from "@/lib/db";
import { POSE_LABELS } from "@/lib/photos";
import { formatKg } from "@/lib/workouts";

export default function ComparePage() {
  return (
    <Suspense fallback={<Splash />}>
      <Compare />
    </Suspense>
  );
}

function Compare() {
  const params = useSearchParams();
  const ids = [params.get("a") ?? "", params.get("b") ?? ""];
  const { userId } = useSignedIn();
  const router = useRouter();
  const data = useLiveQuery(async () => {
    const photos = await db.progress_photos.bulkGet(ids);
    if (photos.some((p) => !p || p.deleted_at || p.user_id !== userId)) return null;
    const rows = await listMeasurements(userId);
    return photos.map((photo) => ({ photo: photo!, weight: valueNear(rows, "weight_kg", photo!.taken_on) }));
  }, [ids[0], ids[1], userId]);

  if (data === undefined) return <Splash />;
  if (data === null) return <Card className="text-center text-muted">Fotos não encontradas.</Card>;

  const [before, after] = data;
  const days = Math.round((Date.parse(after.photo.taken_on) - Date.parse(before.photo.taken_on)) / 86_400_000);
  const delta = before.weight !== null && after.weight !== null ? after.weight - before.weight : null;

  return (
    <>
      <header className="mb-4 flex items-center gap-2">
        <button aria-label="Voltar" onClick={() => router.back()} className="-ml-2 p-2">
          <BackIcon />
        </button>
        <div>
          <h1 className="text-xl font-bold">Antes e depois</h1>
          <p className="text-sm text-muted tabular-nums">
            {days} {days === 1 ? "dia" : "dias"}
            {delta !== null && ` · ${delta > 0 ? "+" : delta < 0 ? "−" : "±"}${formatKg(Math.abs(Math.round(delta * 10) / 10))} kg`}
          </p>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-2">
        {data.map(({ photo, weight }) => (
          <figure key={photo.id}>
            <PhotoImage photo={photo} size="full" alt={`Foto de ${formatDay(photo.taken_on)}`} className="aspect-[3/4] w-full rounded-xl" />
            <figcaption className="mt-1.5 text-sm">
              <span className="font-semibold">{formatDay(photo.taken_on)}</span>
              <span className="block text-muted">
                {POSE_LABELS[photo.pose ?? "other"]}
                {weight !== null && ` · ${formatKg(weight)} kg`}
              </span>
            </figcaption>
          </figure>
        ))}
      </div>
    </>
  );
}
