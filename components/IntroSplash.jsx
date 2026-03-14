"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

export default function IntroSplash() {
  const [visible, setVisible] = useState(true);
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    const alreadySeen = sessionStorage.getItem("ispeak_intro_seen");

    if (alreadySeen) {
      setVisible(false);
      return;
    }

    const raf = requestAnimationFrame(() => {
      setAnimate(true);
    });

    const timer = setTimeout(() => {
      sessionStorage.setItem("ispeak_intro_seen", "1");
      setVisible(false);
    }, 1100);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
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
      }}
    >
      <div
        style={{
          transform: animate
            ? "scale(1) rotate(0deg)"
            : "scale(0.86) rotate(-10deg)",
          opacity: animate ? 1 : 0,
          transition:
            "transform 700ms cubic-bezier(0.22, 1, 0.36, 1), opacity 500ms ease",
          filter: "drop-shadow(0 10px 20px rgba(0,0,0,0.12))",
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