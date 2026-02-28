"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

/* ---------------- Helpers ---------------- */

function stripBracketed(s) {
  return (s || "")
    .toString()
    .replace(/\(([^)]*)\)/g, " ")
    .replace(/\[([^\]]*)\]/g, " ")
    .replace(/\{([^}]*)\}/g, " ");
}

function stripDiacritics(s) {
  return (s || "")
    .toString()
    .replace(/ı/g, "i")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizeAnswer(s) {
  return stripDiacritics(stripBracketed(s))
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function pickRandom(arr) {
  if (!arr || arr.length === 0) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

/* ---------------- Page ---------------- */

const LANGUAGES = [
  { value: "tr", label: "Turkish (TR)" },
  { value: "fr", label: "French (FR)" },
  { value: "es", label: "Spanish (ES)" },
  { value: "pt", label: "Portuguese (PT)" },
];

const LS_KEY = "ispeak_target_lang";

export default function PracticePage() {
  const inputRef = useRef(null);

  const [lang, setLang] = useState("tr");
  const [mode, setMode] = useState("normal");

  const [loading, setLoading] = useState(true);
  const [pool, setPool] = useState([]);
  const [current, setCurrent] = useState(null);

  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState(null);

  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);

  // Restore saved language (so Practice & Glossary stay in sync)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LS_KEY);
      if (LANGUAGES.some((l) => l.value === saved)) setLang(saved);
    } catch {}
  }, []);

  // Persist language
  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, lang);
    } catch {}
  }, [lang]);

  const filteredPool = useMemo(() => {
    if (mode === "hard") {
      return pool.filter((t) => (t.difficulty ?? 1) >= 3);
    }
    return pool;
  }, [pool, mode]);

  useEffect(() => {
    if (!filteredPool.length) {
      setCurrent(null);
      return;
    }
    if (!current || !filteredPool.some((t) => t.id === current.id)) {
      setCurrent(pickRandom(filteredPool));
    }
  }, [filteredPool, current]);

  useEffect(() => {
    let cancelled = false;

    async function loadPool() {
      setLoading(true);
      setPool([]);
      setCurrent(null);
      setAnswer("");
      setFeedback(null);

      // Shared pack terms
      const sharedRes = await supabase
        .from("terms")
        .select("id, source_text, target_text, domain, target_lang, difficulty")
        .eq("target_lang", lang);

      // Personal terms (if logged in)
      let personal = [];
      const authRes = await supabase.auth.getUser();
      const uid = authRes?.data?.user?.id ?? null;

      if (uid) {
        const personalRes = await supabase
          .from("user_terms")
          .select("id, source_text, target_text, domain, target_lang, difficulty")
          .eq("user_id", uid)
          .eq("target_lang", lang);

        if (!personalRes.error) {
          personal = (personalRes.data || []).map((r) => ({
            id: r.id,
            source: r.source_text,
            target: r.target_text,
            domain: r.domain ?? "unassigned",
            difficulty: r.difficulty ?? 1,
          }));
        }
      }

      const shared = (sharedRes.data || []).map((r) => ({
        id: r.id,
        source: r.source_text,
        target: r.target_text,
        domain: r.domain ?? "unassigned",
        difficulty: r.difficulty ?? 1,
      }));

      const merged = [...shared, ...personal];

      if (!cancelled) {
        setPool(merged);
        setCurrent(pickRandom(merged));
        setLoading(false);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
    }

    loadPool();
    return () => {
      cancelled = true;
    };
  }, [lang]);

  function checkAnswer() {
    if (!current) return;

    const guess = normalizeAnswer(answer);
    const target = normalizeAnswer(current.target);

    if (!guess) return;

    if (guess === target) {
      setScore((s) => s + 1);
      setStreak((s) => s + 1);
      setFeedback({ ok: true, msg: "Correct ✅" });

      const next = pickRandom(filteredPool);
      setCurrent(next);
      setAnswer("");
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setStreak(0);
      setFeedback({
        ok: false,
        msg: `Not quite. Correct: ${current.target}`,
      });
    }
  }

  function nextCard() {
    const next = pickRandom(filteredPool);
    setCurrent(next);
    setAnswer("");
    setFeedback(null);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  const langLabel = LANGUAGES.find((l) => l.value === lang)?.label ?? lang;

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
      <h1 style={{ fontSize: 42, margin: 0 }}>Practice</h1>

      <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 12 }}>
        <div>
          <div style={{ fontSize: 14, opacity: 0.7 }}>Language</div>
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            style={{ padding: "10px 12px", borderRadius: 10 }}
          >
            {LANGUAGES.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", gap: 8, marginLeft: 12 }}>
          <button
            onClick={() => setMode("normal")}
            style={{
              padding: "10px 14px",
              borderRadius: 999,
              background: mode === "normal" ? "#111" : "#fff",
              color: mode === "normal" ? "#fff" : "#111",
              border: "1px solid #ddd",
            }}
          >
            Normal
          </button>

          <button
            onClick={() => setMode("hard")}
            style={{
              padding: "10px 14px",
              borderRadius: 999,
              background: mode === "hard" ? "#111" : "#fff",
              color: mode === "hard" ? "#fff" : "#111",
              border: "1px solid #ddd",
            }}
          >
            Hard Words
          </button>
        </div>

        <div style={{ marginLeft: "auto", textAlign: "right" }}>
          <div style={{ fontSize: 14, opacity: 0.7 }}>
            Score: <b>{score}</b> &nbsp;&nbsp; Streak: <b>{streak}</b>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 24 }}>
        {loading ? (
          <div>Loading…</div>
        ) : !current ? (
          <div>No terms found.</div>
        ) : (
          <div
            style={{
              padding: 18,
              border: "1px solid #eee",
              borderRadius: 16,
              background: "#fff",
            }}
          >
            <div style={{ fontSize: 12, opacity: 0.6 }}>
              Domain: <b>{current.domain}</b> · Difficulty: <b>{current.difficulty ?? 1}</b>
            </div>

            <div style={{ fontSize: 28, fontWeight: 700, margin: "12px 0" }}>
              {current.source}
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <input
                ref={inputRef}
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && checkAnswer()}
                placeholder={`Type the ${langLabel} translation…`}
                style={{ flex: 1, padding: 12, borderRadius: 12, border: "1px solid #ddd" }}
              />

              <button
                onClick={checkAnswer}
                style={{
                  padding: 12,
                  borderRadius: 12,
                  background: "#111",
                  color: "#fff",
                }}
              >
                Check
              </button>

              <button
                onClick={nextCard}
                style={{
                  padding: 12,
                  borderRadius: 12,
                  border: "1px solid #ddd",
                }}
              >
                Next
              </button>
            </div>

            {feedback && (
              <div style={{ marginTop: 12, color: feedback.ok ? "green" : "crimson" }}>
                {feedback.msg}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}