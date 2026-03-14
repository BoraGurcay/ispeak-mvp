"use client";

import { useEffect, useState } from "react";

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem("ispeak_install_dismissed");

    function handleBeforeInstallPrompt(e) {
      e.preventDefault();

      if (dismissed === "1") return;

      setDeferredPrompt(e);
      setVisible(true);
    }

    function handleAppInstalled() {
      setVisible(false);
      setDeferredPrompt(null);
      localStorage.removeItem("ispeak_install_dismissed");
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  async function installApp() {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;

    if (choice?.outcome === "accepted") {
      setVisible(false);
    }

    setDeferredPrompt(null);
  }

  function dismissBanner() {
    localStorage.setItem("ispeak_install_dismissed", "1");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      className="card"
      style={{
        marginBottom: 12,
        border: "1px solid rgba(0,0,0,0.06)",
      }}
    >
      <div className="h2" style={{ marginBottom: 8 }}>
        Install iSpeak
      </div>

      <div className="small muted" style={{ lineHeight: 1.7, marginBottom: 12 }}>
        Add iSpeak to your home screen for faster access and a more app-like experience.
      </div>

      <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
        <button className="btn btnPrimary" type="button" onClick={installApp}>
          Install App
        </button>

        <button className="btn" type="button" onClick={dismissBanner}>
          Maybe Later
        </button>
      </div>
    </div>
  );
}