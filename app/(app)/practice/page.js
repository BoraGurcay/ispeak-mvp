"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";

// --------- Supabase (client) ----------
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

// ------------- Helpers ---------------

function stripBracketed(s) {
  // remove content in () [] {}
  return (s || "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\{[^}]*\}/g, " ");
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

// IMPORTANT: this normalization is what makes answers forgiving.
function normalizeAnswer(s) {
  return stripDiacritics(stripBracketed(s))
    .toLowerCase()
    // normalize different apostrophe styles
    .replace(/[’`]/g, "'")
    // treat hyphens as spaces (so "al-sulh" == "al sulh")
    .replace(/-/g, " ")
    // make apostrophes optional for roman Arabic (so "isti'naf" == "istinaf")
    .replace(/'/g, "")
    // keep only a-z, 0-9, and spaces
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function pickRandom(arr) {
  if (!arr || arr.length === 0) return null;
  const idx = Math.floor(Math.random() * arr.length);
  return arr[idx];
}

/** ------------------ Page ------------------ **/

const LANGUAGES = [
  { value: "tr", label: "Turkish (TR)" },
  { value: "fr", label: "French (FR)" },
  { value: "es", label: "Spanish (ES)" },
  { value: "pt", label: "Portuguese (PT)" },
  { value: "hi", label: "Hindi (HI)" },
  { value: "ar", label: "Arabic (AR)" }, // <-- renamed (was Roman Arabic)
];

export default function PracticePage() {
  const inputRef = useRef(null);

  const [lang, setLang] = useState("tr");
  const [mode, setMode] = useState("normal"); // "normal" | "hard"

  const [sharedPool, setSharedPool] = useState([]);
  const [personalPool, setPersonalPool] = useState([]);

  const [pool, setPool] = useState([]);
  const [term, setTerm] = useState(null);

  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState(null); // { ok: boolean, expected?: string }
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);

  const [loading, setLoading] = useState(false);

  const selectedLangLabel = useMemo(() => {
    return LANGUAGES.find((l) => l.value === lang)?.label || lang;
  }, [lang]);

  // Fetch both shared + personal, then merge
  async function loadPool() {
    if (!supabase) return;

    setLoading(true);
    setFeedback(null);

    try {
      // Shared terms (public, created by you / the project) live in user_terms with is_shared=true
      const sharedRes = await supabase
        .from("user_terms")
        .select("*")
        .eq("is_shared", true)
        .eq("source_lang", "en")
        .eq("target_lang", lang);

      // Personal terms (user-added) - if your app uses auth, this may be filtered by user_id
      // If your table is public for personal terms too, this will still work.
      const personalRes = await supabase
        .from("user_terms")
        .select("*")
        .eq("is_shared", false)
        .eq("source_lang", "en")
        .eq("target_lang", lang);

      if (sharedRes.error || personalRes.error) {
        const err = sharedRes.error || personalRes.error;
        console.error("practice load error (raw):", err);
        setSharedPool([]);
        setPersonalPool([]);
        setPool([]);
        setTerm(null);
        setLoading(false);
        return;
      }

      const shared = sharedRes.data || [];
      const personal = personalRes.data || [];

      setSharedPool(shared);
      setPersonalPool(personal);

      const merged = [...shared, ...personal];

      // Hard words mode: prioritize items user missed (if you track it) — otherwise same pool
      // If your schema has a "wrong_count" or "difficulty" column, you can change this.
      let filtered = merged;
      if (mode === "hard") {
        // Example: if you have wrong_count in your table, use it:
        // filtered = merged.filter(t => (t.wrong_count || 0) > 0);
        filtered = merged; // fallback (no schema dependency)
      }

      setPool(filtered);

      // pick first term
      const first = pickRandom(filtered);
      setTerm(first);
      setAnswer("");
      setFeedback(null);

      // focus input
      setTimeout(() => inputRef.current?.focus(), 50);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPool();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, mode]);

  function nextTerm() {
    const next = pickRandom(pool);
    setTerm(next);
    setAnswer("");
    setFeedback(null);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function checkAnswer() {
    if (!term) return;

    const expected = term.target_text || "";
    const user = answer || "";

    const expectedNorm = normalizeAnswer(expected);
    const userNorm = normalizeAnswer(user);

    const ok = expectedNorm.length > 0 && userNorm === expectedNorm;

    if (ok) {
      setFeedback({ ok: true });
      setScore((s) => s + 1);
      setStreak((s) => s + 1);
    } else {
      setFeedback({ ok: false, expected });
      setStreak(0);
    }
  }

  function onKeyDown(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (!feedback) {
        checkAnswer();
      } else {
        nextTerm();
      }
    }
  }

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: "28px 18px" }}>
      <h1 style={{ fontSize: 44, fontWeight: 800, margin: 0 }}>Practice</h1>

      <div
        style={{
          display: "flex",
          gap: 16,
          alignItems: "center",
          marginTop: 18,
          flexWrap: "wrap",
        }}
      >
        <div style={{ minWidth: 240 }}>
          <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 6 }}>
            Language
          </div>
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid rgba(0,0,0,.15)",
              fontSize: 16,
            }}
          >
            {LANGUAGES.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
          <button
            onClick={() => setMode("normal")}
            style={{
              padding: "10px 16px",
              borderRadius: 999,
              border: "1px solid rgba(0,0,0,.15)",
              background: mode === "normal" ? "#111" : "transparent",
              color: mode === "normal" ? "#fff" : "#111",
              fontWeight: 700,
              cursor: "pointer",
              minWidth: 92,
            }}
          >
            Normal
          </button>

          <button
            onClick={() => setMode("hard")}
            style={{
              padding: "10px 16px",
              borderRadius: 999,
              border: "1px solid rgba(0,0,0,.15)",
              background: mode === "hard" ? "#111" : "transparent",
              color: mode === "hard" ? "#fff" : "#111",
              fontWeight: 700,
              cursor: "pointer",
              minWidth: 112,
            }}
          >
            Hard Words
          </button>
        </div>

        <div style={{ marginLeft: "auto", textAlign: "right" }}>
          <div style={{ fontSize: 14, opacity: 0.7 }}>
            <span style={{ marginRight: 14 }}>Score: {score}</span>
            <span>Streak: {streak}</span>
          </div>

          {/* NOTE: Debug text removed intentionally */}
        </div>
      </div>

      <div
        style={{
          marginTop: 22,
          border: "1px solid rgba(0,0,0,.12)",
          borderRadius: 18,
          padding: 22,
        }}
      >
        <div style={{ opacity: 0.7, fontSize: 14 }}>
          Domain: Court · Difficulty: {term?.difficulty ?? 1}
        </div>

        <div style={{ marginTop: 12, fontSize: 46, fontWeight: 900 }}>
          {term?.source_text || (loading ? "Loading..." : "No terms found")}
        </div>

        <div
          style={{
            display: "flex",
            gap: 12,
            alignItems: "center",
            marginTop: 14,
            flexWrap: "wrap",
          }}
        >
          <input
            ref={inputRef}
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={`Type the ${selectedLangLabel} translation...`}
            style={{
              flex: 1,
              minWidth: 260,
              padding: "12px 14px",
              borderRadius: 12,
              border: "1px solid rgba(0,0,0,.15)",
              fontSize: 18,
              outline: "none",
            }}
          />

          <button
            onClick={() => {
              if (!feedback) checkAnswer();
              else nextTerm();
            }}
            style={{
              padding: "12px 18px",
              borderRadius: 12,
              border: "1px solid rgba(0,0,0,.15)",
              background: "#111",
              color: "#fff",
              fontWeight: 800,
              cursor: "pointer",
              minWidth: 92,
            }}
          >
            {feedback ? "Next" : "Check"}
          </button>

          <button
            onClick={nextTerm}
            style={{
              padding: "12px 18px",
              borderRadius: 12,
              border: "1px solid rgba(0,0,0,.15)",
              background: "transparent",
              color: "#111",
              fontWeight: 700,
              cursor: "pointer",
              minWidth: 92,
            }}
          >
            Next
          </button>
        </div>

        {feedback && (
          <div style={{ marginTop: 14, fontSize: 16 }}>
            {feedback.ok ? (
              <div style={{ color: "#0a7d28", fontWeight: 700 }}>
                Correct ✅
              </div>
            ) : (
              <div style={{ color: "#b00020", fontWeight: 700 }}>
                Incorrect ❌{" "}
                <span style={{ fontWeight: 500, color: "#444" }}>
                  (expected):{" "}
                </span>
                <span style={{ color: "#111" }}>{feedback.expected}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}