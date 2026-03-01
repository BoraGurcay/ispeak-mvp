"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

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

// Forgiving normalization:
// - accents removed
// - brackets removed
// - lowercased
// - ALL hyphen variants treated as spaces
// - apostrophes removed (optional)
// - extra spaces collapsed
function normalizeAnswer(s) {
  return stripDiacritics(stripBracketed(s))
    .toLowerCase()
    // normalize “fancy” apostrophes to plain
    .replace(/[’‘´`]/g, "'")
    // normalize all hyphen variants to space
    .replace(/[‐-–—-]/g, " ")
    // remove apostrophes entirely (so ma7Dar == ma7dar, isti'naf == istinaf)
    .replace(/'/g, "")
    // keep a-z, digits, whitespace only
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function pickRandom(arr) {
  if (!arr || arr.length === 0) return null;
  const idx = Math.floor(Math.random() * arr.length);
  return arr[idx];
}

function normalizeKey(s) {
  return (s || "").toString().trim().toLowerCase();
}

function termKey(it) {
  return `${normalizeKey(it.domain)}|${normalizeKey(it.source_text)}|${normalizeKey(
    it.target_lang
  )}`;
}

/** ------------------ Page ------------------ **/

const LANGUAGES = [
  { value: "tr", label: "Turkish (TR)" },
  { value: "fr", label: "French (FR)" },
  { value: "es", label: "Spanish (ES)" },
  { value: "pt", label: "Portuguese (PT)" },
  { value: "hi", label: "Hindi (HI)" },
  { value: "ar", label: "Arabic (AR)" },
];

export default function PracticePage() {
  const inputRef = useRef(null);

  const [lang, setLang] = useState("tr");
  const [mode, setMode] = useState("normal"); // "normal" | "hard"

  const [pool, setPool] = useState([]);
  const [term, setTerm] = useState(null);

  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState(null); // { ok: boolean, expected?: string }
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);

  const [loading, setLoading] = useState(false);
  const [fatalError, setFatalError] = useState(null);

  // ---------- Sound ----------
  const [soundOn, setSoundOn] = useState(true);
  const correctAudioRef = useRef(null);
  const wrongAudioRef = useRef(null);

  useEffect(() => {
    // Create audio objects client-side
    try {
      correctAudioRef.current = new Audio("/sounds/correct.mp3");
      wrongAudioRef.current = new Audio("/sounds/wrong.mp3");
      // optional: keep low latency
      correctAudioRef.current.preload = "auto";
      wrongAudioRef.current.preload = "auto";
    } catch (e) {
      // If something blocks Audio, just disable sound quietly
      console.warn("Audio init failed:", e);
      setSoundOn(false);
    }
  }, []);

  function playSound(ok) {
    if (!soundOn) return;
    const a = ok ? correctAudioRef.current : wrongAudioRef.current;
    if (!a) return;
    try {
      a.currentTime = 0;
      const p = a.play();
      if (p && typeof p.catch === "function") {
        p.catch(() => {
          // Browser autoplay policies may block until user gesture; ignore silently.
        });
      }
    } catch {
      // ignore
    }
  }

  const selectedLangLabel = useMemo(() => {
    return LANGUAGES.find((l) => l.value === lang)?.label || lang;
  }, [lang]);

  // load saved language (same key glossary uses)
  useEffect(() => {
    const saved = localStorage.getItem("ispeak_target_lang");
    if (saved && ["tr", "fr", "es", "pt", "hi", "ar"].includes(saved)) {
      setLang(saved);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("ispeak_target_lang", lang);
  }, [lang]);

  async function loadPool() {
    setLoading(true);
    setFeedback(null);
    setFatalError(null);

    try {
      // 1) Shared pack terms (PUBLIC): load from "terms" (Vercel-safe)
      const sharedRes = await supabase
        .from("terms")
        .select("id,domain,source_text,target_text,source_lang,target_lang,difficulty")
        .eq("source_lang", "en")
        .eq("target_lang", lang)
        .limit(5000);

      if (sharedRes.error) {
        console.error("Shared terms load failed:", sharedRes.error);
        setFatalError("Could not load shared terms.");
        setPool([]);
        setTerm(null);
        return;
      }

      const shared = (sharedRes.data || []).map((t) => ({
        ...t,
        __kind: "shared",
      }));

      // 2) Personal terms (only if logged in)
      let personal = [];
      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes?.user;

      if (user) {
        const personalRes = await supabase
          .from("user_terms")
          .select(
            "id,domain,source_text,target_text,source_lang,target_lang,difficulty,created_at"
          )
          .eq("user_id", user.id)
          .eq("source_lang", "en")
          .eq("target_lang", lang)
          .order("created_at", { ascending: false })
          .limit(5000);

        if (personalRes.error) {
          // Don’t fail practice if personal terms are blocked—just continue with shared.
          console.warn(
            "Personal terms blocked/unavailable, continuing with shared only:",
            personalRes.error
          );
          personal = [];
        } else {
          personal = (personalRes.data || []).map((t) => ({
            ...t,
            __kind: "personal",
          }));
        }
      }

      // Deduplicate: personal overrides shared
      const personalKeys = new Set(personal.map(termKey));
      const sharedFiltered = shared.filter((t) => !personalKeys.has(termKey(t)));

      // Merge
      const merged = [...personal, ...sharedFiltered];

      // Optional hard mode: difficulty >= 2 if present, else no-op
      let filtered = merged;
      if (mode === "hard") {
        const hard = merged.filter((t) => (t.difficulty ?? 1) >= 2);
        filtered = hard.length ? hard : merged;
      }

      setPool(filtered);

      const first = pickRandom(filtered);
      setTerm(first);
      setAnswer("");
      setFeedback(null);

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

    playSound(ok);

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
      if (!feedback) checkAnswer();
      else nextTerm();
    }
  }

  const titleText = loading
    ? "Loading..."
    : term?.source_text || (fatalError ? "Error" : "No terms found");

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

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 12px",
              borderRadius: 999,
              border: "1px solid rgba(0,0,0,.15)",
              cursor: "pointer",
              userSelect: "none",
            }}
            title="Toggle sounds"
          >
            <input
              type="checkbox"
              checked={soundOn}
              onChange={(e) => setSoundOn(e.target.checked)}
              style={{ transform: "scale(1.1)" }}
            />
            Sound
          </label>
        </div>

        <div style={{ marginLeft: "auto", textAlign: "right" }}>
          <div style={{ fontSize: 14, opacity: 0.7 }}>
            <span style={{ marginRight: 14 }}>Score: {score}</span>
            <span>Streak: {streak}</span>
          </div>
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
          {titleText}
        </div>

        {fatalError && (
          <div style={{ marginTop: 10, color: "#b00020" }}>{fatalError}</div>
        )}

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
            disabled={!term}
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
              opacity: term ? 1 : 0.5,
            }}
            disabled={!term}
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
              opacity: term ? 1 : 0.5,
            }}
            disabled={!term}
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