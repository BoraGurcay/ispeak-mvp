/* public/sw.js */

const CACHE_VERSION = "v5"; // bump together with layout ASSET_VERSION
const RUNTIME_CACHE = `runtime-${CACHE_VERSION}`;

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // delete old caches
      const keys = await caches.keys();
      await Promise.all(
        keys.map((k) => {
          if (k !== RUNTIME_CACHE) return caches.delete(k);
        })
      );
      await self.clients.claim();
    })()
  );
});

// NOTE: no fetch caching here (keeps it simple and avoids stale icons)

// ----- Push: show notification -----
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    try {
      payload = { body: event.data ? event.data.text() : "" };
    } catch {
      payload = {};
    }
  }

  const title = payload.title || "iSpeak";
  const body = payload.body || "✅ Push notifications are working!";
  const openUrl = payload.url || payload.data?.url || "/settings";

  const options = {
    body,
    // Use your v2 icon paths here:
    icon: payload.icon || "/icons/icon-192-v2.png",
    badge: payload.badge || "/icons/icon-192-v2.png",
    data: { url: openUrl, ...payload.data },
    tag: payload.tag || "ispeak-test",
    renotify: true,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const urlToOpen = event.notification?.data?.url || "/settings";

  event.waitUntil(
    (async () => {
      const allClients = await clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      for (const client of allClients) {
        if (client.url.includes(self.location.origin)) {
          await client.focus();
          try {
            client.navigate(urlToOpen);
          } catch {}
          return;
        }
      }

      return clients.openWindow(urlToOpen);
    })()
  );
});