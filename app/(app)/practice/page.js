"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

/** ---------------- Helpers (simple + reliable) ---------------- **/

function stripBracketed(s) {
  // remove (...), [...], {...}
  return (s || "")
    .toString()
    .replace(/\(([^)]*)\)/g, " ")
    .replace(/\[([^\]]*)\]/g, " ")
    .replace(/\{([^}]*)\}/g, " ");
}

function stripDiacritics(s) {
  // Handles most accents via NFD + combining marks
  // Also handles Turkish dotless ı explicitly
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
  const idx = Math.floor(Math.random() * arr.length);
  return arr[idx];
}

/** ---------------- Page ---------------- **/

const LANGUAGES = [
  { value: "tr", label: "Turkish (TR)" },
  { value: "fr", label: "French (FR)" },
];

export default function PracticePage() {
  const inputRef = useRef(null);

  const [lang, setLang] = useState("tr");
  const [mode, setMode] = useState("normal"); // "normal" | "hard"

  const [loading, setLoading] = useState(true);
  const [dataSource, setDataSource] = useState("(loading)");
  const [pool, setPool] = useState([]);
  const [current, setCurrent] = useState(null);

  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState(null); // { ok: boolean, msg: string }

  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);

  // Filter by mode after load
  const filteredPool = useMemo(() => {
    if (mode === "hard") {
      return pool.filter((t) => (t.difficulty ?? 1) >= 3);
    }
    return pool;
  }, [pool, mode]);

  // Ensure current is valid for the current filter
  useEffect(() => {
    if (!filteredPool.length) {
      setCurrent(null);
      return;
    }
    // If current isn't in filtered set, pick a new one
    if (!current || !filteredPool.some((t) => t.id === current.id)) {
      setCurrent(pickRandom(filteredPool));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredPool]);

  // Load pool when language changes
  useEffect(() => {
    let cancelled = false;

    async function loadPool() {
      setLoading(true);
      setDataSource("(loading)");
      setPool([]);
      setCurrent(null);
      setAnswer("");
      setFeedback(null);

      // 1) Shared terms from `terms`
      const sharedRes = await supabase
        .from("terms")
        .select("id, source_text, target_text, domain, target_lang, difficulty")
        .eq("target_lang", lang);

      // 2) Personal terms from `user_terms` (optional)
      let personal = [];
      let uid = null;

      const authRes = await supabase.auth.getUser();
      uid = authRes?.data?.user?.id ?? null;

      if (uid) {
        const personalRes = await supabase
          .from("user_terms")
          .select("id, source_text, target_text, domain, target_lang, difficulty, user_id")
          .eq("user_id", uid)
          .eq("target_lang", lang);

        if (personalRes?.error) {
          console.warn("personal terms load warning:", personalRes.error.message);
        } else {
          personal = (personalRes.data || []).map((r) => ({
            id: r.id,
            source: r.source_text,
            target: r.target_text,
            domain: r.domain ?? "unassigned",
            lang: r.target_lang,
            difficulty: r.difficulty ?? 1,
            _origin: "personal",
          }));
        }
      }

      if (sharedRes?.error) {
        console.error("practice shared terms error:", sharedRes.error.message);

        // If shared fails, we still show personal (if any), otherwise show error
        const mergedOnlyPersonal = personal;

        if (!cancelled) {
          setPool(mergedOnlyPersonal);
          setCurrent(pickRandom(mergedOnlyPersonal));
          setDataSource(mergedOnlyPersonal.length ? "personal" : "(error)");
          setLoading(false);
        }
        return;
      }

      const shared = (sharedRes.data || []).map((r) => ({
        id: r.id,
        source: r.source_text,
        target: r.target_text,
        domain: r.domain ?? "unassigned",
        lang: r.target_lang,
        difficulty: r.difficulty ?? 1,
        _origin: "shared",
      }));

      const merged = [...shared, ...personal];

      if (!cancelled) {
        setPool(merged);
        setCurrent(pickRandom(merged));
        setDataSource(uid ? "shared+personal" : "shared");
        setLoading(false);

        // focus input
        setTimeout(() => inputRef.current?.focus?.(), 50);
      }
    }

    loadPool();

    return () => {
      cancelled = true;
    };
  }, [lang]);

  async function checkAnswer() {
    if (!current) return;

    const guess = normalizeAnswer(answer);
    const target = normalizeAnswer(current.target);

    if (!guess) return;

    const ok = guess === target;

    if (ok) {
      setScore((s) => s + 1);
      setStreak((s) => s + 1);
      setFeedback({ ok: true, msg: "Correct ✅" });

      // next
      const next = pickRandom(filteredPool);
      setCurrent(next);
      setAnswer("");
      setTimeout(() => inputRef.current?.focus?.(), 50);
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
    setTimeout(() => inputRef.current?.focus?.(), 50);
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

        <div style={{ display: "flex", gap: 8, marginLeft: 12, alignItems: "end" }}>
          <button
            onClick={() => setMode("normal")}
            style={{
              padding: "10px 14px",
              borderRadius: 999,
              border: "1px solid #ddd",
              background: mode === "normal" ? "#111" : "#fff",
              color: mode === "normal" ? "#fff" : "#111",
              cursor: "pointer",
            }}
          >
            Normal
          </button>
          <button
            onClick={() => setMode("hard")}
            style={{
              padding: "10px 14px",
              borderRadius: 999,
              border: "1px solid #ddd",
              background: mode === "hard" ? "#111" : "#fff",
              color: mode === "hard" ? "#fff" : "#111",
              cursor: "pointer",
            }}
          >
            Hard Words
          </button>
        </div>

        <div style={{ marginLeft: "auto", textAlign: "right" }}>
          <div style={{ fontSize: 14, opacity: 0.7 }}>
            Score: <b>{score}</b> &nbsp;&nbsp; Streak: <b>{streak}</b>
          </div>
          <div style={{ fontSize: 12, opacity: 0.6 }}>
            Data source: <b>{dataSource}</b> · Pool size: <b>{filteredPool.length}</b>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 24 }}>
        {loading ? (
          <div style={{ opacity: 0.7 }}>Loading…</div>
        ) : filteredPool.length === 0 ? (
          <div style={{ opacity: 0.7 }}>No terms found for {langLabel}.</div>
        ) : !current ? (
          <div style={{ opacity: 0.7 }}>Pick a term…</div>
        ) : (
          <div
            style={{
              marginTop: 12,
              padding: 18,
              border: "1px solid #eee",
              borderRadius: 16,
              background: "#fff",
            }}
          >
            <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 6 }}>
              Domain: <b>{current.domain}</b> · Difficulty: <b>{current.difficulty ?? 1}</b>
            </div>

            <div style={{ fontSize: 28, fontWeight: 700, marginBottom: 12 }}>
              {current.source}
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <input
                ref={inputRef}
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") checkAnswer();
                }}
                placeholder={`Type the ${langLabel} translation…`}
                style={{
                  flex: 1,
                  padding: "12px 14px",
                  borderRadius: 12,
                  border: "1px solid #ddd",
                  fontSize: 16,
                }}
              />
              <button
                onClick={checkAnswer}
                style={{
                  padding: "12px 14px",
                  borderRadius: 12,
                  border: "1px solid #ddd",
                  background: "#111",
                  color: "#fff",
                  cursor: "pointer",
                }}
              >
                Check
              </button>
              <button
                onClick={nextCard}
                style={{
                  padding: "12px 14px",
                  borderRadius: 12,
                  border: "1px solid #ddd",
                  background: "#fff",
                  color: "#111",
                  cursor: "pointer",
                }}
              >
                Next
              </button>
            </div>

            {feedback && (
              <div style={{ marginTop: 12, fontSize: 14, color: feedback.ok ? "green" : "crimson" }}>
                {feedback.msg}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}