"use client";

import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { useSignedIn } from "@/components/auth-provider";
import { Button, Card } from "@/components/ui";
import { ChevronRightIcon } from "@/components/icons";
import { db } from "@/lib/db";
import { listRoutines } from "@/lib/routines";

export default function TrainPage() {
  const { userId } = useSignedIn();
  const profile = useLiveQuery(() => db.profiles.get(userId), [userId]);
  const routines = useLiveQuery(() => listRoutines(userId), [userId]);

  const firstName = profile?.name.split(" ")[0];

  return (
    <>
      <p className="text-muted">{greeting()},</p>
      <h1 className="mb-6 text-3xl font-bold">{firstName ?? "atleta"}</h1>

      <Button disabled title="Disponível na etapa 3">
        Começar treino livre
      </Button>

      <h2 className="mt-8 mb-3 text-lg font-semibold">Suas fichas</h2>
      {routines?.length ? (
        <ul className="flex flex-col gap-3">
          {routines.map((routine) => (
            <li key={routine.id}>
              <Link
                href={`/fichas/editar?id=${routine.id}`}
                className="flex items-center justify-between rounded-2xl bg-surface p-4 font-semibold"
              >
                {routine.name}
                <ChevronRightIcon />
              </Link>
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
