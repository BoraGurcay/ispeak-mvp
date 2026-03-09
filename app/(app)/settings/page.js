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

        <div
          className="small muted"
          style={{ marginTop: 6, lineHeight: 1.6, maxWidth: 620 }}
        >
          Manage your learning preferences, notifications, and review your
          recent training sessions.
        </div>

        <div className="hr" />

        {/* DISPLAY */}
        <div className="h2" style={{ marginBottom: 10 }}>
          Display
        </div>

        <label>
          <div className="small muted" style={{ marginBottom: 6 }}>
            Text size
          </div>
          <select
            className="input"
            value={textSize}
            onChange={(e) => {
              setTextSize(e.target.value);
              apply(e.target.value);
            }}
          >
            <option value="normal">Normal</option>
            <option value="large">Large</option>
          </select>
        </label>

        <div className="hr" />

        {/* NOTIFICATIONS */}
        <div className="h2" style={{ marginBottom: 10 }}>
          Notifications
        </div>

        <div className="small muted" style={{ marginBottom: 10 }}>
          Enable push notifications to receive training reminders.
        </div>

        <PushTestButton />

        <div className="hr" />

        {/* FEEDBACK */}
        <div className="h2" style={{ marginBottom: 10 }}>
          Feedback
        </div>

        <div className="small muted" style={{ marginBottom: 10 }}>
          Help improve iSpeak by reporting issues or suggesting terminology
          improvements.
        </div>

        <a href="/feedback" className="btn btnPrimary">
          Send Feedback
        </a>

        <div className="hr" />

        {/* TRAINING HISTORY */}
        <div className="h2" style={{ marginBottom: 10 }}>
          Training History
        </div>

        {loadingSessions ? (
          <div className="small muted">Loading recent sessions...</div>
        ) : sessions.length === 0 ? (
          <div className="small muted">
            No training sessions yet. Start a Play session to begin tracking your
            progress.
          </div>
        ) : (
          <div className="col" style={{ gap: 10 }}>
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