/* NEET Track service worker: notifications only (no caching). */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  event.waitUntil((async () => {
    let msg = { title: "NEET Track", body: "Open NEET Track to see what's new.", url: "/dashboard", kind: "general" };
    try {
      const res = await fetch("/api/public/push/latest", { cache: "no-store" });
      if (res.ok) msg = Object.assign(msg, await res.json());
    } catch (e) { /* show the default text */ }
    await self.registration.showNotification(msg.title, {
      body: msg.body,
      icon: "/icons/icon-192.png",
      badge: "/favicon-32.png",
      tag: msg.kind || "neettrack",
      renotify: true,
      data: { url: msg.url || "/dashboard" },
    });
  })());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || "/dashboard", self.location.origin).href;
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const w of wins) {
      if (w.url.startsWith(self.location.origin)) { await w.focus(); if ("navigate" in w) return w.navigate(url); return; }
    }
    return self.clients.openWindow(url);
  })());
});
