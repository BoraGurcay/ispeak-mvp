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
  { code: "ta", label: "Tamil (TA)" },
  { code: "pa", label: "Punjabi (PA)" },
  { code: "tl", label: "Tagalog (TL)" },
  { code: "so", label: "Somali (SO)" },
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

function domainLabel(value) {
  return DOMAIN_OPTIONS.find((d) => d.value === value)?.label || value;
}

function languageLabel(value) {
  return LANGUAGE_OPTIONS.find((l) => l.code === value)?.label || value;
}

export default function PlayPage() {
  const [lang, setLang] = useState("tr");
  const [domain, setDomain] = useState("court");
  const [soundOn, setSoundOn] = useState(true);

  const [loading, setLoading] = useState(true);
  const [pool, setPool] = useState([]);

  const [started, setStarted] = useState(false);
  const [sessionEnded, setSessionEnded] = useState(false);

  const [question, setQuestion] = useState(null);
  const [options, setOptions] = useState([]);
  const [selected, setSelected] = useState(null);
  const [reveal, setReveal] = useState(false);
  const [timeLeft, setTimeLeft] = useState(ROUND_SECONDS);
  const [score, setScore] = useState(0);
  const [total, setTotal] = useState(0);
  const [statusText, setStatusText] = useState("");
  const [mistakes, setMistakes] = useState([]);
  const [savingSession, setSavingSession] = useState(false);

  const timerRef = useRef(null);
  const advanceRef = useRef(null);

  const correctAudioRef = useRef(null);
  const wrongAudioRef = useRef(null);
  const tickAudioRef = useRef(null);

  const audioReadyRef = useRef(false);

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

  function displayForRow(row) {
    const native = (row?.target_native || "").trim();
    const roman = (row?.target_text || "").trim();
    return native || roman;
  }

  async function saveWeakTerm({ source_text, target_text, target_native, domain, language }) {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { error } = await supabase.from("weak_terms").insert({
        user_id: user.id,
        source_text,
        target_text,
        target_native: target_native || null,
        domain,
        language,
      });

      if (error) {
        console.error("Error saving weak term:", error);
      }
    } catch (err) {
      console.error("Unexpected weak term save error:", err);
    }
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
            (r) =>
              r?.source_text &&
              (((r?.target_text || "").trim().length > 0) ||
                ((r?.target_native || "").trim().length > 0))
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
  const accuracy = total > 0 ? Math.round((score / total) * 100) : 0;

  function makeQuestion(rows) {
    if (rows.length < 4) return null;

    const correctRow = pickRandom(rows);
    const en = String(correctRow.source_text);
    const correctDisplay = displayForRow(correctRow);

    const distractors = shuffle(
      rows
        .filter(
          (r) =>
            displayForRow(r) &&
            normalizeText(displayForRow(r)) !== normalizeText(correctDisplay)
        )
        .map((r) => displayForRow(r))
    ).slice(0, 2);

    const optsDisplay = shuffle([correctDisplay, ...distractors]);

    return {
      en,
      correctDisplay,
      correctNative: (correctRow.target_native || "").trim(),
      optsDisplay,
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
    if (sessionEnded) return;

    if (timeLeft <= 0) {
      stopAllTimers();
      stopTick();

      setReveal(true);
      setTotal((n) => n + 1);
      setStatusText("Time ran out.");
      playSound("wrong");

      setMistakes((prev) => [
        ...prev,
        {
          en: question.en,
          correctDisplay: question.correctDisplay,
          selected: null,
          reason: "timeout",
        },
      ]);

      void saveWeakTerm({
        source_text: question.en,
        target_text: question.correctDisplay,
        target_native: question.correctNative,
        domain,
        language: lang,
      });

      advanceRef.current = setTimeout(() => startRound(), AUTO_ADVANCE_MS);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, started, question, reveal, sessionEnded]);

  function choose(opt) {
    if (!question) return;
    if (reveal) return;
    if (sessionEnded) return;

    stopAllTimers();
    stopTick();

    setSelected(opt);
    setReveal(true);

    const isCorrect =
      normalizeText(opt) === normalizeText(question.correctDisplay);

    setTotal((n) => n + 1);

    if (isCorrect) {
      setScore((s) => s + 1);
      setStatusText("Correct ✓");
      playSound("correct");
    } else {
      setStatusText("Incorrect ✗");
      playSound("wrong");

      setMistakes((prev) => [
        ...prev,
        {
          en: question.en,
          correctDisplay: question.correctDisplay,
          selected: opt,
          reason: "wrong",
        },
      ]);

      void saveWeakTerm({
        source_text: question.en,
        target_text: question.correctDisplay,
        target_native: question.correctNative,
        domain,
        language: lang,
      });
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

    setMistakes([]);
    setSessionEnded(false);
    setStarted(true);
    startRound();
  }

  async function saveSessionHistory() {
    try {
      setSavingSession(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { error } = await supabase.from("play_sessions").insert({
        user_id: user.id,
        language: lang,
        domain,
        correct_count: score,
        attempted_count: total,
        accuracy,
      });

      if (error) {
        console.error("Error saving play session:", error);
      }
    } catch (err) {
      console.error("Unexpected save session error:", err);
    } finally {
      setSavingSession(false);
    }
  }

  async function endSession() {
    stopAllTimers();
    stopTick();
    setSessionEnded(true);
    setQuestion(null);
    setOptions([]);
    setSelected(null);
    setReveal(false);
    setStatusText("");
    setTimeLeft(ROUND_SECONDS);

    if (total > 0) {
      await saveSessionHistory();
    }
  }

  function resetGame() {
    stopAllTimers();
    stopTick();
    setStarted(false);
    setSessionEnded(false);
    setQuestion(null);
    setOptions([]);
    setSelected(null);
    setReveal(false);
    setTimeLeft(ROUND_SECONDS);
    setScore(0);
    setTotal(0);
    setStatusText("");
    setMistakes([]);
  }

  function practiceAgain() {
    stopAllTimers();
    stopTick();
    setScore(0);
    setTotal(0);
    setStatusText("");
    setSelected(null);
    setReveal(false);
    setQuestion(null);
    setOptions([]);
    setSessionEnded(false);
    setMistakes([]);
    setStarted(true);
    startRound();
  }

  useEffect(() => {
    if (!soundOn) stopTick();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [soundOn]);

  return (
    <div className="container">
      <div className="card">
        <div className="h1">Timed Challenge</div>
        <div className="small muted">
          Translate quickly and accurately before time runs out.
        </div>

        <div className="row" style={{ marginTop: 14, gap: 12, flexWrap: "wrap" }}>
          <div className="badge">Correct: {score}</div>
          <div className="badge">Answered: {total}</div>
          <div className="badge">
            Time: {started && question && !sessionEnded ? `${timeLeft}s` : "-"}
          </div>
          <button
            className={"btn " + (soundOn ? "" : "btnDanger")}
            type="button"
            onClick={() => setSoundOn((s) => !s)}
          >
            Audio {soundOn ? "On" : "Off"}
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
              Start Challenge
            </button>
          ) : sessionEnded ? (
            <>
              <button className="btn btnPrimary" type="button" onClick={practiceAgain}>
                Practice Again
              </button>
              <button className="btn" type="button" onClick={resetGame}>
                Reset
              </button>
            </>
          ) : (
            <>
              <button className="btn" type="button" onClick={endSession}>
                End Session
              </button>
              <button className="btn" type="button" onClick={resetGame}>
                Reset
              </button>
            </>
          )}
        </div>

        <div style={{ marginTop: 16 }}>
          {loading ? (
            <div className="small muted">Loading terms...</div>
          ) : !canPlay ? (
            <div className="small muted">
              Not enough terms are available in this language and domain yet. You need at least 4.
            </div>
          ) : !started ? (
            <div className="small muted">
              Press Start Challenge to begin. For Arabic, Hindi, Mandarin, Tamil, and Punjabi, native script is shown when available.
            </div>
          ) : sessionEnded ? (
            <div className="card" style={{ marginTop: 14 }}>
              <div className="h1" style={{ marginBottom: 14 }}>
                Training Summary
              </div>

              <div className="small muted" style={{ marginBottom: 12 }}>
                {languageLabel(lang)} • {domainLabel(domain)}
              </div>

              <div className="col" style={{ gap: 8 }}>
                <div className="badge">Correct: {score}</div>
                <div className="badge">Attempted: {total}</div>
                <div className="badge">Accuracy: {accuracy}%</div>
              </div>

              {savingSession ? (
                <div className="small muted" style={{ marginTop: 10 }}>
                  Saving session...
                </div>
              ) : null}

              <div className="small muted" style={{ marginTop: 14 }}>
                Strong work. Continue building terminology speed and accuracy.
              </div>

              {mistakes.length > 0 ? (
                <div className="card" style={{ marginTop: 16 }}>
                  <div className="h1" style={{ fontSize: "1.4rem", marginBottom: 10 }}>
                    Review Incorrect Answers
                  </div>

                  <div className="col" style={{ gap: 10 }}>
                    {mistakes.map((m, idx) => (
                      <div key={`${m.en}-${idx}`} className="card" style={{ padding: 12 }}>
                        <div className="small muted" style={{ marginBottom: 6 }}>
                          {m.reason === "timeout" ? "Time ran out" : "Incorrect"}
                        </div>
                        <div style={{ fontWeight: 700, marginBottom: 6 }}>{m.en}</div>
                        <div className="small">
                          <strong>Correct:</strong> {m.correctDisplay}
                        </div>
                        <div className="small muted" style={{ marginTop: 4 }}>
                          <strong>Your answer:</strong> {m.selected || "—"}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="small muted" style={{ marginTop: 16 }}>
                  No mistakes this session. Excellent work.
                </div>
              )}

              <div className="row" style={{ marginTop: 14, gap: 10, flexWrap: "wrap" }}>
                <button className="btn btnPrimary" type="button" onClick={practiceAgain}>
                  Practice Again
                </button>
                <button className="btn" type="button" onClick={resetGame}>
                  Reset
                </button>
                <a href="/home" className="btn">
                  Home
                </a>
              </div>
            </div>
          ) : question ? (
            <div className="card" style={{ marginTop: 14 }}>
              <div className="small muted" style={{ marginBottom: 10 }}>
                Translate this term:
              </div>

              <div className="h1" style={{ marginBottom: 18 }}>
                {question.en}
              </div>

              <div className="col" style={{ gap: 10 }}>
                {options.map((opt, idx) => {
                  const isCorrect =
                    normalizeText(opt) === normalizeText(question.correctDisplay);
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