"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

const TERMS_TABLE = "terms";
const ROUND_SECONDS = 10;
const AUTO_ADVANCE_MS = 600;

const LANGUAGE_OPTIONS = [
  { code: "tr", label: "Turkish (TR)" },
  { code: "fr", label: "French (FR)" },
  { code: "es", label: "Spanish (ES)" },
  { code: "pt", label: "Portuguese (PT)" },
  { code: "hi", label: "Hindi (HI)" },
  { code: "ar", label: "Arabic (AR)" },
  { code: "zh", label: "Mandarin (ZH)" },
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
    .replace(/[’‘´`]/g, "'")
    .replace(/'/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export default function PlayPage() {
  const [lang, setLang] = useState("tr");
  const [domain, setDomain] = useState("court");
  const [soundOn, setSoundOn] = useState(true);

  const [loading, setLoading] = useState(true);
  const [pool, setPool] = useState([]);

  const [started, setStarted] = useState(false);
  const [question, setQuestion] = useState(null); // { en, correctDisplay, optsDisplay }
  const [options, setOptions] = useState([]);
  const [selected, setSelected] = useState(null);
  const [reveal, setReveal] = useState(false);
  const [timeLeft, setTimeLeft] = useState(ROUND_SECONDS);
  const [score, setScore] = useState(0);
  const [total, setTotal] = useState(0);
  const [statusText, setStatusText] = useState("");

  const timerRef = useRef(null);
  const advanceRef = useRef(null);

  const correctAudioRef = useRef(null);
  const wrongAudioRef = useRef(null);
  const tickAudioRef = useRef(null);

  const audioReadyRef = useRef(false);
  const [audioReady, setAudioReady] = useState(false);

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

  // Prefer native display if present, otherwise roman text
  function displayForRow(row) {
    const native = (row?.target_native || "").trim();
    const roman = (row?.target_text || "").trim();
    return native || roman;
  }

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
        .select("source_text, target_text, target_native, domain, difficulty, target_lang")
        .eq("target_lang", lang);

      if (domain !== "all") q.eq("domain", domain);

      const { data, error } = await q.limit(700);

      if (!cancelled) {
        if (error) {
          console.error(error);
          setPool([]);
        } else {
          const cleaned = (data || []).filter(
            (r) => r?.source_text && ((r?.target_text || "").trim() || (r?.target_native || "").trim())
          );
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
    const en = String(correctRow.source_text);
    const correctDisplay = displayForRow(correctRow);

    const distractors = shuffle(
      rows
        .filter((r) => displayForRow(r) && normalizeText(displayForRow(r)) !== normalizeText(correctDisplay))
        .map((r) => displayForRow(r))
    ).slice(0, 2);

    const optsDisplay = shuffle([correctDisplay, ...distractors]);

    return { en, correctDisplay, optsDisplay };
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
    setOptions(q.optsDisplay);

    if (soundOn && audioReadyRef.current) playTick();

    timerRef.current = setInterval(() => {
      setTimeLeft((t) => t - 1);
    }, 1000);
  }

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

      advanceRef.current = setTimeout(() => startRound(), AUTO_ADVANCE_MS);
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

    const isCorrect = normalizeText(opt) === normalizeText(question.correctDisplay);

    setTotal((n) => n + 1);
    if (isCorrect) {
      setScore((s) => s + 1);
      setStatusText("Correct ✅");
      playSound("correct");
    } else {
      setStatusText("Wrong ❌");
      playSound("wrong");
    }

    advanceRef.current = setTimeout(() => startRound(), AUTO_ADVANCE_MS);
  }

  async function unlockAudioAndStart() {
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
        <div className="h1">Play</div>
        <div className="small muted">Pick the correct translation before the timer runs out.</div>

        <div className="row" style={{ marginTop: 10, gap: 10, flexWrap: "wrap" }}>
          <div className="badge">
            Score: {score}/{total}
          </div>
          <div className="badge">Time: {started && question ? timeLeft : "-"}</div>
          <button
            className={"btn " + (soundOn ? "" : "btnDanger")}
            type="button"
            onClick={() => setSoundOn((s) => !s)}
          >
            Sound: {soundOn ? "On" : "Off"}
          </button>
        </div>

        <div className="row" style={{ marginTop: 12, gap: 12, flexWrap: "wrap" }}>
          <div style={{ minWidth: 220 }}>
            <label className="muted" style={{ display: "block", marginBottom: 6 }}>
              Language
            </label>
            <select className="input" value={lang} onChange={(e) => setLang(e.target.value)}>
              {LANGUAGE_OPTIONS.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>

          <div style={{ minWidth: 220 }}>
            <label className="muted" style={{ display: "block", marginBottom: 6 }}>
              Domain
            </label>
            <select className="input" value={domain} onChange={(e) => setDomain(e.target.value)}>
              {DOMAIN_OPTIONS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="row" style={{ marginTop: 12, gap: 10, flexWrap: "wrap" }}>
          {!started ? (
            <button className="btn btnPrimary" type="button" onClick={unlockAudioAndStart}>
              Start
            </button>
          ) : (
            <button className="btn" type="button" onClick={resetGame}>
              Reset
            </button>
          )}
        </div>

        <div style={{ marginTop: 16 }}>
          {loading ? (
            <div className="small muted">Loading...</div>
          ) : !canPlay ? (
            <div className="small muted">
              Not enough terms to play in this language/domain yet. You need at least 4.
            </div>
          ) : !started ? (
            <div className="small muted">
              Press Start to begin. For Arabic, Hindi, and Mandarin, the choices show native script when available.
            </div>
          ) : question ? (
            <div className="card" style={{ marginTop: 8 }}>
              <div className="small muted" style={{ marginBottom: 8 }}>
                Choose the correct translation for:
              </div>

              <div className="h1" style={{ marginBottom: 14 }}>
                {question.en}
              </div>

              <div className="col" style={{ gap: 10 }}>
                {options.map((opt, idx) => {
                  const isCorrect = normalizeText(opt) === normalizeText(question.correctDisplay);
                  const isSelected = normalizeText(opt) === normalizeText(selected);
                  const showAsCorrect = reveal && isCorrect;
                  const showAsWrong = reveal && isSelected && !isCorrect;

                  let className = "btn";
                  if (showAsCorrect) className = "btn btnPrimary";
                  if (showAsWrong) className = "btn btnDanger";

                  return (
                    <button
                      key={`${opt}-${idx}`}
                      className={className}
                      type="button"
                      onClick={() => choose(opt)}
                      disabled={reveal}
                      style={{
                        textAlign: "left",
                        justifyContent: "flex-start",
                        direction: lang === "ar" ? "rtl" : "auto",
                      }}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>

              {reveal ? (
                <div style={{ marginTop: 12 }} className="small muted">
                  {statusText}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}