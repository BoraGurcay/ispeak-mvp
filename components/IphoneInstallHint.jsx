"use client";

import { useEffect, useState } from "react";

export default function IPhoneInstallHint() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem("ispeak_ios_install_dismissed");

    const isIos =
      /iPhone|iPad|iPod/i.test(window.navigator.userAgent) ||
      (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1);

    const isStandalone =
      window.navigator.standalone === true ||
      window.matchMedia("(display-mode: standalone)").matches;

    if (isIos && !isStandalone && dismissed !== "1") {
      setVisible(true);
    }
  }, []);

  function dismissHint() {
    localStorage.setItem("ispeak_ios_install_dismissed", "1");
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
        Install iSpeak on iPhone
      </div>

      <div className="small muted" style={{ lineHeight: 1.7, marginBottom: 12 }}>
        Open the Share menu in Safari, then tap <strong>Add to Home Screen</strong> for
        faster access and a more app-like experience.
      </div>

      <button className="btn" type="button" onClick={dismissHint}>
        Got it
      </button>
    </div>
  );
}