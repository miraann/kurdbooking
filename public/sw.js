// Service worker for browser push alerts (lib/push.ts sends them).
// Kept tiny on purpose: no caching, no offline mode.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let msg = { title: "KurdBooking", body: "", url: "/super" };
  try {
    msg = { ...msg, ...event.data.json() };
  } catch {
    if (event.data) msg.body = event.data.text();
  }
  event.waitUntil(
    self.registration.showNotification(msg.title, {
      body: msg.body,
      tag: msg.tag,
      renotify: !!msg.tag,
      icon: "/favicon.ico",
      data: { url: msg.url },
    }),
  );
});

// Tap → focus an open tab of the site and go to the link, or open a new one.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/super", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((tabs) => {
      const tab = tabs.find((c) => new URL(c.url).origin === self.location.origin);
      if (tab) return tab.focus().then((c) => c.navigate(url));
      return self.clients.openWindow(url);
    }),
  );
});
