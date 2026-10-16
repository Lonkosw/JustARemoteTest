"use client";

import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSignedIn } from "@/components/auth-provider";
import { ChevronDownIcon, ChevronRightIcon, ChevronUpIcon } from "@/components/icons";
import { Button, Card, PageTitle } from "@/components/ui";
import { db } from "@/lib/db";
import { createRoutine, listRoutines, moveRoutine } from "@/lib/routines";

export default function RoutinesPage() {
  const { userId } = useSignedIn();
  const router = useRouter();
  const routines = useLiveQuery(async () => {
    const list = await listRoutines(userId);
    const counts = await Promise.all(
      list.map((r) =>
        db.routine_exercises
          .where("routine_id")
          .equals(r.id)
          .filter((row) => !row.deleted_at)
          .count(),
      ),
    );
    return list.map((routine, i) => ({ routine, count: counts[i] }));
  }, [userId]);

  async function newRoutine() {
    const id = await createRoutine(userId, `Ficha ${(routines?.length ?? 0) + 1}`);
    router.push(`/fichas/editar?id=${id}`);
  }

  return (
    <>
      <PageTitle>Fichas</PageTitle>

      <div className="mb-6 grid grid-cols-2 gap-3">
        <Button onClick={newRoutine}>Nova ficha</Button>
        <Link
          href="/fichas/modelos"
          className="flex h-12 items-center justify-center rounded-xl bg-surface-2 font-semibold"
        >
          Usar modelo
        </Link>
      </div>

      {routines && routines.length === 0 && (
        <Card className="text-center text-muted">
          Nenhuma ficha ainda. Crie uma do zero ou comece por um modelo pronto.
        </Card>
      )}

      <ul className="flex flex-col gap-3">
        {routines?.map(({ routine, count }, index) => (
          <li key={routine.id} className="flex items-stretch gap-2">
            <Link
              href={`/fichas/editar?id=${routine.id}`}
              className="flex flex-1 items-center justify-between rounded-2xl bg-surface p-4"
            >
              <div>
                <p className="font-semibold">{routine.name}</p>
                <p className="text-sm text-muted">
                  {count} {count === 1 ? "exercício" : "exercícios"}
                </p>
              </div>
              <ChevronRightIcon />
            </Link>
            {routines.length > 1 && (
              <div className="flex flex-col overflow-hidden rounded-2xl bg-surface">
                <button
                  aria-label="Mover para cima"
                  disabled={index === 0}
                  onClick={() => moveRoutine(userId, routine.id, -1)}
                  className="flex flex-1 items-center px-3 text-muted disabled:opacity-30"
                >
                  <ChevronUpIcon />
                </button>
                <button
                  aria-label="Mover para baixo"
                  disabled={index === routines.length - 1}
                  onClick={() => moveRoutine(userId, routine.id, 1)}
                  className="flex flex-1 items-center px-3 text-muted disabled:opacity-30"
                >
                  <ChevronDownIcon />
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
