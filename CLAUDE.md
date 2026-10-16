@AGENTS.md

# Project notes

- Offline-first PWA. Screens read and write IndexedDB (`src/lib/db.ts`, Dexie) first; Supabase is the sync target, never the source a screen waits on.
- Every page under `src/app/(app)/` is a client component. The `(app)` layout guards auth and profile.
- Row types in `src/lib/types.ts` use the same snake_case names as the SQL columns. Keep them in sync with `supabase/migrations/`.
- New synced tables need: SQL table + RLS (follow the loop in `0001_init.sql`), a type in `types.ts`, a Dexie store in `db.ts` (bump the Dexie version), and an entry in `SYNCED_TABLES`.
- Sync (`src/lib/sync.ts`) pushes dirty rows in `SYNCED_TABLES` order (parents first), then pulls by `server_updated_at` cursor. Never write a row without `touchedFields()`/`newRowFields()` or it will not sync.
- Without `NEXT_PUBLIC_SUPABASE_*` env vars the app runs in local mode (`supabase` is null).
- UI copy is Brazilian Portuguese. Code, comments and commits are English.
- Checks: `npm run lint`, `npm run typecheck`, `npm test` (Vitest), `npm run test:e2e` (Playwright, local mode), `npm run test:db` and `npm run test:sync` (need Postgres binaries; start a throwaway backend), or `npm run test:all`.
- New behaviour gets a test: pure logic in `src/lib/*.test.ts`, screens in `e2e/*.spec.ts`, SQL/RLS in `supabase/tests/`.
