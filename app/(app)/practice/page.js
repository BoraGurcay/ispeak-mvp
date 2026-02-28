"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

/** ---------------- Normalization / alternatives helpers ---------------- */
function stripBracketed(s) {
  // remove ( ... ), [ ... ], { ... }
  return (s || "")
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
  // Keep letters/digits/apostrophes/hyphens/spaces.
  // Roman Arabic often has numbers like 3/7/2/5 and apostrophes.
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

const DOMAINS = [
  { value: "court", label: "Court" },
  { value: "immigration", label: "Immigration" },
  { value: "family", label: "Family" },
];

const LANGUAGES = [
  { value: "tr", label: "Turkish (TR)" },
  { value: "fr", label: "French (FR)" },
  { value: "es", label: "Spanish (ES)" },
  { value: "pt", label: "Portuguese (PT)" },
  { value: "hi", label: "Hindi (HI)" },
  { value: "ar", label: "Roman Arabic (AR)" },
];

function langLabel(lang) {
  return LANGUAGES.find((l) => l.value === lang)?.label ?? lang;
}

function targetNameShort(lang) {
  switch (lang) {
    case "tr":
      return "Turkish (TR)";
    case "fr":
      return "French (FR)";
    case "es":
      return "Spanish (ES)";
    case "pt":
      return "Portuguese (PT)";
    case "hi":
      return "Hindi (HI)";
    case "ar":
      return "Roman Arabic (AR)";
    default:
      return lang;
  }
}

function domainLabel(value) {
  const d = DOMAINS.find((x) => x.value === value);
  return d?.label ?? "Unassigned";
}

/** ---------------- Page ---------------- */
export default function PracticePage() {
  const inputRef = useRef(null);

  const [lang, setLang] = useState("tr");
  const [mode, setMode] = useState("normal"); // "normal" | "hard"

  const [loading, setLoading] = useState(true);
  const [pool, setPool] = useState([]);
  const [current, setCurrent] = useState(null);

  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState(null); // null | { ok, expected, got }
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);

  // load saved language
  useEffect(() => {
    const saved = localStorage.getItem("ispeak_target_lang");
    if (["tr", "fr", "es", "pt", "hi", "ar"].includes(saved)) setLang(saved);
  }, []);

  useEffect(() => {
    localStorage.setItem("ispeak_target_lang", lang);
  }, [lang]);

  // hard words: only show ones you got wrong in this session (simple)
  const filteredPool = useMemo(() => {
    if (mode === "hard") {
      return pool.filter((t) => t.__wrong === true);
    }
    return pool;
  }, [pool, mode]);

  useEffect(() => {
    let cancelled = false;

    async function loadPool() {
      setLoading(true);
      setPool([]);
      setCurrent(null);
      setAnswer("");
      setResult(null);

      // 1) Shared terms
      const sharedRes = await supabase
        .from("terms")
        .select("id, source_text, target_text, domain, target_lang")
        .eq("source_lang", "en")
        .eq("target_lang", lang)
        .limit(5000);

      // 2) Personal terms (if logged in)
      let personalRes = { data: [], error: null };
      try {
        const { data: authData } = await supabase.auth.getUser();
        const user = authData?.user;

        if (user) {
          personalRes = await supabase
            .from("user_terms")
            .select("id, source_text, target_text, domain, target_lang, created_at")
            .eq("source_lang", "en")
            .eq("target_lang", lang)
            .order("created_at", { ascending: false })
            .limit(5000);
        }
      } catch (e) {
        // ignore
      }

      if (cancelled) return;

      if (sharedRes.error) {
        console.error("practice shared load error:", sharedRes.error);
      }
      if (personalRes.error) {
        console.error("practice personal load error:", personalRes.error);
      }

      const shared = (sharedRes.data || []).map((t) => ({ ...t, __kind: "shared" }));
      const personal = (personalRes.data || []).map((t) => ({ ...t, __kind: "personal" }));

      // Deduplicate: personal overrides shared if same domain+source_text+target_lang
      const key = (t) =>
        `${(t.domain || "").toLowerCase()}|${(t.source_text || "").toLowerCase().trim()}|${(
          t.target_lang || lang
        )
          .toLowerCase()
          .trim()}`;

      const personalKeys = new Set(personal.map(key));
      const sharedFiltered = shared.filter((t) => !personalKeys.has(key(t)));

      const merged = [...personal, ...sharedFiltered];

      setPool(merged);
      setCurrent(pickRandom(merged));
      setLoading(false);

      // focus input
      setTimeout(() => inputRef.current?.focus?.(), 50);
    }

    loadPool();

    return () => {
      cancelled = true;
    };
  }, [lang]);

  function nextCard() {
    const next = pickRandom(filteredPool.length ? filteredPool : pool);
    setCurrent(next);
    setAnswer("");
    setResult(null);
    setTimeout(() => inputRef.current?.focus?.(), 50);
  }

  async function checkAnswer() {
    if (!current) return;

    const guess = answer;
    const target = current?.target_text || "";

    const normGuess = normalizeAnswer(guess);
    const normTarget = normalizeAnswer(target);

    const ok = normGuess.length > 0 && normGuess === normTarget;

    if (ok) {
      setScore((s) => s + 1);
      setStreak((s) => s + 1);
      setResult({ ok: true });
    } else {
      setStreak(0);
      // mark this one as wrong for hard mode (session-only)
      setPool((prev) =>
        prev.map((t) => (t.id === current.id && t.__kind === current.__kind ? { ...t, __wrong: true } : t))
      );
      setResult({ ok: false, expected: current.target_text, got: answer });
    }

    setTimeout(() => inputRef.current?.focus?.(), 50);
  }

  const poolSize = filteredPool.length ? filteredPool.length : pool.length;

  return (
    <div className="container">
      <div className="card">
        <div className="h1">Practice</div>

        <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
          <div className="row" style={{ gap: 10, alignItems: "center" }}>
            <div>
              <div className="small muted">Language</div>
              <select className="select" value={lang} onChange={(e) => setLang(e.target.value)}>
                {LANGUAGES.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="row" style={{ gap: 8, marginTop: 18 }}>
              <button
                className={mode === "normal" ? "btn btnPrimary" : "btn"}
                type="button"
                onClick={() => setMode("normal")}
              >
                Normal
              </button>
              <button
                className={mode === "hard" ? "btn btnPrimary" : "btn"}
                type="button"
                onClick={() => setMode("hard")}
              >
                Hard Words
              </button>
            </div>
          </div>

          <div style={{ textAlign: "right" }}>
            <div className="small muted">
              Score: <b>{score}</b> &nbsp; Streak: <b>{streak}</b>
            </div>
            {/* Debug text intentionally hidden */}
          </div>
        </div>

        <div className="hr" />

        {loading ? <div className="muted">Loading…</div> : null}

        {!loading && (!pool || pool.length === 0) ? (
          <div className="muted">
            No terms found for <b>{langLabel(lang)}</b>. (Make sure your rows in Supabase have <code>source_lang = en</code>{" "}
            and <code>target_lang = {lang}</code>.)
          </div>
        ) : null}

        {!loading && current ? (
          <div className="card" style={{ padding: 16 }}>
            <div className="small muted">
              Domain: <b>{domainLabel(current.domain)}</b> • Difficulty:{" "}
              <b>{current.difficulty ?? 1}</b>
            </div>

            <div style={{ fontSize: 34, fontWeight: 800, marginTop: 10 }}>{current.source_text}</div>

            <div className="row" style={{ gap: 10, marginTop: 14, alignItems: "center" }}>
              <input
                ref={inputRef}
                className="input"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder={`Type the ${targetNameShort(lang)} translation…`}
                onKeyDown={(e) => {
                  if (e.key === "Enter") checkAnswer();
                }}
              />

              <button className="btn btnPrimary" onClick={checkAnswer} type="button">
                Check
              </button>

              <button className="btn" onClick={nextCard} type="button">
                Next
              </button>
            </div>

            {result?.ok === true ? (
              <div className="small" style={{ marginTop: 10 }}>
                Correct ✅
              </div>
            ) : null}

            {result?.ok === false ? (
              <div className="small" style={{ marginTop: 10 }}>
                <div>
                  Incorrect ❌ <span className="muted">(expected)</span>: <b>{result.expected}</b>
                </div>
              </div>
            ) : null}

            <div className="small muted" style={{ marginTop: 10 }}>
              Pool size: <b>{poolSize}</b>
              {mode === "hard" ? <span> (hard words)</span> : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}