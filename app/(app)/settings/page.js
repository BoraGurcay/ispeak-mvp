"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import PushTestButton from "../../../components/PushTestButton";

export default function SettingsPage() {
  const [textSize, setTextSize] = useState("normal");
  const [sessions, setSessions] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(true);

  useEffect(() => {
    const v = localStorage.getItem("ispeak_text_size") || "normal";
    setTextSize(v);
    apply(v);
    loadSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function apply(v) {
    const root = document.documentElement;
    root.style.fontSize = v === "large" ? "18px" : "16px";
    localStorage.setItem("ispeak_text_size", v);
  }

  async function loadSessions() {
    try {
      setLoadingSessions(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setSessions([]);
        return;
      }

      const { data, error } = await supabase
        .from("play_sessions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) {
        console.error("Session history error:", error);
        return;
      }

      setSessions(data || []);
    } catch (err) {
      console.error("Unexpected history error:", err);
    } finally {
      setLoadingSessions(false);
    }
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
          Language pair training platform for interpreters
        </div>

        <div className="hr" />

        <PushTestButton />

        <div className="hr" />

        <a href="/feedback" className="btn btnPrimary">
          Send Feedback
        </a>

        <div className="hr" />

        <div className="h1" style={{ fontSize: "1.4rem" }}>
          Training History
        </div>

        {loadingSessions ? (
          <div className="small muted">Loading sessions...</div>
        ) : sessions.length === 0 ? (
          <div className="small muted">
            No sessions yet. Try Play mode to start training.
          </div>
        ) : (
          <div className="col" style={{ gap: 10, marginTop: 10 }}>
            {sessions.map((s) => {
              const date = new Date(s.created_at).toLocaleString();

              return (
                <div key={s.id} className="card" style={{ padding: 12 }}>
                  <div className="small muted">{date}</div>

                  <div style={{ marginTop: 4 }}>
                    {String(s.language).toUpperCase()} • {s.domain}
                  </div>

                  <div className="small">
                    Score: {s.correct_count}/{s.attempted_count}
                  </div>

                  <div className="small muted">
                    Accuracy: {s.accuracy}%
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}