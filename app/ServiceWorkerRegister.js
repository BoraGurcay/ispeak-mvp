"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegister({ version = "v1" }) {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const onLoad = async () => {
      try {
        // Version query forces the browser to re-fetch sw.js when you bump version
        const reg = await navigator.serviceWorker.register(`/sw.js?${version}`, {
          scope: "/",
        });

        // Ask SW to check for updates right away
        reg.update();

        // If a new SW is waiting, activate it immediately
        if (reg.waiting) {
          reg.waiting.postMessage({ type: "SKIP_WAITING" });
        }

        reg.addEventListener("updatefound", () => {
          const newWorker = reg.installing;
          if (!newWorker) return;

          newWorker.addEventListener("statechange", () => {
            // When the new SW takes over, reload so assets/icons are fresh
            if (newWorker.state === "activated") {
              window.location.reload();
            }
          });
        });
      } catch (err) {
        console.error("SW registration failed:", err);
      }
    };

    window.addEventListener("load", onLoad);
    return () => window.removeEventListener("load", onLoad);
  }, [version]);

  return null;
}