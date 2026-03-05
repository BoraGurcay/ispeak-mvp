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
  const [question, setQuestion] = useState(null); // { en, correct, opts, difficulty, dom }
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
          const cleaned = (data || []).filter((r) => r?.source_text && r?.target_text);
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

    const distractors = shuffle(
      rows
        .filter((r) => r.target_text && r.target_text !== correctRow.target_text)
        .map((r) => String(r.target_text))
    ).slice(0, 2);

    const opts = shuffle([correct, ...distractors]);

    return {
      en,
      correct,
      opts,
      difficulty: correctRow.difficulty ?? 1,
      dom: correctRow.domain ?? "",
    };
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

    if (soundOn && audioReadyRef.current) playTick();

    timerRef.current = setInterval(() => {
      setTimeLeft((t) => t - 1);
    }, 1000);
  }

  // Time's up
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

    advanceRef.current = setTimeout(() => {
      startRound();
    }, AUTO_ADVANCE_MS);
  }

  async function unlockAudioAndStart() {
    // Must be user gesture (button click)
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

  useEffect(() => {
    if (!soundOn) stopTick();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [soundOn]);

  return (
    <div className="container">
      <div className="card">
        <h1>Play</h1>
        <p className="muted">Pick the correct translation before the timer runs out.</p>

        {/* Score + Time */}
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

        {/* Controls (match Practice/Glossary styling) */}
        <div className="row" style={{ marginTop: 12, gap: 12, flexWrap: "wrap" }}>
          <div style={{ minWidth: 180 }}>
            <label className="muted" style={{ display: "block", marginBottom: 6 }}>
              Language
            </label>
            <select
              className="input"
              value={lang}
              onChange={(e) => setLang(e.target.value)}
              disabled={started} // optional: prevent changing mid-round
            >
              {LANGUAGE_OPTIONS.map((o) => (
                <option key={o.code} value={o.code}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div style={{ minWidth: 180 }}>
            <label className="muted" style={{ display: "block", marginBottom: 6 }}>
              Domain
            </label>
            <select
              className="input"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              disabled={started} // optional: prevent changing mid-round
            >
              {DOMAIN_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", alignItems: "end", gap: 14 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, userSelect: "none" }}>
              <input
                type="checkbox"
                checked={soundOn}
                onChange={(e) => setSoundOn(e.target.checked)}
              />
              <span>Sound</span>
            </label>

            <button className="btn" onClick={resetGame}>
              Reset
            </button>
          </div>
        </div>

        <div className="hr" style={{ marginTop: 12 }} />

        {/* Body */}
        {loading ? (
          <div className="muted">Loading terms…</div>
        ) : !canPlay ? (
          <div className="muted">
            Not enough terms for this Language/Domain (need at least 4).
          </div>
        ) : !started ? (
          <div className="col" style={{ gap: 10 }}>
            <div className="muted">
              Tap Start to begin (this also enables sound on your browser).
            </div>
            <button className="btn btnPrimary" onClick={unlockAudioAndStart}>
              Start
            </button>
            <div className="small muted">
              (Audio {audioReady ? "unlocked ✅" : "locked until you press Start"})
            </div>
          </div>
        ) : (
          <>
            {question && (
              <>
                <div className="small muted" style={{ marginTop: 4 }}>
                  Domain: {question.dom || "-"} · Difficulty: {question.difficulty ?? 1}
                </div>

                <div className="h1" style={{ marginTop: 10 }}>
                  {question.en}
                </div>

                <div className="col" style={{ marginTop: 12, gap: 10 }}>
                  {options.map((opt) => {
                    const isPicked = selected === opt;
                    const isCorrect = question && normalizeText(opt) === normalizeText(question.correct);

                    let cls = "btn";
                    if (reveal) {
                      if (isCorrect) cls = "btn btnPrimary";
                      else if (isPicked && !isCorrect) cls = "btn btnDanger";
                    }

                    return (
                      <button
                        key={opt}
                        className={cls}
                        onClick={() => choose(opt)}
                        disabled={reveal}
                        style={{ textAlign: "left" }}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>

                <div className="row" style={{ marginTop: 12, alignItems: "center", gap: 10 }}>
                  <div className="muted">{statusText || "Choose an option…"}</div>

                  <button
                    className="btn"
                    onClick={() => {
                      if (reveal) return;
                      // treat skip as wrong, then next
                      stopAllTimers();
                      stopTick();
                      setReveal(true);
                      setTotal((n) => n + 1);
                      setStatusText("Skipped ⏭️");
                      playSound("wrong");
                      advanceRef.current = setTimeout(() => startRound(), AUTO_ADVANCE_MS);
                    }}
                    disabled={reveal}
                  >
                    Skip
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}