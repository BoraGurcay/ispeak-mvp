"use client";

import { useState } from "react";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i);
  return out;
}

export default function PushTestButton() {
  const [status, setStatus] = useState("");

  async function onClick() {
    try {
      setStatus("Requesting permission…");

      if (!("serviceWorker" in navigator)) throw new Error("Service Worker not supported in this browser.");
      if (!("PushManager" in window)) throw new Error("Push not supported in this browser.");

      const permission = await Notification.requestPermission();
      if (permission !== "granted") throw new Error("Notification permission not granted.");

      setStatus("Registering service worker…");
      const reg = await navigator.serviceWorker.register("/sw.js");

      setStatus("Subscribing…");
      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) throw new Error("Missing NEXT_PUBLIC_VAPID_PUBLIC_KEY in .env.local");

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      setStatus("Sending test push…");
      const res = await fetch("/api/push/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: sub }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Failed to send push");

      setStatus("✅ Sent! You should receive a notification now.");
    } catch (e) {
      setStatus(`❌ ${e.message || String(e)}`);
      console.error(e);
    }
  }

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <button className="btn" onClick={onClick}>
        Enable Push + Send Test
      </button>
      <div className="muted">{status}</div>
    </div>
  );
}