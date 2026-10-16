"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useSignedIn } from "@/components/auth-provider";
import { BackIcon, ChevronDownIcon, ChevronUpIcon } from "@/components/icons";
import { Button, Card } from "@/components/ui";
import { CATALOG } from "@/lib/exercises";
import { applyTemplate } from "@/lib/routines";
import { TEMPLATES, type Template } from "@/lib/templates";

const NAMES = new Map(CATALOG.map((e) => [e.id, e.name]));

export default function TemplatesPage() {
  const { userId } = useSignedIn();
  const router = useRouter();
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function apply(template: Template) {
    setBusy(true);
    await applyTemplate(userId, template);
    router.push("/fichas");
  }

  return (
    <>
      <header className="mb-5 flex items-center gap-2">
        <button aria-label="Voltar" onClick={() => router.back()} className="-ml-2 p-2">
          <BackIcon />
        </button>
        <h1 className="text-2xl font-bold">Modelos prontos</h1>
      </header>
      <p className="mb-5 text-sm text-muted">
        O modelo vira fichas normais: depois dá para trocar exercícios, séries e descanso.
      </p>

      <ul className="flex flex-col gap-3">
        {TEMPLATES.map((template) => {
          const expanded = open === template.id;
          return (
            <li key={template.id}>
              <Card>
                <button
                  className="flex w-full items-start justify-between gap-3 text-left"
                  onClick={() => setOpen(expanded ? null : template.id)}
                  aria-expanded={expanded}
                >
                  <div>
                    <p className="text-lg font-semibold">{template.name}</p>
                    <p className="text-sm text-muted">
                      {template.daysPerWeek} · {template.level}
                    </p>
                    <p className="mt-2 text-sm">{template.description}</p>
                  </div>
                  <span className="mt-1 text-muted">{expanded ? <ChevronUpIcon /> : <ChevronDownIcon />}</span>
                </button>

                {expanded && (
                  <div className="mt-4 flex flex-col gap-4">
                    {template.routines.map((routine) => (
                      <div key={routine.name}>
                        <p className="mb-1 font-semibold text-accent">{routine.name}</p>
                        <ul className="text-sm text-muted">
                          {routine.exercises.map(([id, sets, reps]) => (
                            <li key={id} className="flex justify-between gap-2 py-0.5">
                              <span>{NAMES.get(id)}</span>
                              <span className="shrink-0 tabular-nums">
                                {sets}×{reps}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                    <Button disabled={busy} onClick={() => apply(template)}>
                      Usar {template.name} ({template.routines.length} fichas)
                    </Button>
                  </div>
                )}
              </Card>
            </li>
          );
        })}
      </ul>
    </>
  );
}
