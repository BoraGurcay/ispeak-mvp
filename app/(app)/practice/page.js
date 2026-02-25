"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

function normalize(s) {
  // Lowercase + trim + collapse spaces
  let x = (s || "").toString().toLowerCase().trim().replace(/\s+/g, " ");

  // Remove anything inside parentheses (and the parentheses)
  x = x.replace(/[^)]*/g, " ").replace(/\s+/g, " ").trim();

  // Remove punctuation we don't care about
  x = x.replace(/[“”"'.:;!?،]/g, "").replace(/[-–—]/g, " ");

  // Turkish + French-friendly character folding (so users can type without accents)
  x = x
    .replace(/ı/g, "i")
    .replace(/İ/g, "i")
    .replace(/ş/g, "s")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/â|à|á|ä|ã|å/g, "a")
    .replace(/ê|è|é|ë/g, "e")
    .replace(/î|ì|í|ï/g, "i")
    .replace(/ô|ò|ó|ö/g, "o")
    .replace(/û|ù|ú|ü/g, "u")
    .replace(/ñ/g, "n")
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae");

  // Final cleanup
  x = x.replace(/\s+/g, " ").trim();
  return x;
}

function stripParens(s) {
  return (s || "").toString().replace(/[^)]*/g, " ").replace(/\s+/g, " ").trim();
}

function extractAlternatives(rawTarget) {
  // 1) remove bracketed explanations
  const cleaned = stripParens(rawTarget);

  // 2) split on common separators used in glossaries
  const parts = cleaned.split(/\s*(?:\/|;|,)\s*/g);

  // 3) trim + de-dupe (keep original accents in display)
  const seen = new Set();
  const out = [];
  for (const p of parts) {
    const t = (p || "").trim();
    if (!t) continue;
    const key = normalize(t);
    if (!key) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out.length ? out : (cleaned ? [cleaned] : []);
}

function getAccepted(rawTarget) {
  return extractAlternatives(rawTarget);
}

function findMatchedAlternative(userAnswer, rawTarget) {
  const userN = normalize(userAnswer);
  const alts = getAccepted(rawTarget);
  for (const a of alts) {
    if (normalize(a) === userN) return a;
  }
  return null;
}

export default function PracticePage() {
  const supabase = useMemo(() => supabaseBrowser(), []);

  const [lang, setLang] = useState("tr");
  const [mode, setMode] = useState("normal"); // normal | hard
  const [pool, setPool] = useState([]);
  const [current, setCurrent] = useState(null);

  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState("");
  const [accepted, setAccepted] = useState([]);
  const [matchedAlt, setMatchedAlt] = useState(null);

  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [mistakes, setMistakes] = useState(0);

  const rightRef = useRef(null);
  const wrongRef = useRef(null);

  useEffect(() => {
    rightRef.current = new Audio("/sounds/right.mp3");
    wrongRef.current = new Audio("/sounds/wrong.mp3");
  }, []);

  function playRight() {
    try {
      rightRef.current && rightRef.current.play();
    } catch {}
  }
  function playWrong() {
    try {
      wrongRef.current && wrongRef.current.play();
    } catch {}
  }

  useEffect(() => {
    let cancelled = false;

    async function loadPool() {
      setPool([]);
      setCurrent(null);
      setAnswer("");
      setFeedback("");
      setAccepted([]);
      setMatchedAlt(null);

      // Pull terms from your DB (shared + your own terms should already be handled by your view/RLS setup)
      // This keeps your existing behavior: practice uses the same term pool you already had.
      const { data, error } = await supabase
        .from("terms_practice_view")
        .select("*")
        .eq("lang", lang)
        .limit(5000);

      if (!cancelled) {
        if (error) {
          console.error(error);
          setPool([]);
          return;
        }
        setPool(data || []);
        // pick first term
        const first = (data || [])[Math.floor(Math.random() * (data || []).length)] || null;
        setCurrent(first);
      }
    }

    loadPool();
    return () => {
      cancelled = true;
    };
  }, [supabase, lang]);

  function pickRandomTerm(list) {
    if (!list || !list.length) return null;
    return list[Math.floor(Math.random() * list.length)];
  }

  function nextTerm() {
    setAnswer("");
    setFeedback("");
    setAccepted([]);
    setMatchedAlt(null);

    const next = pickRandomTerm(pool);
    setCurrent(next);
  }

  async function checkAnswer() {
    const guess = answer;
    const target = current?.target_text || "";

    // Accepted alternatives (for display + matching)
    const alts = getAccepted(target);
    const matched = findMatchedAlternative(guess, target);

    setAccepted(alts);
    setMatchedAlt(matched);

    const isCorrect = matched !== null;

    // Update "hard words" tracking (only for the terms in practice)
    if (current?.id) {
      await fetch("/api/hardwords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ term_id: current.id, correct: isCorrect }),
      }).catch(() => {});
    }

    if (isCorrect) {
      setFeedback("✅ Correct!");
      setStreak((s) => s + 1);
      setScore((s) => s + 10);
      playRight();
    } else {
      setFeedback("❌ Not quite.");
      setStreak(0);
      setMistakes((m) => m + 1);
      playWrong();
    }
  }

  return (
    <div className="container" style={{ maxWidth: 740 }}>
      <h1>Practice</h1>

      <div className="card" style={{ marginTop: 12 }}>
        <div className="row" style={{ gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div>
            <div className="small muted">Language</div>
            <select className="input" value={lang} onChange={(e) => setLang(e.target.value)}>
              <option value="tr">Turkish (TR)</option>
              <option value="fr">French (FR)</option>
            </select>
          </div>

          <div style={{ marginLeft: "auto" }}>
            <div className="row" style={{ gap: 10, alignItems: "center" }}>
              <div className="small muted">Score: {score}</div>
              <div className="small muted">Streak: {streak}</div>
              <div className="small muted">Mistakes: {mistakes}</div>
            </div>
          </div>
        </div>

        <div className="row" style={{ gap: 10, marginTop: 12 }}>
          <button
            className={`btn ${mode === "normal" ? "btnPrimary" : ""}`}
            onClick={() => setMode("normal")}
            type="button"
          >
            Normal
          </button>
          <button
            className={`btn ${mode === "hard" ? "btnPrimary" : ""}`}
            onClick={() => setMode("hard")}
            type="button"
          >
            Hard Words
          </button>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        {!current ? (
          <div className="muted">Loading…</div>
        ) : (
          <>
            <h2 style={{ marginBottom: 6 }}>{current.source_text}</h2>
            <div className="muted" style={{ marginBottom: 12 }}>
              {current.hint_text || ""}
            </div>

            <input
              className="input"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Type your answer…"
            />

            <div className="row" style={{ gap: 10, marginTop: 12 }}>
              <button className="btn btnPrimary" onClick={checkAnswer} type="button">
                Check
              </button>
              <button className="btn" onClick={nextTerm} type="button">
                Next
              </button>
            </div>

            {feedback ? (
              <div style={{ marginTop: 10 }}>
                <div className="small muted">{feedback}</div>

                {accepted && accepted.length ? (
                  <div className="small muted" style={{ marginTop: 6 }}>
                    Accepted:{" "}
                    {accepted.map((a, i) => (
                      <span key={i} style={{ marginRight: 6, fontWeight: matchedAlt === a ? 700 : 400 }}>
                        {a}
                        {i < accepted.length - 1 ? " · " : ""}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="small muted" style={{ marginTop: 18 }}>
              Tip: “Hard Words” focuses on terms you personally miss more often (even from the built-in shared pack).
            </div>
          </>
        )}
      </div>
    </div>
  );
}