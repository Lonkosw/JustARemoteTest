// Service worker: lets the installed app open with no network.
//
// - Install: cache every page's HTML and the build assets it references, so
//   screens never opened online still work offline.
// - Build assets (/_next/static, hashed names) and icons: cache first.
// - Page navigations: network first, fall back to the cached page, then to
//   the cached home page (every screen renders on the client from IndexedDB).
//   A fresh page also refreshes the cached copies of its assets.
// - Everything else, including Supabase requests (other origin): untouched.
//
// Bump VERSION to drop old caches after a breaking change.

const VERSION = "v6";
const STATIC_CACHE = `static-${VERSION}`;
const PAGE_CACHE = `pages-${VERSION}`;
const PRECACHE_PAGES = [
  "/",
  "/login",
  "/onboarding",
  "/fichas",
  "/fichas/modelos",
  "/fichas/editar",
  "/treino",
  "/treino/resumo",
  "/evolucao",
  "/evolucao/exercicio",
  "/corpo/medidas",
  "/corpo/foto",
  "/corpo/comparar",
  "/perfil",
];
const ASSET_PATTERN = /\/_next\/static\/[^"'\s)\\]+/g;

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const pages = await caches.open(PAGE_CACHE);
      await Promise.all(
        PRECACHE_PAGES.map(async (path) => {
          const response = await fetch(path, { cache: "no-store" });
          if (!response.ok) throw new Error(`precache ${path}: ${response.status}`);
          await pages.put(path, response.clone());
          await cacheAssets(await response.text());
        }),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== STATIC_CACHE && key !== PAGE_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirstPage(event, request));
  }
});

/** Cache every build asset an HTML page references that is not cached yet. */
async function cacheAssets(html) {
  const cache = await caches.open(STATIC_CACHE);
  const urls = [...new Set(html.match(ASSET_PATTERN) ?? [])];
  await Promise.all(
    urls.map(async (url) => {
      if (await cache.match(url)) return;
      try {
        const response = await fetch(url);
        if (response.ok) await cache.put(url, response);
      } catch {
        // Offline or gone: the next page load retries.
      }
    }),
  );
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(STATIC_CACHE);
    cache.put(request, response.clone());
  }
  return response;
}

async function networkFirstPage(event, request) {
  const cache = await caches.open(PAGE_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) {
      // Store under the path only: one copy per screen, whatever the ?id=.
      const path = new URL(request.url).pathname;
      cache.put(path, response.clone());
      event.waitUntil(response.clone().text().then(cacheAssets));
    }
    return response;
  } catch (error) {
    const path = new URL(request.url).pathname;
    const cached = (await cache.match(path)) ?? (await cache.match("/"));
    if (cached) return cached;
    throw error;
  }
}
