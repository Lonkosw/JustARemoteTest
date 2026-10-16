-- Initial schema for the workout tracker.
--
-- Sync model: the app is offline-first. Clients generate UUIDs, write to
-- IndexedDB first and push rows here later. Every synced table carries:
--   updated_at         client clock, used for last-write-wins conflicts
--   deleted_at         soft delete, so deletions also sync
--   server_updated_at  set by trigger, used as the pull cursor
--
-- The built-in exercise catalog ships with the app code. exercise_id columns
-- are text so they can hold either a catalog slug or a custom_exercises UUID.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.touch_server_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.server_updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id                uuid primary key references auth.users (id) on delete cascade,
  user_id           uuid not null references auth.users (id) on delete cascade,
  name              text not null,
  sex               text check (sex in ('m', 'f')),
  birth_year        int check (birth_year between 1900 and 2100),
  height_cm         numeric(5, 1) check (height_cm > 0),
  goal              text check (goal in ('hypertrophy', 'strength', 'fat_loss', 'conditioning')),
  level             text check (level in ('beginner', 'intermediate', 'advanced')),
  days_per_week     int check (days_per_week between 1 and 7),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,
  server_updated_at timestamptz not null default now(),
  constraint profiles_id_is_user check (id = user_id)
);

create table public.custom_exercises (
  id                uuid primary key,
  user_id           uuid not null references auth.users (id) on delete cascade,
  name              text not null,
  muscle_group      text not null,
  equipment         text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,
  server_updated_at timestamptz not null default now()
);

create table public.routines (
  id                uuid primary key,
  user_id           uuid not null references auth.users (id) on delete cascade,
  name              text not null,
  notes             text,
  position          int not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,
  server_updated_at timestamptz not null default now()
);

create table public.routine_exercises (
  id                uuid primary key,
  user_id           uuid not null references auth.users (id) on delete cascade,
  routine_id        uuid not null references public.routines (id) on delete cascade,
  exercise_id       text not null,
  position          int not null default 0,
  target_sets       int not null default 3 check (target_sets between 1 and 20),
  target_reps       text,
  rest_seconds      int not null default 90 check (rest_seconds between 0 and 1800),
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,
  server_updated_at timestamptz not null default now()
);

create table public.workouts (
  id                uuid primary key,
  user_id           uuid not null references auth.users (id) on delete cascade,
  routine_id        uuid references public.routines (id) on delete set null,
  name              text not null,
  started_at        timestamptz not null,
  finished_at       timestamptz,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,
  server_updated_at timestamptz not null default now()
);

create table public.workout_sets (
  id                uuid primary key,
  user_id           uuid not null references auth.users (id) on delete cascade,
  workout_id        uuid not null references public.workouts (id) on delete cascade,
  exercise_id       text not null,
  set_index         int not null,
  weight_kg         numeric(6, 2) check (weight_kg >= 0),
  reps              int check (reps >= 0),
  rpe               numeric(3, 1) check (rpe between 1 and 10),
  is_warmup         boolean not null default false,
  completed_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,
  server_updated_at timestamptz not null default now()
);

create table public.body_measurements (
  id                uuid primary key,
  user_id           uuid not null references auth.users (id) on delete cascade,
  measured_on       date not null,
  weight_kg         numeric(5, 2) check (weight_kg > 0),
  body_fat_pct      numeric(4, 1) check (body_fat_pct between 0 and 100),
  chest_cm          numeric(5, 1),
  waist_cm          numeric(5, 1),
  hips_cm           numeric(5, 1),
  arm_cm            numeric(5, 1),
  thigh_cm          numeric(5, 1),
  calf_cm           numeric(5, 1),
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,
  server_updated_at timestamptz not null default now()
);

create table public.progress_photos (
  id                uuid primary key,
  user_id           uuid not null references auth.users (id) on delete cascade,
  taken_on          date not null,
  storage_path      text not null,
  pose              text check (pose in ('front', 'side', 'back', 'other')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,
  server_updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Triggers, indexes and row level security (same pattern for every table)
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles',
    'custom_exercises',
    'routines',
    'routine_exercises',
    'workouts',
    'workout_sets',
    'body_measurements',
    'progress_photos'
  ]
  loop
    execute format(
      'create trigger %1$s_touch before insert or update on public.%1$I
         for each row execute function public.touch_server_updated_at()', t);

    execute format(
      'create index %1$s_user_sync_idx on public.%1$I (user_id, server_updated_at)', t);

    execute format('alter table public.%I enable row level security', t);

    execute format(
      'create policy "%1$s: owner can read" on public.%1$I
         for select to authenticated using (user_id = (select auth.uid()))', t);
    execute format(
      'create policy "%1$s: owner can insert" on public.%1$I
         for insert to authenticated with check (user_id = (select auth.uid()))', t);
    execute format(
      'create policy "%1$s: owner can update" on public.%1$I
         for update to authenticated
         using (user_id = (select auth.uid()))
         with check (user_id = (select auth.uid()))', t);
    execute format(
      'create policy "%1$s: owner can delete" on public.%1$I
         for delete to authenticated using (user_id = (select auth.uid()))', t);
  end loop;
end;
$$;

create index routine_exercises_routine_idx on public.routine_exercises (routine_id);
create index workouts_user_started_idx on public.workouts (user_id, started_at desc);
create index workout_sets_workout_idx on public.workout_sets (workout_id);
create index workout_sets_user_exercise_idx on public.workout_sets (user_id, exercise_id);
create index body_measurements_user_date_idx on public.body_measurements (user_id, measured_on);

-- ---------------------------------------------------------------------------
-- Storage: private bucket for progress photos, one folder per user
-- (object path: <user_id>/<photo_id>.jpg)
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('progress-photos', 'progress-photos', false)
on conflict (id) do nothing;

create policy "progress-photos: owner can read"
  on storage.objects for select to authenticated
  using (bucket_id = 'progress-photos'
         and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "progress-photos: owner can upload"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'progress-photos'
              and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "progress-photos: owner can update"
  on storage.objects for update to authenticated
  using (bucket_id = 'progress-photos'
         and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "progress-photos: owner can delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'progress-photos'
         and (storage.foldername(name))[1] = (select auth.uid())::text);
