const CACHE_NAME = "elms-v1";
const SHELL_ASSETS = [
  "/offline.html",
  "/manifest.webmanifest",
  "/icons/icon.svg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
];

function isNetworkOnlyPath(pathname) {
  return pathname === "/api" || pathname.startsWith("/api/")
    || pathname === "/oauth" || pathname.startsWith("/oauth/")
    || pathname === "/manus-storage" || pathname.startsWith("/manus-storage/");
}

function isStaticAsset(request, pathname) {
  if (["script", "style", "font", "image"].includes(request.destination)) return true;
  return /\.(?:m?js|css|woff2?|ttf|otf|svg|png|jpe?g|webp|ico|webmanifest)$/i.test(pathname);
}

function discoverShellAssets(markup) {
  const discovered = new Set();
  const tags = markup.match(/<(?:script|link)\b[^>]*>/gi) || [];

  for (const tag of tags) {
    const attribute = tag.match(/\b(?:src|href)\s*=\s*["']([^"']+)["']/i);
    if (!attribute) continue;

    try {
      const assetUrl = new URL(attribute[1], self.location.origin);
      if (assetUrl.origin !== self.location.origin || isNetworkOnlyPath(assetUrl.pathname)) continue;
      if (/\.(?:m?js|css|woff2?|ttf|otf|svg|png|jpe?g|webp|ico|webmanifest)$/i.test(assetUrl.pathname)) {
        discovered.add(assetUrl.href);
      }
    } catch {
      // Ignore malformed or non-URL asset references in the HTML shell.
    }
  }

  return [...discovered];
}

async function fetchAndCache(cache, url) {
  const response = await fetch(new Request(url, { cache: "reload" }));
  if (!response.ok || response.type === "opaque") {
    throw new Error(`Unable to precache ${url} (HTTP ${response.status})`);
  }
  await cache.put(url, response.clone());
  return response;
}

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      const shellResponse = await fetchAndCache(cache, "/");
      await cache.put("/index.html", shellResponse.clone());
      const shellMarkup = await shellResponse.clone().text();
      await Promise.all(SHELL_ASSETS.map(asset => fetchAndCache(cache, asset)));
      await Promise.all(discoverShellAssets(shellMarkup).map(asset => fetchAndCache(cache, asset)));
      await self.skipWaiting();
    } catch (error) {
      await caches.delete(CACHE_NAME);
      throw error;
    }
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames
      .filter(name => name.startsWith("elms-") && name !== CACHE_NAME)
      .map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

async function networkFirstNavigation(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response.ok && !response.redirected && response.type === "basic") {
      await cache.put("/", response.clone());
    }
    return response;
  } catch {
    return await cache.match(request, { ignoreSearch: true })
      || await cache.match("/")
      || await cache.match("/index.html")
      || await cache.match("/offline.html");
  }
}

async function cacheFirstStaticAsset(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request, { ignoreSearch: true });
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok && response.type === "basic") {
    await cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  const requestUrl = new URL(request.url);
  if (requestUrl.origin !== self.location.origin) return;

  if (isNetworkOnlyPath(requestUrl.pathname)) {
    event.respondWith(fetch(request));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (isStaticAsset(request, requestUrl.pathname)) {
    event.respondWith(cacheFirstStaticAsset(request));
  }
});
