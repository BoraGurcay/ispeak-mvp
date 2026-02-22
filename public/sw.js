/* public/sw.js */

// ----- Install / Activate -----
self.addEventListener("install", (event) => {
  // Activate updated SW immediately
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Take control of all pages ASAP
  event.waitUntil(self.clients.claim());
});

// ----- Push: show notification -----
self.addEventListener("push", (event) => {
  let payload = {};

  // event.data might be missing or not JSON
  try {
    payload = event.data ? event.data.json() : {};
  } catch (e) {
    try {
      payload = { body: event.data ? event.data.text() : "" };
    } catch (e2) {
      payload = {};
    }
  }

  const title = payload.title || "iSpeak";
  const body = payload.body || "✅ Push notifications are working!";

  // You can pass extra data to open a specific route
  const openUrl =
    payload.url ||
    payload.data?.url ||
    "/settings";

  const options = {
    body,
    icon: payload.icon || "/icons/icon-192.png",
    badge: payload.badge || "/icons/icon-192.png",
    data: {
      url: openUrl,
      ...payload.data,
    },
    // Helps on Android to group/replace notifications
    tag: payload.tag || "ispeak-test",
    renotify: true,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ----- Click: focus/open app -----
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const urlToOpen = event.notification?.data?.url || "/settings";

  event.waitUntil(
    (async () => {
      // Find an existing open tab/window for this origin
      const allClients = await clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      // Prefer focusing an existing client
      for (const client of allClients) {
        // If you want to focus any tab of the app regardless of route:
        if (client.url.includes(self.location.origin)) {
          await client.focus();

          // Navigate it to the target route if possible
          try {
            client.navigate(urlToOpen);
          } catch {}
          return;
        }
      }

      // Otherwise open a new one
      return clients.openWindow(urlToOpen);
    })()
  );
});