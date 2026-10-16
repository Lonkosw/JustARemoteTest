"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckIcon, CloseIcon, PlusIcon, SearchIcon } from "@/components/icons";
import { Button, Field, Input, Select } from "@/components/ui";
import {
  EQUIPMENT,
  MUSCLE_GROUPS,
  normalize,
  type Equipment,
  type ExerciseInfo,
  type MuscleGroup,
} from "@/lib/exercises";
import { createCustomExercise } from "@/lib/routines";
import { useExercises } from "@/lib/use-exercises";

/**
 * Full-screen sheet to pick exercises. Tap toggles selection; "Adicionar"
 * returns the ids in the order they were picked.
 */
export function ExercisePicker({
  userId,
  onClose,
  onConfirm,
}: {
  userId: string;
  onClose: () => void;
  onConfirm: (exerciseIds: string[]) => void;
}) {
  const { all } = useExercises(userId);
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<MuscleGroup | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  // Lock page scroll behind the sheet.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const results = useMemo(() => {
    // Each typed word must start some word of the name: "sup incl" finds
    // "Supino inclinado", and "lateral" skips "unilateral".
    const words = normalize(query).split(/\s+/).filter(Boolean);
    return all.filter((e) => {
      if (group && e.muscle_group !== group) return false;
      const nameWords = normalize(e.name).split(/[^\p{L}\p{N}]+/u);
      return words.every((w) => nameWords.some((n) => n.startsWith(w)));
    });
  }, [all, query, group]);

  function toggle(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  return (
    <div className="fixed inset-0 z-20 flex flex-col bg-background" role="dialog" aria-label="Escolher exercícios">
      <header className="flex items-center gap-2 border-b border-border px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-3">
        <button aria-label="Fechar" onClick={onClose} className="-ml-2 p-2">
          <CloseIcon />
        </button>
        <h2 className="flex-1 text-lg font-semibold">Exercícios</h2>
        <button onClick={() => setCreating(true)} className="flex items-center gap-1 text-sm font-semibold text-accent">
          <PlusIcon /> Criar
        </button>
      </header>

      <div className="flex flex-col gap-3 px-4 pt-3">
        <label className="relative">
          <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted">
            <SearchIcon />
          </span>
          <Input
            type="search"
            placeholder="Buscar exercício"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-11"
            aria-label="Buscar exercício"
          />
        </label>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          <Chip active={group === null} onClick={() => setGroup(null)}>
            Todos
          </Chip>
          {(Object.keys(MUSCLE_GROUPS) as MuscleGroup[]).map((g) => (
            <Chip key={g} active={group === g} onClick={() => setGroup(group === g ? null : g)}>
              {MUSCLE_GROUPS[g]}
            </Chip>
          ))}
        </div>
      </div>

      <ul className="flex-1 overflow-y-auto px-4 pt-2 pb-28">
        {results.map((exercise) => (
          <PickerRow
            key={exercise.id}
            exercise={exercise}
            selected={selected.includes(exercise.id)}
            onToggle={() => toggle(exercise.id)}
          />
        ))}
        {results.length === 0 && (
          <li className="py-10 text-center text-muted">
            Nada encontrado.{" "}
            <button className="font-semibold text-accent" onClick={() => setCreating(true)}>
              Criar exercício
            </button>
          </li>
        )}
      </ul>

      <div className="fixed inset-x-0 bottom-0 border-t border-border bg-background px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
        <Button disabled={selected.length === 0} onClick={() => onConfirm(selected)}>
          {selected.length === 0
            ? "Selecione exercícios"
            : `Adicionar ${selected.length} ${selected.length === 1 ? "exercício" : "exercícios"}`}
        </Button>
      </div>

      {creating && (
        <CreateExerciseSheet
          initialName={query}
          initialGroup={group}
          onClose={() => setCreating(false)}
          onCreate={async (values) => {
            const id = await createCustomExercise(userId, values);
            setSelected((s) => [...s, id]);
            setQuery("");
            setCreating(false);
          }}
        />
      )}
    </div>
  );
}

function PickerRow({
  exercise,
  selected,
  onToggle,
}: {
  exercise: ExerciseInfo;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <li>
      <button
        onClick={onToggle}
        aria-pressed={selected}
        className="flex w-full items-center gap-3 border-b border-border py-3 text-left"
      >
        <span
          className={`flex size-6 shrink-0 items-center justify-center rounded-md border ${
            selected ? "border-accent bg-accent text-accent-foreground" : "border-border"
          }`}
        >
          {selected && <CheckIcon />}
        </span>
        <span className="flex-1">
          <span className="block font-medium">{exercise.name}</span>
          <span className="block text-sm text-muted">
            {MUSCLE_GROUPS[exercise.muscle_group]}
            {exercise.equipment && ` · ${EQUIPMENT[exercise.equipment]}`}
            {exercise.custom && " · Personalizado"}
          </span>
        </span>
      </button>
    </li>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium ${
        active ? "bg-accent text-accent-foreground" : "bg-surface-2 text-muted"
      }`}
    >
      {children}
    </button>
  );
}

function CreateExerciseSheet({
  initialName,
  initialGroup,
  onClose,
  onCreate,
}: {
  initialName: string;
  initialGroup: MuscleGroup | null;
  onClose: () => void;
  onCreate: (values: { name: string; muscle_group: MuscleGroup; equipment: Equipment | null }) => Promise<void>;
}) {
  const [name, setName] = useState(initialName);
  const [group, setGroup] = useState<MuscleGroup | "">(initialGroup ?? "");
  const [equipment, setEquipment] = useState<Equipment | "">("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim() || !group) return;
    await onCreate({ name: name.trim(), muscle_group: group, equipment: equipment || null });
  }

  return (
    <div className="fixed inset-0 z-30 flex items-end bg-black/60" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="flex w-full flex-col gap-4 rounded-t-3xl bg-surface p-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)]"
      >
        <h3 className="text-lg font-semibold">Novo exercício</h3>
        <Field label="Nome">
          <Input required autoFocus value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Grupo muscular">
          <Select required value={group} onChange={(e) => setGroup(e.target.value as MuscleGroup)}>
            <option value="">—</option>
            {(Object.keys(MUSCLE_GROUPS) as MuscleGroup[]).map((g) => (
              <option key={g} value={g}>
                {MUSCLE_GROUPS[g]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Equipamento">
          <Select value={equipment} onChange={(e) => setEquipment(e.target.value as Equipment)}>
            <option value="">—</option>
            {(Object.keys(EQUIPMENT) as Equipment[]).map((eq) => (
              <option key={eq} value={eq}>
                {EQUIPMENT[eq]}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={!name.trim() || !group}>
            Criar
          </Button>
        </div>
      </form>
    </div>
  );
}
