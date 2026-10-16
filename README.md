# Treino (nome provisório)

App web (PWA) para registrar treinos, cargas e evolução física. Funciona offline na academia e sincroniza com o Supabase quando há internet.

## Stack

- **Next.js 16** (App Router) + TypeScript + Tailwind CSS 4
- **Dexie** (IndexedDB): banco local. Toda tela lê e grava aqui primeiro.
- **Supabase**: login, Postgres e storage de fotos. Opcional no desenvolvimento.
- **Service worker** próprio (`public/sw.js`): abre o app sem rede.

## Rodar localmente

```bash
npm install
npm run dev
```

Abra http://localhost:3000. Sem configurar o Supabase, o app roda em **modo local**: sem login, com os dados só no navegador.

## Conectar ao Supabase

1. Crie um projeto grátis em https://supabase.com.
2. No **SQL Editor**, rode o conteúdo de `supabase/migrations/0001_init.sql`.
3. Copie `.env.example` para `.env.local` e preencha com os valores de **Project Settings > API**.
4. Em **Authentication > URL Configuration**, coloque a URL do app (por exemplo `http://localhost:3000` e a URL da Vercel) em **Site URL** e **Redirect URLs**.
5. Opcional: login com Google em **Authentication > Providers > Google**.

## Deploy na Vercel

1. Importe o repositório em https://vercel.com/new.
2. Adicione as variáveis `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. Deploy. No celular, abra a URL e use **Adicionar à tela inicial**.

## Estrutura

| Caminho | Conteúdo |
|---|---|
| `src/app/(app)/` | Telas logadas: Treinar, Fichas, Evolução, Perfil |
| `src/app/login`, `src/app/onboarding` | Login e cadastro inicial |
| `src/lib/db.ts` | Esquema do IndexedDB (Dexie) |
| `src/lib/types.ts` | Tipos das linhas, iguais às colunas do SQL |
| `src/lib/exercises.ts` | Catálogo de exercícios (ids estáveis, nunca renomear) |
| `src/lib/templates.ts` | Modelos de ficha (Full Body, ABC, ABCD, PPL, Upper/Lower) |
| `src/lib/routines.ts` | Operações de fichas e exercícios personalizados |
| `supabase/migrations/` | Esquema do Postgres com RLS |
| `public/sw.js` | Service worker (cache offline) |
| `scripts/generate-icons.mjs` | Gera os ícones do PWA |

## Modelo de sincronização

- IDs são UUIDs gerados no aparelho.
- Cada linha tem `updated_at` (relógio do aparelho, usado em conflito: a última escrita vence), `deleted_at` (exclusão lógica) e, no servidor, `server_updated_at` (cursor para baixar mudanças).
- No IndexedDB, `dirty = 1` marca linhas ainda não enviadas.

## Roteiro

1. ✅ Setup, PWA, login, esquema do banco, onboarding e perfil
2. ✅ Biblioteca de exercícios (151 + personalizados) e fichas (manual + modelos prontos)
3. Treino ao vivo offline: timer de descanso, carga anterior, sincronização
4. Recordes (PR), 1RM estimado, histórico e gráficos
5. Peso, medidas e fotos de progresso
