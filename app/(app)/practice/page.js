"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

/** ---------- Normalization / alternatives helpers ---------- */
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

function normalize(s) {
  return stripDiacritics(stripBracketed(s))
    .toLowerCase()
    .replace(/[“”]/g, '"')
    .replace(/[’‘]/g, "'")
    .replace(/[—–]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function extractAlternatives(rawTarget) {
  // split on / ; , and also treat bracketed parts as ignorable
  const t = (rawTarget || "").toString();
  const parts = t
    .split(/[\/;,]/g)
    .map((p) => p.trim())
    .filter(Boolean);

  // also include full target as an option
  const all = [t.trim(), ...parts].filter(Boolean);

  // normalize & dedupe
  const seen = new Set();
  const out = [];
  for (const a of all) {
    const n = normalize(a);
    if (!n) continue;
    if (seen.has(n)) continue;
    seen.add(n);
    out.push(a);
  }
  return out;
}

function findMatchedAlternative(guess, rawTarget) {
  const g = normalize(guess);
  if (!g) return null;

  // Accept exact normalized match against any alternative.
  const alts = extractAlternatives(rawTarget);
  for (const a of alts) {
    if (normalize(a) === g) return a;
  }

  // Also accept match if user includes punctuation/spaces differences
  const g2 = g.replace(/[^a-z0-9]+/g, "");
  for (const a of alts) {
    const a2 = normalize(a).replace(/[^a-z0-9]+/g, "");
    if (a2 && a2 === g2) return a;
  }

  return null;
}

function pickRandomTerm(arr) {
  if (!arr || arr.length === 0) return null;
  const i = Math.floor(Math.random() * arr.length);
  return arr[i];
}

export default function PracticePage() {
  const [lang, setLang] = useState("tr");
  const [mode, setMode] = useState("normal"); // "normal" | "hard"
  const [pool, setPool] = useState([]);
  const [current, setCurrent] = useState(null);
  const [answer, setAnswer] = useState("");
  const [accepted, setAccepted] = useState([]);
  const [matchedAlt, setMatchedAlt] = useState(null);
  const [dataSource, setDataSource] = useState("(none)");
  const [loading, setLoading] = useState(true);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);

  const inputRef = useRef(null);

  const languages = [
    { value: "tr", label: "Turkish (TR)" },
    { value: "fr", label: "French (FR)" },
  ];

  const filteredPool = useMemo(() => {
    if (mode === "hard") {
      // simple hard filter: longer target OR multiple alternatives
      return pool.filter((t) => {
        const tgt = (t.target_text || "").toString();
        return tgt.length >= 18 || extractAlternatives(tgt).length >= 2;
      });
    }
    return pool;
  }, [pool, mode]);

  useEffect(() => {
    setCurrent(pickRandomTerm(filteredPool));
  }, [mode, filteredPool]);

  useEffect(() => {
    let cancelled = false;

    async function loadPool() {
      setLoading(true);
      setDataSource("(loading)");
      setPool([]);
      setCurrent(null);

      // 1) Try shared terms
      const sharedRes = await supabase
        .from("terms")
        .select("id, source, target, domain, lang")
        .eq("lang", lang);

      // 2) Try personal terms if logged in (optional)
      // If you don't have user_terms table, this will fail gracefully.
      let uid = null;
      try {
        const { data: authData } = await supabase.auth.getUser();
        uid = authData?.user?.id || null;
      } catch (_) {}

      let personalRes = { data: [], error: null };
      if (uid) {
        personalRes = await supabase
          .from("user_terms")
          .select("id, source, target, domain, lang")
          .eq("user_id", uid)
          .eq("lang", lang);
      }

      // If either query errors, log details
      if (sharedRes.error || personalRes.error) {
        const err = sharedRes.error || personalRes.error;
        console.error("practice load error (raw):", err);
        // This helps because Next overlay often shows {} otherwise:
        try {
          console.error(
            "practice load error (json):",
            JSON.stringify(err, Object.getOwnPropertyNames(err), 2)
          );
        } catch (_) {}

        if (!cancelled) {
          setDataSource("(error)");
          setPool([]);
          setCurrent(null);
          setLoading(false);
        }
        return;
      }

      // Map DB columns source/target into the keys the practice UI expects
      const shared = (sharedRes.data || []).map((t) => ({
        client_id: `s_${t.id}`,
        term_id: t.id,
        kind: "shared",
        source_text: t.source,
        target_text: t.target,
        domain: t.domain,
        lang: t.lang,
      }));

      const personal = (personalRes.data || []).map((t) => ({
        client_id: `p_${t.id}`,
        term_id: t.id,
        kind: "personal",
        source_text: t.source,
        target_text: t.target,
        domain: t.domain,
        lang: t.lang,
      }));

      const merged = [...shared, ...personal];

      if (!cancelled) {
        setDataSource(uid ? "shared + my terms" : "shared only (not logged in)");
        setPool(merged);
        setCurrent(pickRandomTerm(merged));
        setLoading(false);

        // focus input
        setTimeout(() => inputRef.current?.focus?.(), 50);
      }
    }

    loadPool();
    return () => {
      cancelled = true;
    };
  }, [lang]);

  async function checkAnswer() {
    if (!current) return;

    const guess = answer;
    const target = current?.target_text || "";

    const alts = extractAlternatives(target);
    const matched = findMatchedAlternative(guess, target);

    setAccepted(alts);
    setMatchedAlt(matched);

    const isCorrect = matched !== null;

    if (isCorrect) {
      setScore((s) => s + 1);
      setStreak((s) => s + 1);
    } else {
      setStreak(0);
    }

    // Move to next
    setAnswer("");
    const next = pickRandomTerm(filteredPool);
    setCurrent(next);
    setTimeout(() => inputRef.current?.focus?.(), 50);
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: 24 }}>
      <h1 style={{ fontSize: 40, fontWeight: 700, marginBottom: 16 }}>
        Practice
      </h1>

      <div style={{ display: "flex", alignItems: "flex-end", gap: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ opacity: 0.6 }}>Language</div>
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            style={{ padding: 10, borderRadius: 10 }}
          >
            {languages.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={() => setMode("normal")}
            style={{
              padding: "10px 14px",
              borderRadius: 999,
              border: "1px solid #ddd",
              background: mode === "normal" ? "#111" : "#fff",
              color: mode === "normal" ? "#fff" : "#111",
              fontWeight: 600,
            }}
          >
            Normal
          </button>
          <button
            onClick={() => setMode("hard")}
            style={{
              padding: "10px 14px",
              borderRadius: 999,
              border: "1px solid #ddd",
              background: mode === "hard" ? "#111" : "#fff",
              color: mode === "hard" ? "#fff" : "#111",
              fontWeight: 600,
            }}
          >
            Hard Words
          </button>
        </div>

        <div style={{ marginLeft: "auto", textAlign: "right", opacity: 0.75 }}>
          <div>
            Score: {score} &nbsp;&nbsp; Streak: {streak}
          </div>
          <div style={{ fontSize: 12 }}>
            Data source: <b>{dataSource}</b> · Pool size: {filteredPool.length}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 28 }}>
        {loading ? (
          <div style={{ fontSize: 22, opacity: 0.6 }}>Loading...</div>
        ) : !current ? (
          <div style={{ opacity: 0.7 }}>
            No terms found for this language.
          </div>
        ) : (
          <>
            <div style={{ fontSize: 18, opacity: 0.65 }}>Translate:</div>
            <div style={{ fontSize: 34, fontWeight: 700, marginTop: 8 }}>
              {current.source_text}
            </div>

            <div style={{ marginTop: 20, display: "flex", gap: 10 }}>
              <input
                ref={inputRef}
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") checkAnswer();
                }}
                placeholder="Type your answer…"
                style={{
                  flex: 1,
                  padding: 14,
                  borderRadius: 12,
                  border: "1px solid #ddd",
                  fontSize: 16,
                }}
              />
              <button
                onClick={checkAnswer}
                style={{
                  padding: "14px 18px",
                  borderRadius: 12,
                  border: "1px solid #111",
                  background: "#111",
                  color: "#fff",
                  fontWeight: 700,
                }}
              >
                Check
              </button>
            </div>

            {accepted.length > 0 && (
              <div style={{ marginTop: 14, opacity: 0.9 }}>
                <div style={{ fontWeight: 700 }}>
                  Accepted answers:
                </div>
                <div style={{ marginTop: 6 }}>
                  {accepted.join(" · ")}
                </div>
                <div style={{ marginTop: 6 }}>
                  Matched:{" "}
                  <b>{matchedAlt ? matchedAlt : "—"}</b>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}