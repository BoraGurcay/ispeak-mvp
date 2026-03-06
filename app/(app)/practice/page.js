"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

// --------- helpers ---------

function stripBracketed(s) {
  return (s || "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\{[^}]*\}/g, " ");
}

function stripDiacritics(s) {
  return (s || "")
    .toString()
    .replace(/ı/g, "i")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
* Forgiving normalization that works for:
* - Latin scripts (tr/fr/es/pt)
* - Roman Arabic with digits (3/7)
* - Native scripts like Arabic (keeps Unicode letters)
*
* Key idea: DO NOT restrict to [a-z]. Keep \p{L} (letters) + \p{N} (numbers).
*/
function normalizeAnswer(s) {
  return stripDiacritics(stripBracketed(s))
    .toLowerCase()
    .replace(/[’‘´`]/g, "'")
    .replace(/[\u2010-\u2015\u2212\-]/g, " ")
    .replace(/'/g, "") // isti'naf == istinaf
    .replace(/[^\p{L}\p{N}\s]/gu, " ") // keep letters+numbers across languages
    .replace(/\s+/g, " ")
    .trim();
}

function pickRandom(arr) {
  if (!arr || arr.length === 0) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

function normalizeKey(s) {
  return (s || "").toString().trim().toLowerCase();
}

function termKey(it) {
  return `${normalizeKey(it.domain)}|${normalizeKey(it.source_text)}|${normalizeKey(it.target_lang)}`;
}

/**
* Split acceptable answers from a field that may include alternatives.
* Conservative split: / | ; newline OR words "veya"/"or"
*/
function splitExpectedAnswers(expectedRaw) {
  const raw = (expectedRaw || "").toString().trim();
  if (!raw) return [];

  const looksLikeAlt =
    raw.includes("/") ||
    raw.includes("|") ||
    raw.includes(";") ||
    /\bveya\b/i.test(raw) ||
    /\bor\b/i.test(raw);

  if (!looksLikeAlt) return [raw];

  const parts = raw
    .split(/\s*(?:\/|\||;|\n|\bveya\b|\bor\b)\s*/gi)
    .map((s) => s.trim())
    .filter(Boolean);

  return parts.length ? parts : [raw];
}

function uniqByNorm(rawList) {
  const seen = new Set();
  const out = [];
  for (const x of rawList) {
    const n = normalizeAnswer(x);
    if (!n) continue;
    if (seen.has(n)) continue;
    seen.add(n);
    out.push(x);
  }
  return out;
}

// --------- config ---------

const LANGUAGES = [
  { value: "tr", label: "Turkish (TR)" },
  { value: "fr", label: "French (FR)" },
  { value: "es", label: "Spanish (ES)" },
  { value: "pt", label: "Portuguese (PT)" },
  { value: "hi", label: "Hindi (HI)" },
  { value: "ar", label: "Arabic (AR)" },
];

const DOMAINS = [
  { value: "all", label: "All" },
  { value: "court", label: "Court" },
  { value: "immigration", label: "Immigration" },
  { value: "family", label: "Family" },
];

function domainLabel(value) {
  const d = DOMAINS.find((x) => x.value === value);
  return d?.label ?? "Court";
}

export default function PracticePage() {
  const inputRef = useRef(null);

  const [lang, setLang] = useState("tr");
  const [mode, setMode] = useState("normal"); // normal | hard
  const [domain, setDomain] = useState("all");

  const [pool, setPool] = useState([]);
  const [term, setTerm] = useState(null);

  const [answer, setAnswer] = useState("");

  // feedback: { ok, accepted, matched, showExpectedNative?, expectedNative? }
  const [feedback, setFeedback] = useState(null);

  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);

  const [loading, setLoading] = useState(false);
  const [fatalError, setFatalError] = useState(null);

  // ---------- Sound ----------
  const [soundOn, setSoundOn] = useState(true);
  const correctAudioRef = useRef(null);
  const wrongAudioRef = useRef(null);

  useEffect(() => {
    try {
      correctAudioRef.current = new Audio("/sounds/correct.mp3");
      wrongAudioRef.current = new Audio("/sounds/wrong.mp3");
      correctAudioRef.current.preload = "auto";
      wrongAudioRef.current.preload = "auto";
    } catch (e) {
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
      if (p && typeof p.catch === "function") p.catch(() => {});
    } catch {}
  }

  // load saved language
  useEffect(() => {
    const saved = localStorage.getItem("ispeak_target_lang");
    if (saved && ["tr", "fr", "es", "pt", "hi", "ar"].includes(saved)) setLang(saved);
  }, []);

  useEffect(() => {
    localStorage.setItem("ispeak_target_lang", lang);
  }, [lang]);

  async function loadPool() {
    setLoading(true);
    setFeedback(null);
    setFatalError(null);

    try {
      // 1) shared
      let sharedQuery = supabase
        .from("terms")
        .select("id,domain,source_text,target_text,target_native,source_lang,target_lang,difficulty")
        .eq("source_lang", "en")
        .eq("target_lang", lang)
        .limit(5000);

      if (domain !== "all") sharedQuery = sharedQuery.eq("domain", domain);

      const sharedRes = await sharedQuery;

      if (sharedRes.error) {
        console.error("Shared terms load failed:", sharedRes.error);
        setFatalError("Could not load shared terms.");
        setPool([]);
        setTerm(null);
        return;
      }

      const shared = (sharedRes.data || []).map((t) => ({ ...t, __kind: "shared" }));

      // 2) personal (if logged in)
      let personal = [];
      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes?.user;

      if (user) {
        let personalQuery = supabase
          .from("user_terms")
          .select("id,domain,source_text,target_text,target_native,source_lang,target_lang,difficulty,created_at")
          .eq("user_id", user.id)
          .eq("source_lang", "en")
          .eq("target_lang", lang)
          .order("created_at", { ascending: false })
          .limit(5000);

        if (domain !== "all") personalQuery = personalQuery.eq("domain", domain);

        const personalRes = await personalQuery;
        if (personalRes.error) {
          console.warn("Personal terms unavailable (ignoring):", personalRes.error);
          personal = [];
        } else {
          personal = (personalRes.data || []).map((t) => ({ ...t, __kind: "personal" }));
        }
      }

      // personal overrides shared
      const personalKeys = new Set(personal.map(termKey));
      const sharedFiltered = shared.filter((t) => !personalKeys.has(termKey(t)));

      let merged = [...personal, ...sharedFiltered];

      merged = merged.filter(
        (t) =>
          t &&
          t.source_lang === "en" &&
          t.target_lang === lang &&
          (t.target_text || "").trim().length > 0
      );

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
  }, [lang, mode, domain]);

  function nextTerm() {
    const next = pickRandom(pool);
    setTerm(next);
    setAnswer("");
    setFeedback(null);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function checkAnswer() {
    if (!term) return;

    const userRaw = answer || "";
    const userNorm = normalizeAnswer(userRaw);
    if (!userNorm) return;

    const romanRaw = term.target_text || "";
    const nativeRaw = term.target_native || "";

    // roman alternatives
    const romanAcceptedRaw = splitExpectedAnswers(romanRaw);
    const romanAcceptedNorm = romanAcceptedRaw.map((x) => normalizeAnswer(x)).filter(Boolean);
    const romanWholeNorm = normalizeAnswer(romanRaw);

    // native alternatives (usually single, but allow separators just in case)
    const nativeAcceptedRaw = splitExpectedAnswers(nativeRaw);
    const nativeAcceptedNorm = nativeAcceptedRaw.map((x) => normalizeAnswer(x)).filter(Boolean);
    const nativeWholeNorm = normalizeAnswer(nativeRaw);

    const ok =
      (romanAcceptedNorm.length > 0 && romanAcceptedNorm.includes(userNorm)) ||
      (romanWholeNorm && userNorm === romanWholeNorm) ||
      (nativeAcceptedNorm.length > 0 && nativeAcceptedNorm.includes(userNorm)) ||
      (nativeWholeNorm && userNorm === nativeWholeNorm);

    // Build accepted list for display (roman + native, de-duped)
    const acceptedCombined = uniqByNorm([...romanAcceptedRaw, ...nativeAcceptedRaw]);

    let matched = null;
    if (ok) {
      const idxR = romanAcceptedNorm.indexOf(userNorm);
      if (idxR >= 0) matched = romanAcceptedRaw[idxR] || null;
      const idxN = nativeAcceptedNorm.indexOf(userNorm);
      if (!matched && idxN >= 0) matched = nativeAcceptedRaw[idxN] || null;
      if (!matched) matched = romanRaw || nativeRaw || null;
    }

    playSound(ok);

    if (ok) {
      setFeedback({
        ok: true,
        accepted: acceptedCombined,
        matched,
      });
      setScore((s) => s + 1);
      setStreak((s) => s + 1);
    } else {
      setFeedback({
        ok: false,
        accepted: acceptedCombined,
        matched: null,
      });
      setStreak(0);
    }
  }

  const selectedLangLabel = useMemo(() => {
    return LANGUAGES.find((l) => l.value === lang)?.label || lang;
  }, [lang]);

  const poolCount = pool.length;

  return (
    <div className="container">
      <div className="card">
        <div className="h1">Practice</div>

        {/* Controls */}
        <label className="small muted">Language</label>
        <select className="select" value={lang} onChange={(e) => setLang(e.target.value)}>
          {LANGUAGES.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </select>

        <div className="row" style={{ marginTop: 10, gap: 10, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <label className="small muted">Domain</label>
            <select className="select" value={domain} onChange={(e) => setDomain(e.target.value)}>
              {DOMAINS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>

          <div style={{ minWidth: 220 }}>
            <label className="small muted">Mode</label>
            <div className="row" style={{ gap: 10 }}>
              <button
                className={"btn " + (mode === "normal" ? "btnPrimary" : "")}
                onClick={() => setMode("normal")}
                type="button"
              >
                Normal
              </button>
              <button
                className={"btn " + (mode === "hard" ? "btnPrimary" : "")}
                onClick={() => setMode("hard")}
                type="button"
              >
                Hard
              </button>
            </div>
          </div>
        </div>

        <div className="row" style={{ marginTop: 10, gap: 10, flexWrap: "wrap" }}>
          <div className="badge">Score: {score}</div>
          <div className="badge">Streak: {streak}</div>
          <div className="badge">Pool: {poolCount}</div>
          <button className={"btn " + (soundOn ? "" : "btnDanger")} type="button" onClick={() => setSoundOn((s) => !s)}>
            Sound: {soundOn ? "On" : "Off"}
          </button>
        </div>
      </div>

      <div style={{ height: 12 }} />

      <div className="card">
        {loading ? <div className="muted">Loading…</div> : null}
        {fatalError ? <div className="muted">{fatalError}</div> : null}

        {!loading && !fatalError && !term ? (
          <div className="muted">No terms found for {selectedLangLabel} / {domainLabel(domain)}.</div>
        ) : null}

        {term ? (
          <>
            <div style={{ fontSize: 22, fontWeight: 800, marginTop: 6 }}>{term.source_text}</div>
            <div className="small muted" style={{ marginTop: 6 }}>
              Domain: {domainLabel(term.domain)} · {term.__kind === "shared" ? "Shared" : "My term"}
            </div>

            <input
              ref={inputRef}
              className="input"
              style={{ marginTop: 12 }}
              placeholder="Type translation… (native script OR roman accepted)"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") checkAnswer();
              }}
            />

            <div className="row" style={{ gap: 10, marginTop: 12, flexWrap: "wrap" }}>
              <button className="btn btnPrimary" onClick={checkAnswer} type="button">
                Check
              </button>
              <button className="btn" onClick={nextTerm} type="button">
                Next
              </button>
            </div>

            {feedback ? (
              <div style={{ marginTop: 12 }}>
                <div className="small muted">{feedback.ok ? "✅ Correct!" : "❌ Not quite."}</div>

                {feedback.accepted && feedback.accepted.length ? (
                  <div className="small muted" style={{ marginTop: 6 }}>
                    Accepted:{" "}
                    {feedback.accepted.map((a, i) => (
                      <span key={i} style={{ fontWeight: feedback.matched === a ? 800 : 400 }}>
                        {a}
                        {i < feedback.accepted.length - 1 ? " · " : ""}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}