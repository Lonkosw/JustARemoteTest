"use client";

import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSignedIn } from "@/components/auth-provider";
import { Button, Card } from "@/components/ui";
import { db } from "@/lib/db";
import { listRoutines } from "@/lib/routines";
import { getActiveWorkout, startWorkout } from "@/lib/workouts";

export default function TrainPage() {
  const { userId } = useSignedIn();
  const router = useRouter();
  const profile = useLiveQuery(() => db.profiles.get(userId), [userId]);
  const active = useLiveQuery(() => getActiveWorkout(userId), [userId]);
  const routines = useLiveQuery(async () => {
    const list = await listRoutines(userId);
    const finished = await db.workouts
      .where("user_id")
      .equals(userId)
      .filter((w) => !w.deleted_at && !!w.finished_at)
      .toArray();
    const lastDone = new Map<string, string>();
    for (const w of finished) {
      if (w.routine_id && (!lastDone.has(w.routine_id) || w.finished_at! > lastDone.get(w.routine_id)!)) {
        lastDone.set(w.routine_id, w.finished_at!);
      }
    }
    // Next in rotation: the routine after the most recently done one.
    const latest = list.reduce<string | null>(
      (best, r) => (lastDone.has(r.id) && (!best || lastDone.get(r.id)! > lastDone.get(best)!) ? r.id : best),
      null,
    );
    const nextIndex = latest ? (list.findIndex((r) => r.id === latest) + 1) % list.length : 0;
    return list.map((routine, i) => ({ routine, lastDone: lastDone.get(routine.id) ?? null, next: i === nextIndex }));
  }, [userId]);

  const firstName = profile?.name.split(" ")[0];

  async function start(routineId: string | null) {
    if (active) {
      if (confirm(`Você já tem um treino em andamento (${active.name}). Continuar ele?`)) router.push("/treino");
      return;
    }
    await startWorkout(userId, routineId);
    router.push("/treino");
  }

  return (
    <>
      <p className="text-muted">{greeting()},</p>
      <h1 className="mb-6 text-3xl font-bold">{firstName ?? "atleta"}</h1>

      {active ? (
        <Link href="/treino" className="block rounded-2xl bg-accent p-4 text-accent-foreground">
          <p className="text-sm font-semibold opacity-80">Treino em andamento</p>
          <p className="text-lg font-bold">{active.name}</p>
          <p className="text-sm font-medium opacity-80">
            Começou às{" "}
            {new Date(active.started_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} · Toque
            para continuar
          </p>
        </Link>
      ) : (
        <Button variant="secondary" onClick={() => start(null)}>
          Começar treino livre
        </Button>
      )}

      <h2 className="mt-8 mb-3 text-lg font-semibold">Suas fichas</h2>
      {routines?.length ? (
        <ul className="flex flex-col gap-3">
          {routines.map(({ routine, lastDone, next }) => (
            <li key={routine.id}>
              <Card className={next && !active ? "ring-2 ring-accent/60" : ""}>
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    {next && !active && <p className="text-xs font-semibold text-accent">Próximo da sequência</p>}
                    <p className="font-semibold">{routine.name}</p>
                    <p className="text-sm text-muted">{lastDone ? `Feito ${relativeDay(lastDone)}` : "Ainda não feito"}</p>
                  </div>
                  <Link href={`/fichas/editar?id=${routine.id}`} className="px-2 py-2 text-sm font-semibold text-muted">
                    Editar
                  </Link>
                  <Button size="sm" onClick={() => start(routine.id)}>
                    Iniciar
                  </Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      ) : (
        <Card className="text-center">
          <p className="text-muted">Você ainda não tem fichas.</p>
          <Link href="/fichas" className="mt-2 inline-block font-semibold text-accent">
            Criar ficha
          </Link>
        </Card>
      )}
    </>
  );
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

function relativeDay(iso: string) {
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(new Date()) - startOfDay(new Date(iso))) / 86_400_000);
  if (days <= 0) return "hoje";
  if (days === 1) return "ontem";
  return `há ${days} dias`;
}
