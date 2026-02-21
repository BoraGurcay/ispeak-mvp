"use client";
import { useEffect, useState } from "react";

export default function Settings() {
  const [textSize, setTextSize] = useState("normal");

  useEffect(() => {
    const v = localStorage.getItem("ispeak_text_size") || "normal";
    setTextSize(v);
    apply(v);
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
          Language pair: EN ↔ TR (more languages coming soon)
        </div>
      </div>
    </div>
  );
}
