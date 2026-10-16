"use client";

import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useSignedIn } from "@/components/auth-provider";
import { ChevronRightIcon, SearchIcon } from "@/components/icons";
import { Splash } from "@/components/splash";
import { Card, Input, PageTitle } from "@/components/ui";
import { MUSCLE_GROUPS, normalize, type MuscleGroup } from "@/lib/exercises";
import {
  estimate1rm,
  listFinishedWorkouts,
  loadLoggedSets,
  recordsInWorkout,
  setsPerMuscleGroup,
  startOfWeek,
} from "@/lib/stats";
import { useExercises } from "@/lib/use-exercises";
import { formatDuration, formatKg } from "@/lib/workouts";

type Tab = "history" | "exercises";

export default function ProgressPage() {
  const { userId } = useSignedIn();
  const [tab, setTab] = useState<Tab>("history");
  const { byId } = useExercises(userId);
  const data = useLiveQuery(async () => {
    const [workouts, sets] = await Promise.all([listFinishedWorkouts(userId), loadLoggedSets(userId)]);
    return { workouts, sets, now: Date.now() };
  }, [userId]);

  if (!data) return <Splash />;

  if (data.workouts.length === 0) {
    return (
      <>
        <PageTitle>Evolução</PageTitle>
        <Card className="text-center text-muted">
          Seus treinos finalizados aparecem aqui, com recordes e gráficos por exercício.
        </Card>
      </>
    );
  }

  return (
    <>
      <PageTitle>Evolução</PageTitle>
      <WeekSummary data={data} groupOf={(id) => byId.get(id)?.muscle_group} />

      <div role="tablist" className="mt-6 mb-4 grid grid-cols-2 rounded-xl bg-surface p-1">
        {(
          [
            ["history", "Histórico"],
            ["exercises", "Exercícios"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={`h-10 rounded-lg text-sm font-semibold ${tab === value ? "bg-surface-2 text-foreground" : "text-muted"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "history" ? (
        <History data={data} />
      ) : (
        <ExerciseList sets={data.sets} nameOf={(id) => byId.get(id)?.name} groupOf={(id) => byId.get(id)?.muscle_group} />
      )}
    </>
  );
}

type Data = {
  workouts: Awaited<ReturnType<typeof listFinishedWorkouts>>;
  sets: Awaited<ReturnType<typeof loadLoggedSets>>;
  now: number;
};

function WeekSummary({ data, groupOf }: { data: Data; groupOf: (id: string) => MuscleGroup | undefined }) {
  const weekStart = startOfWeek(new Date(data.now));
  const weekWorkouts = data.workouts.filter((w) => Date.parse(w.started_at) >= weekStart.getTime());
  const weekIds = new Set(weekWorkouts.map((w) => w.id));
  const weekSets = data.sets.filter((s) => weekIds.has(s.workout_id));
  const volume = weekSets.reduce((sum, s) => sum + (s.weight_kg ?? 0) * (s.reps ?? 0), 0);

  // Last 7 calendar days including today, so Monday mornings are not empty.
  const today = new Date(data.now);
  const since = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6);
  const groups = [...setsPerMuscleGroup(data.sets, groupOf, since)].sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...groups.map(([, n]) => n));

  return (
    <>
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Treinos na semana" value={String(weekWorkouts.length)} />
        <Stat label="Séries na semana" value={String(weekSets.length)} />
        <Stat label="Volume na semana" value={`${formatKg(Math.round(volume))} kg`} />
      </div>

      {groups.length > 0 && (
        <Card className="mt-4">
          <h2 className="mb-3 text-sm font-semibold">Séries por grupo muscular · últimos 7 dias</h2>
          <ul className="flex flex-col gap-2.5">
            {groups.map(([group, count]) => (
              <li key={group} className="grid grid-cols-[7.5rem_1fr_1.5rem] items-center gap-2 text-sm">
                <span className="truncate text-muted">{MUSCLE_GROUPS[group]}</span>
                <span className="h-2.5 rounded-r bg-surface-2">
                  <span className="block h-full rounded-r bg-accent" style={{ width: `${(count / max) * 100}%` }} />
                </span>
                <span className="text-right font-semibold tabular-nums">{count}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-surface p-3">
      <p className="text-xs leading-tight text-muted">{label}</p>
      <p className="mt-1 text-lg font-bold tabular-nums">{value}</p>
    </div>
  );
}

const monthFormat = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });
const dayFormat = new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", month: "short" });

function History({ data }: { data: Data }) {
  const rows = useMemo(() => {
    const setsByWorkout = new Map<string, Data["sets"]>();
    for (const s of data.sets) setsByWorkout.set(s.workout_id, [...(setsByWorkout.get(s.workout_id) ?? []), s]);
    return data.workouts.map((w) => {
      const sets = setsByWorkout.get(w.id) ?? [];
      const earlier = data.sets.filter((s) => s.workout_started_at < w.started_at);
      return {
        workout: w,
        sets: sets.length,
        volume: sets.reduce((sum, s) => sum + (s.weight_kg ?? 0) * (s.reps ?? 0), 0),
        records: recordsInWorkout(sets, earlier).size,
        month: monthFormat.format(new Date(w.started_at)),
      };
    });
  }, [data]);

  return (
    <div className="flex flex-col gap-3">
      {rows.map((row, i) => (
        <div key={row.workout.id}>
          {(i === 0 || rows[i - 1].month !== row.month) && (
            <h3 className="mt-2 mb-2 text-sm font-semibold text-muted first-letter:uppercase">{row.month}</h3>
          )}
          <Link
            href={`/treino/resumo?id=${row.workout.id}`}
            className="flex items-center gap-3 rounded-2xl bg-surface p-4"
          >
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted">{dayFormat.format(new Date(row.workout.started_at))}</p>
              <p className="truncate font-semibold">{row.workout.name}</p>
              <p className="text-sm text-muted tabular-nums">
                {formatDuration(Date.parse(row.workout.finished_at!) - Date.parse(row.workout.started_at))} · {row.sets}{" "}
                séries · {formatKg(Math.round(row.volume))} kg
              </p>
            </div>
            {row.records > 0 && (
              <span className="rounded-full bg-accent/15 px-2 py-1 text-xs font-semibold text-accent">
                🏆 {row.records}
              </span>
            )}
            <ChevronRightIcon />
          </Link>
        </div>
      ))}
    </div>
  );
}

function ExerciseList({
  sets,
  nameOf,
  groupOf,
}: {
  sets: Data["sets"];
  nameOf: (id: string) => string | undefined;
  groupOf: (id: string) => MuscleGroup | undefined;
}) {
  const [query, setQuery] = useState("");
  const rows = useMemo(() => {
    const map = new Map<string, { sessions: Set<string>; last: string; best: number | null }>();
    for (const s of sets) {
      const row = map.get(s.exercise_id) ?? { sessions: new Set(), last: s.workout_started_at, best: null };
      row.sessions.add(s.workout_id);
      if (s.workout_started_at > row.last) row.last = s.workout_started_at;
      const e = estimate1rm(s.weight_kg, s.reps);
      if (e !== null && (row.best === null || e > row.best)) row.best = e;
      map.set(s.exercise_id, row);
    }
    return [...map.entries()]
      .map(([id, r]) => ({ id, name: nameOf(id) ?? "Exercício", ...r }))
      .sort((a, b) => b.last.localeCompare(a.last));
  }, [sets, nameOf]);

  const words = normalize(query).split(/\s+/).filter(Boolean);
  const filtered = rows.filter((r) => words.every((w) => normalize(r.name).includes(w)));

  return (
    <>
      <label className="relative mb-3 block">
        <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted">
          <SearchIcon />
        </span>
        <Input
          type="search"
          placeholder="Buscar exercício"
          aria-label="Buscar exercício"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-11"
        />
      </label>
      <ul className="flex flex-col gap-3">
        {filtered.map((r) => {
          const group = groupOf(r.id);
          return (
            <li key={r.id}>
              <Link href={`/evolucao/exercicio?id=${r.id}`} className="flex items-center gap-3 rounded-2xl bg-surface p-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{r.name}</p>
                  <p className="text-sm text-muted">
                    {group && `${MUSCLE_GROUPS[group]} · `}
                    {r.sessions.size} {r.sessions.size === 1 ? "sessão" : "sessões"}
                  </p>
                </div>
                {r.best !== null && (
                  <div className="text-right">
                    <p className="text-xs text-muted">1RM est.</p>
                    <p className="font-semibold tabular-nums">{formatKg(Math.round(r.best * 10) / 10)} kg</p>
                  </div>
                )}
                <ChevronRightIcon />
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
