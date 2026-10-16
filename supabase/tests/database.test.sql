-- Database tests: row level security, last-write-wins and sync columns.
-- Run with `npm run test:db` (starts the local test backend). Each check
-- raises an exception on failure, so psql -v ON_ERROR_STOP=1 exits non-zero.

begin;

-- Helpers ------------------------------------------------------------------

create function pg_temp.act_as(user_id uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', user_id, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end;
$$;

create function pg_temp.assert(ok boolean, message text) returns void language plpgsql as $$
begin
  if ok is not true then
    raise exception 'FAILED: %', message;
  end if;
  raise notice 'ok: %', message;
end;
$$;

-- Fixtures (as superuser) --------------------------------------------------

insert into public.routines (id, user_id, name, updated_at)
values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'A of user 1', '2026-01-01T10:00:00Z'),
  ('bbbbbbbb-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'B of user 2', '2026-01-01T10:00:00Z');

-- Row level security -------------------------------------------------------

select pg_temp.act_as('11111111-1111-1111-1111-111111111111');

select pg_temp.assert(
  (select count(*) from public.routines) = 1 and (select name from public.routines) = 'A of user 1',
  'user sees only own routines');

update public.routines set name = 'hacked' where user_id = '22222222-2222-2222-2222-222222222222';
delete from public.routines where user_id = '22222222-2222-2222-2222-222222222222';
reset role;
select pg_temp.assert(
  (select name from public.routines where id = 'bbbbbbbb-0000-0000-0000-000000000001') = 'B of user 2',
  'user cannot update or delete other users'' rows');

select pg_temp.act_as('11111111-1111-1111-1111-111111111111');
do $$
begin
  insert into public.routines (id, user_id, name)
  values ('cccccccc-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'forged');
  raise exception 'FAILED: insert for another user was allowed';
exception when insufficient_privilege then
  raise notice 'ok: insert for another user is rejected';
end;
$$;

do $$
begin
  insert into public.profiles (id, user_id, name)
  values ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'mismatch');
  raise exception 'FAILED: profile with id <> user_id was allowed';
exception when check_violation or insufficient_privilege then
  raise notice 'ok: profile id must equal user_id';
end;
$$;

select pg_temp.act_as(null);
select pg_temp.assert((select count(*) from public.routines) = 0, 'no rows without a signed-in user');
reset role;

-- Last write wins ----------------------------------------------------------

update public.routines set name = 'older', updated_at = '2025-12-31T00:00:00Z'
where id = 'aaaaaaaa-0000-0000-0000-000000000001';
select pg_temp.assert(
  (select name from public.routines where id = 'aaaaaaaa-0000-0000-0000-000000000001') = 'A of user 1',
  'update with older updated_at is ignored');

update public.routines set name = 'newer', updated_at = '2026-02-01T00:00:00Z'
where id = 'aaaaaaaa-0000-0000-0000-000000000001';
select pg_temp.assert(
  (select name from public.routines where id = 'aaaaaaaa-0000-0000-0000-000000000001') = 'newer',
  'update with newer updated_at is applied');

-- Upsert path used by the app goes through the same trigger.
insert into public.routines (id, user_id, name, updated_at)
values ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'stale upsert', '2026-01-15T00:00:00Z')
on conflict (id) do update set name = excluded.name, updated_at = excluded.updated_at;
select pg_temp.assert(
  (select name from public.routines where id = 'aaaaaaaa-0000-0000-0000-000000000001') = 'newer',
  'stale upsert is ignored');

-- server_updated_at --------------------------------------------------------

create temp table cursor_check as
select server_updated_at as before from public.routines where id = 'aaaaaaaa-0000-0000-0000-000000000001';
update public.routines set notes = 'x', updated_at = '2026-03-01T00:00:00Z'
where id = 'aaaaaaaa-0000-0000-0000-000000000001';
select pg_temp.assert(
  (select server_updated_at from public.routines where id = 'aaaaaaaa-0000-0000-0000-000000000001')
    > (select before from cursor_check),
  'server_updated_at advances on update');

insert into public.routines (id, user_id, name)
select gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'bulk ' || i from generate_series(1, 50) i;
select pg_temp.assert(
  (select count(distinct server_updated_at) = count(*) from public.routines where name like 'bulk %'),
  'rows from one statement get distinct server_updated_at');

-- Storage ------------------------------------------------------------------

select pg_temp.act_as('11111111-1111-1111-1111-111111111111');
insert into storage.objects (bucket_id, name)
values ('progress-photos', '11111111-1111-1111-1111-111111111111/front.jpg');
do $$
begin
  insert into storage.objects (bucket_id, name)
  values ('progress-photos', '22222222-2222-2222-2222-222222222222/front.jpg');
  raise exception 'FAILED: upload into another user''s folder was allowed';
exception when insufficient_privilege then
  raise notice 'ok: photos only in own folder';
end;
$$;
reset role;

rollback;
