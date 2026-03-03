"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

// If your table name is different, change it here:
const TERMS_TABLE = "terms";

const ROUND_SECONDS = 10;
const AUTO_ADVANCE_MS = 600;

const LANGUAGE_OPTIONS = [
  { code: "tr", label: "Turkish (TR)" },
  { code: "fr", label: "French (FR)" },
  { code: "es", label: "Spanish (ES)" },
  { code: "pt", label: "Portuguese (PT)" },
  { code: "ar", label: "Arabic (AR)" },
  { code: "hi", label: "Hindi (HI)" },
];

const DOMAIN_OPTIONS = [
  { value: "all", label: "All" },
  { value: "court", label: "Court" },
  { value: "immigration", label: "Immigration" },
  { value: "family", label: "Family" },
];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function normalizeText(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "'")
    .replace(/\s+/g, " ");
}

export default function PlayPage() {
  // Settings
  const [lang, setLang] = useState("tr");
  const [domain, setDomain] = useState("court");
  const [soundOn, setSoundOn] = useState(true);

  // Data
  const [loading, setLoading] = useState(true);
  const [pool, setPool] = useState([]);

  // Game state
  const [started, setStarted] = useState(false);
  const [question, setQuestion] = useState(null); // { en, correct }
  const [options, setOptions] = useState([]); // strings (translations)
  const [selected, setSelected] = useState(null);
  const [reveal, setReveal] = useState(false);
  const [timeLeft, setTimeLeft] = useState(ROUND_SECONDS);
  const [score, setScore] = useState(0);
  const [total, setTotal] = useState(0);
  const [statusText, setStatusText] = useState("");

  // Timers & audio
  const timerRef = useRef(null);
  const advanceRef = useRef(null);

  const correctAudioRef = useRef(null);
  const wrongAudioRef = useRef(null);
  const tickAudioRef = useRef(null);

  // IMPORTANT: audioReady in a ref (updates immediately) + state (for UI)
  const audioReadyRef = useRef(false);
  const [audioReady, setAudioReady] = useState(false);

  // Load sounds once
  useEffect(() => {
    correctAudioRef.current = new Audio("/sounds/correct.mp3");
    wrongAudioRef.current = new Audio("/sounds/wrong.mp3");

    // Put your ticking file name here if different:
    tickAudioRef.current = new Audio("/sounds/tick.mp3");
    tickAudioRef.current.loop = true;

    return () => {
      stopAllTimers();
      stopTick();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function stopAllTimers() {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;

    if (advanceRef.current) clearTimeout(advanceRef.current);
    advanceRef.current = null;
  }

  function stopTick() {
    const a = tickAudioRef.current;
    if (!a) return;
    try {
      a.pause();
      a.currentTime = 0;
    } catch {}
  }

  function playTick() {
    const a = tickAudioRef.current;
    if (!a) return;
    try {
      a.currentTime = 0;
      a.play();
    } catch {}
  }

  function playSound(kind) {
    if (!soundOn) return;
    if (!audioReadyRef.current) return;

    const a = kind === "correct" ? correctAudioRef.current : wrongAudioRef.current;
    if (!a) return;
    try {
      a.currentTime = 0;
      a.play();
    } catch {}
  }

  // Fetch terms for selected language/domain
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setPool([]);
      setQuestion(null);
      setOptions([]);
      setSelected(null);
      setReveal(false);
      setStatusText("");
      stopAllTimers();
      stopTick();

      const q = supabase
        .from(TERMS_TABLE)
        .select("source_text, target_text, domain, difficulty, target_lang")
        .eq("target_lang", lang);

      if (domain !== "all") q.eq("domain", domain);

      const { data, error } = await q.limit(500);

      if (!cancelled) {
        if (error) {
          console.error(error);
          setPool([]);
        } else {
          // keep rows that have both strings
          const cleaned =
            (data || []).filter((r) => r?.source_text && r?.target_text) || [];
          setPool(cleaned);
        }
        setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, domain]);

  const canPlay = useMemo(() => pool.length >= 4, [pool.length]);

  function makeQuestion(rows) {
    if (rows.length < 4) return null;

    const correctRow = pickRandom(rows);
    const correct = String(correctRow.target_text);
    const en = String(correctRow.source_text);

    // distractors: other target_text values
    const distractors = shuffle(
      rows
        .filter((r) => r.target_text && r.target_text !== correctRow.target_text)
        .map((r) => String(r.target_text))
    ).slice(0, 2);

    const opts = shuffle([correct, ...distractors]);
    return { en, correct, opts, difficulty: correctRow.difficulty ?? 1, dom: correctRow.domain ?? "" };
  }

  function startRound() {
    if (!canPlay) return;

    stopAllTimers();
    stopTick();

    setSelected(null);
    setReveal(false);
    setStatusText("");
    setTimeLeft(ROUND_SECONDS);

    const q = makeQuestion(pool);
    if (!q) return;

    setQuestion(q);
    setOptions(q.opts);

    // Start ticking immediately if allowed
    if (soundOn && audioReadyRef.current) {
      playTick();
    }

    // Start countdown
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => t - 1);
    }, 1000);
  }

  // Time's up logic
  useEffect(() => {
    if (!started) return;
    if (!question) return;
    if (reveal) return;

    if (timeLeft <= 0) {
      stopAllTimers();
      stopTick();

      setReveal(true);
      setTotal((n) => n + 1);
      setStatusText("Time’s up ⏱️");
      playSound("wrong");

      advanceRef.current = setTimeout(() => {
        startRound();
      }, AUTO_ADVANCE_MS);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, started, question, reveal]);

  function choose(opt) {
    if (!question) return;
    if (reveal) return;

    stopAllTimers();
    stopTick();

    setSelected(opt);
    setReveal(true);

    const isCorrect = normalizeText(opt) === normalizeText(question.correct);

    setTotal((n) => n + 1);
    if (isCorrect) {
      setScore((s) => s + 1);
      setStatusText("Correct ✅");
      playSound("correct");
    } else {
      setStatusText("Wrong ❌");
      playSound("wrong");
    }

    // auto-advance after showing result briefly
    advanceRef.current = setTimeout(() => {
      startRound();
    }, AUTO_ADVANCE_MS);
  }

  async function unlockAudioAndStart() {
    // This must be triggered by a user gesture (click) to satisfy browser audio rules.
    try {
      if (correctAudioRef.current) {
        correctAudioRef.current.muted = true;
        await correctAudioRef.current.play();
        correctAudioRef.current.pause();
        correctAudioRef.current.currentTime = 0;
        correctAudioRef.current.muted = false;
      }
    } catch {}

    audioReadyRef.current = true;
    setAudioReady(true);

    setStarted(true);

    // Start first round AFTER audio is ready (ref updates immediately)
    startRound();
  }

  function resetGame() {
    stopAllTimers();
    stopTick();

    setStarted(false);
    setQuestion(null);
    setOptions([]);
    setSelected(null);
    setReveal(false);
    setTimeLeft(ROUND_SECONDS);
    setScore(0);
    setTotal(0);
    setStatusText("");
  }

  // If user toggles sound off, stop ticking immediately
  useEffect(() => {
    if (!soundOn) stopTick();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [soundOn]);

  return (
    <div className="container">
      <div className="card">
        <h1>Play</h1>
        <p className="muted">Pick the correct translation before the timer runs out.</p>

        <div className="row" style={{ marginTop: 12 }}>
          <div>
            <div className="muted">Score</div>
            <div style={{ fontWeight: 700 }}>
              {score}/{total}
            </div>
          </div>

          <div>
            <div className="muted">Time</div>
            <div style={{ fontWeight: 700 }}>{started && question ? timeLeft : "-"}</div>
          </div>
        </div>

        <div className="row" style={{ marginTop: 12, gap: 10, flexWrap: "wrap" }}>
          <div>
            <label className="muted" style={{ display: "block", marginBottom: 6 }}>
              Language
            </label>
            <select value={lang} onChange={(e) => setLang(e.target.value)}>
              {LANGUAGE_OPTIONS.map((o) => (
                <option key={o.code} value={o.code}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="muted" style={{ display: "block", marginBottom: 6 }}>
              Domain
            </label>
            <select value={domain} onChange={(e) => setDomain(e.target.value)}>
              {DOMAIN_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div style={{ alignSelf: "end", display: "flex", gap: 12, alignItems: "center" }}>
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="checkbox"
                checked={soundOn}
                onChange={(e) => setSoundOn(e.target.checked)}
              />
              <span>Sound</span>
            </label>

            <button className="btn secondary" onClick={resetGame}>
              Reset
            </button>
          </div>
        </div>

        <hr style={{ margin: "16px 0" }} />

        {loading ? (
          <p className="muted">Loading terms…</p>
        ) : !canPlay ? (
          <p className="muted">
            Not enough terms found for this selection. (Need at least 4)
          </p>
        ) : !started ? (
          <div>
            <p className="muted" style={{ marginBottom: 10 }}>
              Tap Start to begin (this also enables sound on your browser).
            </p>
            <button className="btn" onClick={unlockAudioAndStart} disabled={!canPlay}>
              Start
            </button>
            {!audioReady && (
              <p className="muted" style={{ marginTop: 10 }}>
                (Audio locked until you press Start)
              </p>
            )}
          </div>
        ) : (
          <div>
            <div className="muted" style={{ marginBottom: 6 }}>
              Domain: {question?.dom || domain} · Difficulty: {question?.difficulty ?? 1}
            </div>

            <div style={{ fontSize: 34, fontWeight: 800, marginBottom: 10 }}>
              {question?.en}
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              {options.map((opt) => {
                const isCorrect =
                  reveal && normalizeText(opt) === normalizeText(question?.correct);
                const isSelected = reveal && selected && normalizeText(opt) === normalizeText(selected);

                let border = "1px solid #e5e5e5";
                let bg = "white";

                if (reveal && isCorrect) {
                  border = "1px solid #16a34a";
                  bg = "#f0fdf4";
                } else if (reveal && isSelected && !isCorrect) {
                  border = "1px solid #dc2626";
                  bg = "#fef2f2";
                }

                return (
                  <button
                    key={opt}
                    className="btn secondary"
                    style={{
                      textAlign: "left",
                      justifyContent: "flex-start",
                      border,
                      background: bg,
                      cursor: reveal ? "default" : "pointer",
                    }}
                    onClick={() => choose(opt)}
                    disabled={reveal}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>

            <div style={{ marginTop: 12 }}>
              {reveal ? (
                <div>
                  <div style={{ fontWeight: 700 }}>
                    {statusText} — Correct: <span style={{ fontWeight: 800 }}>{question?.correct}</span>
                  </div>
                </div>
              ) : (
                <div className="muted">Choose an option…</div>
              )}
            </div>

            <div style={{ marginTop: 12 }}>
              <button className="btn secondary" onClick={startRound} disabled={!canPlay}>
                Skip
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}