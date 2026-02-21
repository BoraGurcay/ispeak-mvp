"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

export default function Practice() {
  const [terms, setTerms] = useState([]);
  const [current, setCurrent] = useState(null);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState(true);

  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [mode, setMode] = useState("normal"); // normal | hard

  // ⭐ direction toggle
  const [direction, setDirection] = useState("tr-en"); // "en-tr" | "tr-en"

  // ✅ Sounds (useRef so they don’t re-create every render)
  const correctSoundRef = useRef(null);
  const wrongSoundRef = useRef(null);

  // ✅ Speech voices
  const [voices, setVoices] = useState([]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // UI sounds
    correctSoundRef.current = new Audio("/sounds/correct.mp3");
    wrongSoundRef.current = new Audio("/sounds/wrong.mp3");
    correctSoundRef.current.preload = "auto";
    wrongSoundRef.current.preload = "auto";

    // speech voices
    const loadVoices = () => {
      try {
        const v = window.speechSynthesis?.getVoices?.() || [];
        setVoices(v);
      } catch {
        setVoices([]);
      }
    };

    loadVoices();
    // Some browsers load voices async
    if (window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, []);

  useEffect(() => {
    loadTerms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadTerms() {
    setLoading(true);

    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (!user) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("user_terms")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data?.length > 0) {
      setTerms(data);
      pickNext(data, mode);
    } else {
      setTerms([]);
      setCurrent(null);
    }

    setLoading(false);
  }

  // ⭐ weighted selection
  function pickNext(list, modeType) {
    let pool = list;

    if (modeType === "hard") {
      pool = list.filter((t) => (t.wrong_count || 0) > 0);
      if (pool.length === 0) pool = list;
    }

    const weighted = pool.flatMap((t) => Array((t.wrong_count || 0) + 1).fill(t));
    const next = weighted[Math.floor(Math.random() * weighted.length)];
    setCurrent(next);
  }

  function playSound(ref) {
    const a = ref?.current;
    if (!a) return;
    try {
      a.currentTime = 0;
      a.play();
    } catch {}
  }

  function pickTurkishVoice(list) {
    if (!list || list.length === 0) return null;

    // Prefer voices explicitly marked Turkish
    const tr = list.filter((v) => (v.lang || "").toLowerCase().startsWith("tr"));
    if (tr.length > 0) {
      // Often better: Google / Microsoft / Natural / Neural
      const preferred =
        tr.find((v) => /google|microsoft|natural|neural/i.test(v.name)) || tr[0];
      return preferred;
    }

    // Fallback: sometimes Turkish exists but lang isn't perfect
    const maybe = list.find((v) => /turk/i.test(v.name));
    return maybe || null;
  }

  // 🔊 Speak Turkish (B + D rely on this)
  function speakTR(text, opts = {}) {
    if (typeof window === "undefined") return;
    if (!text || !text.trim()) return;
    if (!window.speechSynthesis) return;

    try {
      // Stop any current speech so taps feel responsive
      window.speechSynthesis.cancel();

      const u = new SpeechSynthesisUtterance(text);

      const v = pickTurkishVoice(voices);
      if (v) {
        u.voice = v;
        u.lang = v.lang || "tr-TR";
      } else {
        u.lang = "tr-TR";
      }

      // defaults (you can tweak later)
      u.rate = typeof opts.rate === "number" ? opts.rate : 0.95;
      u.pitch = typeof opts.pitch === "number" ? opts.pitch : 1.0;

      window.speechSynthesis.speak(u);
    } catch {}
  }

  const promptText = useMemo(() => {
    if (!current) return "";
    return direction === "en-tr" ? (current.source_text || "") : (current.target_text || "");
  }, [current, direction]);

  const expectedAnswer = useMemo(() => {
    if (!current) return "";
    return direction === "en-tr" ? (current.target_text || "") : (current.source_text || "");
  }, [current, direction]);

  const answerPlaceholder = useMemo(() => {
    return direction === "en-tr" ? "Type Turkish..." : "Type English...";
  }, [direction]);

  // ✅ B) Auto-play pronunciation after answer:
  // - after correct: play the *Turkish* side
  // - after wrong: do NOT autoplay (less annoying), but user can tap 🔊
  async function checkAnswer() {
    if (!current) return;

    const correct = (expectedAnswer || "").toLowerCase().trim();
    const user = (answer || "").toLowerCase().trim();

    if (!correct || !user) return;

    if (correct === user) {
      playSound(correctSoundRef);
      setFeedback("✅ Correct!");
      setScore((s) => s + 10);
      setStreak((s) => s + 1);

      // Auto-play Turkish pronunciation on correct
      // If you’re practicing TR → EN, the Turkish is the promptText.
      // If you’re practicing EN → TR, the Turkish is the expectedAnswer.
      const turkishToSpeak = direction === "tr-en" ? promptText : expectedAnswer;
      speakTR(turkishToSpeak, { rate: 0.95, pitch: 1.0 });
    } else {
      playSound(wrongSoundRef);
      setFeedback(`❌ Correct: ${expectedAnswer}`);
      setStreak(0);

      await supabase
        .from("user_terms")
        .update({ wrong_count: (current.wrong_count || 0) + 1 })
        .eq("id", current.id);
    }
  }

  function nextTerm() {
    if (!terms || terms.length === 0) return;
    pickNext(terms, mode);
    setAnswer("");
    setFeedback("");
  }

  function pronounceNormal() {
    if (!current) return;
    const turkishToSpeak = direction === "tr-en" ? promptText : expectedAnswer;
    speakTR(turkishToSpeak, { rate: 0.95, pitch: 1.0 });
  }

  // ✅ D) Slow button (clearer articulation)
  function pronounceSlow() {
    if (!current) return;
    const turkishToSpeak = direction === "tr-en" ? promptText : expectedAnswer;
    speakTR(turkishToSpeak, { rate: 0.80, pitch: 0.95 });
  }

  if (loading) return <div className="container">Loading…</div>;

  if (!current)
    return (
      <div className="container">
        <div className="card">No terms yet. Add some first.</div>
      </div>
    );

  return (
    <div className="container">
      <div className="card">
        <div className="h1">Practice</div>

        {/* ⭐ SCORE PANEL */}
        <div className="row" style={{ marginTop: 6 }}>
          <div className="badge">Score: {score}</div>
          <div className="badge">Streak: {streak}</div>
          <div className="badge">Mistakes: {current.wrong_count || 0}</div>
        </div>

        {/* ⭐ MODE TOGGLE */}
        <div className="row" style={{ marginTop: 10 }}>
          <button
            className={"btn " + (mode === "normal" ? "btnPrimary" : "")}
            onClick={() => {
              setMode("normal");
              nextTerm();
            }}
          >
            Normal
          </button>
          <button
            className={"btn " + (mode === "hard" ? "btnPrimary" : "")}
            onClick={() => {
              setMode("hard");
              nextTerm();
            }}
          >
            Hard Words
          </button>
        </div>

        {/* ⭐ DIRECTION TOGGLE */}
        <div className="row" style={{ marginTop: 10 }}>
          <button
            className={"btn " + (direction === "en-tr" ? "btnPrimary" : "")}
            onClick={() => {
              setDirection("en-tr");
              setAnswer("");
              setFeedback("");
            }}
          >
            EN → TR
          </button>
          <button
            className={"btn " + (direction === "tr-en" ? "btnPrimary" : "")}
            onClick={() => {
              setDirection("tr-en");
              setAnswer("");
              setFeedback("");
            }}
          >
            TR → EN
          </button>
        </div>

        {/* PROMPT + PRONUNCIATION */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14 }}>
          <div style={{ fontSize: 22, fontWeight: 700, flex: 1 }}>
            {promptText}
          </div>

          {/* 🔊 Normal */}
          <button className="btn" type="button" onClick={pronounceNormal} title="Pronounce">
            🔊
          </button>

          {/* 🐢 Slow */}
          <button className="btn" type="button" onClick={pronounceSlow} title="Slow pronunciation">
            🐢
          </button>
        </div>

        <input
          className="input"
          placeholder={answerPlaceholder}
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
        />

        <div className="row" style={{ marginTop: 10 }}>
          <button className="btn btnPrimary" type="button" onClick={checkAnswer}>
            Check
          </button>
          <button className="btn" type="button" onClick={nextTerm}>
            Next
          </button>
        </div>

        {feedback ? (
          <div className="small muted" style={{ marginTop: 10 }}>
            {feedback}
          </div>
        ) : null}
      </div>
    </div>
  );
}