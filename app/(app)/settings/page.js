"use client";

import { useEffect, useState } from "react";
import PushTestButton from "../../../components/PushTestButton";

export default function SettingsPage() {
  const [textSize, setTextSize] = useState("normal");

  useEffect(() => {
    const v = localStorage.getItem("ispeak_text_size") || "normal";
    setTextSize(v);
    apply(v);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function apply(v) {
    const root = document.documentElement;
    root.style.fontSize = v === "large" ? "18px" : "16px";
    localStorage.setItem("ispeak_text_size", v);
  }

  return (
    <div className="container">
      <div className="card">
        <div className="h1">Settings</div>

        <label className="small muted">Text size</label>
        <select
          className="select"
          value={textSize}
          onChange={(e) => {
            setTextSize(e.target.value);
            apply(e.target.value);
          }}
        >
          <option value="normal">Normal</option>
          <option value="large">Large</option>
        </select>

        <div className="hr" />

        <div className="small muted">
          Professional interpreter training platform
        </div>

        <div className="small muted" style={{ marginTop: 6 }}>
          Languages: Turkish, French, Spanish, Portuguese, Hindi, Arabic, Mandarin
        </div>

        <div className="hr" />

        <a href="/feedback" className="btn">
          Send Feedback
        </a>

        <div className="small muted" style={{ marginTop: 8 }}>
          Share ideas, report issues, or suggest new features.
        </div>

        <div className="hr" />

        <PushTestButton />
      </div>
    </div>
  );
}