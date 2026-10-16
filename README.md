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
2. No **SQL Editor**, rode os arquivos de `supabase/migrations/` em ordem (`0001_init.sql`, depois `0002_workout_order_and_sync.sql`).
3. Copie `.env.example` para `.env.local` e preencha com os valores de **Project Settings > API**.
4. Em **Authentication > URL Configuration**, coloque a URL do app (por exemplo `http://localhost:3000` e a URL da Vercel) em **Site URL** e **Redirect URLs**.
5. Opcional: login com Google em **Authentication > Providers > Google**.

## Deploy na Vercel

1. Importe o repositório em https://vercel.com/new.
2. Adicione as variáveis `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. Deploy. No celular, abra a URL e use **Adicionar à tela inicial**.

## Testes

| Comando | O que testa |
|---|---|
| `npm test` | Unitários (Vitest): cálculos de 1RM e recordes, progressão, fichas, treinos e o motor de sincronização com um Supabase falso em memória |
| `npm run test:db` | Banco (SQL): RLS, “última escrita vence”, cursor de sincronização e storage. Sobe um Postgres local descartável |
| `npm run test:e2e` | Ponta a ponta (Playwright, tela de celular) em modo local: onboarding, fichas, treino ao vivo, evolução e uso offline |
| `npm run test:sync` | Ponta a ponta da sincronização com dois “aparelhos” contra um backend local (Postgres + PostgREST, a API que o Supabase usa) |
| `npm run test:all` | Tudo acima, mais lint e typecheck |

`test:db` e `test:sync` precisam dos binários do Postgres (`apt install postgresql`) e baixam o PostgREST na primeira execução. O GitHub Actions (`.github/workflows/ci.yml`) roda tudo a cada push.

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
| `src/lib/workouts.ts` | Treino ao vivo, carga anterior e sugestão de progressão |
| `src/lib/sync.ts` | Sincronização IndexedDB ⇄ Supabase |
| `src/lib/stats.ts` | 1RM estimado, recordes, sessões por exercício, volume semanal |
| `e2e/`, `src/**/*.test.ts`, `supabase/tests/` | Testes |
| `scripts/test-backend/` | Backend local para testes (Postgres + PostgREST) |
| `supabase/migrations/` | Esquema do Postgres com RLS |
| `public/sw.js` | Service worker (cache offline) |
| `scripts/generate-icons.mjs` | Gera os ícones do PWA |

## Modelo de sincronização

- IDs são UUIDs gerados no aparelho.
- Cada linha tem `updated_at` (relógio do aparelho, usado em conflito: a última escrita vence), `deleted_at` (exclusão lógica) e, no servidor, `server_updated_at` (cursor para baixar mudanças).
- No IndexedDB, `dirty = 1` marca linhas ainda não enviadas.
- O app envia as linhas `dirty` (pais antes de filhos) e depois baixa o que mudou no servidor desde o último cursor. Roda ao abrir, ao voltar a internet, a cada minuto e 2 s depois de qualquer alteração local.
- No servidor, um trigger ignora atualizações com `updated_at` mais antigo que o já salvo.

## Recordes

O 1RM é estimado pela fórmula de Epley (carga × (1 + reps/30)), só para séries de 1 a 15 repetições. Uma série vira recorde quando supera o 1RM estimado, a maior carga ou, em exercícios sem carga, o máximo de repetições de todos os treinos anteriores. A primeira sessão de um exercício não gera recordes.

## Progressão de carga

Dupla progressão: se em todas as séries válidas do último treino você bateu o topo da faixa de repetições (por exemplo 10 em "8-10"), o app sugere +2,5 kg (barra, máquina, polia), +2 kg (halter) ou +1 repetição (peso corporal), voltando ao mínimo da faixa. Caso contrário, repete a carga anterior.

## Roteiro

1. ✅ Setup, PWA, login, esquema do banco, onboarding e perfil
2. ✅ Biblioteca de exercícios (151 + personalizados) e fichas (manual + modelos prontos)
3. ✅ Treino ao vivo offline: timer de descanso, carga anterior, sugestão de progressão, sincronização
4. ✅ Histórico, recordes (PR), 1RM estimado, gráficos por exercício, séries por grupo muscular e suíte de testes
5. Peso, medidas e fotos de progresso
