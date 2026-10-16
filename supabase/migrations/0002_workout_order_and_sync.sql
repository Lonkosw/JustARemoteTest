-- Stage 3: live workouts and the sync engine.

-- Order of exercises inside a workout (set_index orders sets within one
-- exercise).
alter table public.workout_sets
  add column exercise_position int not null default 0;

-- Last write wins by client updated_at: an update carrying an older
-- updated_at than the stored row is ignored. Runs before the
-- server_updated_at trigger (triggers fire in name order).
create or replace function public.keep_newest_write()
returns trigger
language plpgsql
as $$
begin
  if new.updated_at < old.updated_at then
    return old;
  end if;
  return new;
end;
$$;

-- clock_timestamp() instead of now(): rows written by one batch upsert get
-- distinct server_updated_at values, which keeps the pull cursor simple.
create or replace function public.touch_server_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.server_updated_at := clock_timestamp();
  return new;
end;
$$;

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
      'create trigger a_keep_newest before update on public.%I
         for each row execute function public.keep_newest_write()', t);
  end loop;
end;
$$;
