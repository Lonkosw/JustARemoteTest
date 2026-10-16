-- The parts of Supabase the migrations and the app rely on, for a plain
-- Postgres used in tests: roles, auth.users, auth.uid() and storage.

create role anon nologin;
create role authenticated nologin;
create role authenticator login noinherit;
grant anon, authenticated to authenticator;

create schema auth;
create table auth.users (id uuid primary key);
-- PostgREST puts the verified JWT claims in request.jwt.claims.
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true)::json ->> 'sub', '')::uuid
$$;

create schema storage;
create table storage.buckets (id text primary key, name text, public boolean);
create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name text not null,
  owner uuid,
  created_at timestamptz default now()
);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as $$
  select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
$$;

grant usage on schema public, auth, storage to anon, authenticated;
-- Supabase grants table privileges to these roles; RLS does the filtering.
alter default privileges in schema public grant all on tables to anon, authenticated;
grant all on storage.objects to authenticated;

insert into auth.users (id) values
  ('11111111-1111-1111-1111-111111111111'),
  ('22222222-2222-2222-2222-222222222222');
