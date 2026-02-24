"use client";
import { useEffect, useRef, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

const languages = [
  { value: "tr", label: "Turkish (TR)" },
  { value: "fr", label: "French (FR)" },
];

function normalize(s) {
  return (s || "").toLowerCase().trim();
}

// Weighted pick: if hard mode, prefer higher wrong_count
function weightedPick(list, getWrongCount) {
  if (!list.length) return null;
  const weighted = list.flatMap((t) => Array((getWrongCount(t) || 0) + 1).fill(t));
  return weighted[Math.floor(Math.random() * weighted.length)];
}

export default function Practice() {
  const [targetLang, setTargetLang] = useState("tr");
  const [mode, setMode] = useState("normal"); // normal | hard

  const [terms, setTerms] = useState([]); // combined: shared + personal
  const [current, setCurrent] = useState(null);

  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState(true);

  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);

  // Sounds
  const correctSoundRef = useRef(null);
  const wrongSoundRef = useRef(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      correctSoundRef.current = new Audio("/sounds/correct.mp3");
      wrongSoundRef.current = new Audio("/sounds/wrong.mp3");
      correctSoundRef.current.preload = "auto";
      wrongSoundRef.current.preload = "auto";
    }
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("ispeak_target_lang");
    if (saved === "tr" || saved === "fr") setTargetLang(saved);
  }, []);

  useEffect(() => {
    localStorage.setItem("ispeak_target_lang", targetLang);
    loadTerms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetLang]);

  function playSound(ref) {
    const a = ref?.current;
    if (!a) return;
    try {
      a.currentTime = 0;
      a.play();
    } catch {}
  }

  async function loadTerms() {
    setLoading(true);
    setFeedback("");
    setAnswer("");

    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (!user) {
      setTerms([]);
      setCurrent(null);
      setLoading(false);
      return;
    }

    // 1) Shared terms (prebuilt)
    const sharedRes = await supabase
      .from("terms")
      .select("id,source_text,target_text,domain,target_lang")
      .eq("source_lang", "en")
      .eq("target_lang", targetLang)
      .eq("domain", "court")
      .limit(2000);

    // 2) Personal terms (user_terms)
    const personalRes = await supabase
      .from("user_terms")
      .select("id,source_text,target_text,domain,wrong_count,source_lang,target_lang")
      .eq("source_lang", "en")
      .eq("target_lang", targetLang)
      .limit(2000);

    // 3) Stats for shared terms (user_term_stats)
    let statsMap = new Map();
    if (!sharedRes.error && (sharedRes.data || []).length > 0) {
      const sharedIds = sharedRes.data.map((t) => t.id);

      // Pull stats for just these shared ids
      const statsRes = await supabase
        .from("user_term_stats")
        .select("term_id,wrong_count,correct_count")
        .in("term_id", sharedIds);

      if (!statsRes.error && statsRes.data) {
        statsMap = new Map(statsRes.data.map((r) => [r.term_id, r]));
      }
    }

    const shared = (sharedRes.data || []).map((t) => {
      const st = statsMap.get(t.id);
      return {
        ...t,
        __kind: "shared",
        wrong_count: st?.wrong_count || 0,
        correct_count: st?.correct_count || 0,
      };
    });

    const personal = (personalRes.data || []).map((t) => ({
      ...t,
      __kind: "personal",
      wrong_count: t.wrong_count || 0,
    }));

    // Combine (shared first, then personal)
    const combined = [...shared, ...personal];

    setTerms(combined);

    // Pick first
    const first = pickNext(combined, mode);
    setCurrent(first);

    setLoading(false);
  }

  function pickNext(list, modeType) {
    if (!list.length) return null;

    let pool = list;
    if (modeType === "hard") {
      const hardPool = list.filter((t) => (t.wrong_count || 0) > 0);
      pool = hardPool.length ? hardPool : list;
    }
    return weightedPick(pool, (t) => t.wrong_count || 0);
  }

  async function incrementSharedStat(termId, field) {
    // field: "wrong_count" | "correct_count"
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (!user) return;

    // Upsert + increment
    // 1) Ensure row exists
    await supabase.from("user_term_stats").upsert(
      { user_id: user.id, term_id: termId, wrong_count: 0, correct_count: 0, last_seen: new Date().toISOString() },
      { onConflict: "user_id,term_id" }
    );

    // 2) Increment
    const patch = field === "wrong_count"
      ? { wrong_count: (current.wrong_count || 0) + 1, last_seen: new Date().toISOString() }
      : { correct_count: (current.correct_count || 0) + 1, last_seen: new Date().toISOString() };

    await supabase
      .from("user_term_stats")
      .update(patch)
      .eq("user_id", user.id)
      .eq("term_id", termId);
  }

  async function checkAnswer() {
    if (!current) return;

    const correct = normalize(current.target_text);
    const userAns = normalize(answer);

    if (!userAns) return;

    if (correct === userAns) {
      playSound(correctSoundRef);
      setFeedback("✅ Correct!");
      setScore((s) => s + 10);
      setStreak((s) => s + 1);

      // update stats
      if (current.__kind === "personal") {
        // optional: we can also track correct_count in personal later
      } else {
        await incrementSharedStat(current.id, "correct_count");
        // update local state so hard mode gets smarter immediately
        setCurrent((c) => ({ ...c, correct_count: (c.correct_count || 0) + 1 }));
      }
    } else {
      playSound(wrongSoundRef);
      setFeedback(`❌ Correct: ${current.target_text}`);
      setStreak(0);

      if (current.__kind === "personal") {
        await supabase
          .from("user_terms")
          .update({ wrong_count: (current.wrong_count || 0) + 1 })
          .eq("id", current.id);
      } else {
        await incrementSharedStat(current.id, "wrong_count");
      }

      // update local so hard mode feels immediate
      setCurrent((c) => ({ ...c, wrong_count: (c.wrong_count || 0) + 1 }));
    }
  }

  function nextTerm() {
    const next = pickNext(terms, mode);
    setCurrent(next);
    setAnswer("");
    setFeedback("");
  }

  if (loading) return <div className="container">Loading…</div>;

  if (!current)
    return (
      <div className="container">
        <div className="card">No terms yet. Seed terms should appear now — if not, tell me and we’ll fix it.</div>
      </div>
    );

  return (
    <div className="container">
      <div className="card">
        <div className="h1">Practice</div>

        {/* Language + Mode */}
        <label className="small muted">Language</label>
        <select className="select" value={targetLang} onChange={(e) => setTargetLang(e.target.value)}>
          {languages.map((l) => (
            <option key={l.value} value={l.value}>{l.label}</option>
          ))}
        </select>

        <div className="row" style={{ marginTop: 10 }}>
          <button
            className={"btn " + (mode === "normal" ? "btnPrimary" : "")}
            onClick={() => { setMode("normal"); nextTerm(); }}
          >
            Normal
          </button>
          <button
            className={"btn " + (mode === "hard" ? "btnPrimary" : "")}
            onClick={() => { setMode("hard"); nextTerm(); }}
          >
            Hard Words
          </button>
        </div>

        {/* Score panel */}
        <div className="row" style={{ marginTop: 10 }}>
          <div className="badge">Score: {score}</div>
          <div className="badge">Streak: {streak}</div>
          <div className="badge">Mistakes: {current.wrong_count || 0}</div>
          <div className="badge">{current.__kind === "shared" ? "Pack" : "My term"}</div>
        </div>

        <div style={{ fontSize: 22, fontWeight: 700, marginTop: 14 }}>
          {current.source_text}
        </div>

        <input
          className="input"
          placeholder="Type translation…"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
        />

        <button className="btn btnPrimary" onClick={checkAnswer}>
          Check
        </button>

        {feedback ? (
          <div className="small muted" style={{ marginTop: 10 }}>
            {feedback}
          </div>
        ) : null}

        <button className="btn" style={{ marginTop: 10 }} onClick={nextTerm}>
          Next
        </button>

        <div className="hr" />
        <div className="small muted">
          Tip: “Hard Words” focuses on terms you personally miss more often (even from the built-in pack).
        </div>
      </div>
    </div>
  );
}