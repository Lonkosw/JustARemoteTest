@AGENTS.md

# Project notes

- Offline-first PWA. Screens read and write IndexedDB (`src/lib/db.ts`, Dexie) first; Supabase is the sync target, never the source a screen waits on.
- Every page under `src/app/(app)/` is a client component. The `(app)` layout guards auth and profile.
- Row types in `src/lib/types.ts` use the same snake_case names as the SQL columns. Keep them in sync with `supabase/migrations/`.
- New synced tables need: SQL table + RLS (follow the loop in `0001_init.sql`), a type in `types.ts`, a Dexie store in `db.ts` (bump the Dexie version), and an entry in `SYNCED_TABLES`.
- Without `NEXT_PUBLIC_SUPABASE_*` env vars the app runs in local mode (`supabase` is null).
- UI copy is Brazilian Portuguese. Code, comments and commits are English.
- Checks: `npm run lint`, `npx tsc --noEmit` (after one `npm run build` or `next typegen` so `LayoutProps` exists), `npm run build`.
