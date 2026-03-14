"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

export default function IntroSplash() {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(true);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const alreadySeen = sessionStorage.getItem("ispeak_intro_seen");

    if (alreadySeen) {
      setVisible(false);
      return;
    }

    const enterTimer = setTimeout(() => setMounted(true), 20);
    const leaveTimer = setTimeout(() => setLeaving(true), 780);
    const doneTimer = setTimeout(() => {
      sessionStorage.setItem("ispeak_intro_seen", "1");
      setVisible(false);
    }, 1080);

    return () => {
      clearTimeout(enterTimer);
      clearTimeout(leaveTimer);
      clearTimeout(doneTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#f5f5f5",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        opacity: leaving ? 0 : 1,
        transition: "opacity 280ms ease",
      }}
    >
      <div
        style={{
          transform: mounted
            ? leaving
              ? "scale(0.98) rotate(0deg)"
              : "scale(1) rotate(0deg)"
            : "scale(0.92) rotate(-6deg)",
          opacity: mounted ? 1 : 0,
          transition:
            "transform 560ms cubic-bezier(0.22, 1, 0.36, 1), opacity 360ms ease",
          filter: "drop-shadow(0 10px 22px rgba(0,0,0,0.12))",
        }}
      >
        <Image
          src="/brand/logo.png"
          alt="iSpeak"
          width={170}
          height={170}
          priority
        />
      </div>
    </div>
  );
}