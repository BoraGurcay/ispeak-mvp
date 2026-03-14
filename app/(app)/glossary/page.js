"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

const domains = [
  { value: "court", label: "Court" },
  { value: "immigration", label: "Immigration" },
  { value: "family", label: "Family" },
];

const languages = [
  { value: "tr", label: "🇹🇷 Turkish" },
  { value: "fr", label: "🇫🇷 French" },
  { value: "es", label: "🇪🇸 Spanish" },
  { value: "pt", label: "🇵🇹 Portuguese" },
  { value: "hi", label: "🇮🇳 Hindi" },
  { value: "ar", label: "🇸🇦 Arabic" },
  { value: "zh", label: "🇨🇳 Mandarin" },
  { value: "ta", label: "🇮🇳 Tamil" },
  { value: "pa", label: "🇮🇳 Punjabi" },
  { value: "tl", label: "🇵🇭 Tagalog" },
  { value: "so", label: "🇸🇴 Somali" },
  { value: "el", label: "🇬🇷 Greek" },
  { value: "ur", label: "🇵🇰 Urdu" },
  { value: "uk", label: "🇺🇦 Ukrainian" },
  { value: "fa", label: "🇮🇷 Farsi" },
];

const LANGS_WITH_NATIVE = new Set([
  "ar",
  "hi",
  "zh",
  "ta",
  "pa",
  "el",
  "ur",
  "uk",
  "fa",
]);

function domainLabel(value) {
  const d = domains.find((x) => x.value === value);
  return d?.label ?? "Unassigned";
}

function normalizeKey(s) {
  return (s || "").toString().trim().toLowerCase();
}

function targetLabel(targetLang) {
  switch (targetLang) {
    case "tr":
      return "Turkish";
    case "fr":
      return "French";
    case "es":
      return "Spanish";
    case "pt":
      return "Portuguese";
    case "hi":
      return "Hindi (Roman)";
    case "ar":
      return "Arabic (Roman)";
    case "zh":
      return "Mandarin (Pinyin)";
    case "ta":
      return "Tamil (Roman)";
    case "pa":
      return "Punjabi (Roman)";
    case "tl":
      return "Tagalog";
    case "so":
      return "Somali";
    case "el":
      return "Greek (Roman)";
    case "ur":
      return "Urdu (Roman)";
    case "uk":
      return "Ukrainian (Roman)";
    case "fa":
      return "Farsi (Roman)";
    default:
      return "Translation";
  }
}

function targetNativeLabel(targetLang) {
  switch (targetLang) {
    case "ar":
      return "Arabic (Native)";
    case "hi":
      return "Hindi (Native)";
    case "zh":
      return "Mandarin (Native)";
    case "ta":
      return "Tamil (Native)";
    case "pa":
      return "Punjabi (Native)";
    case "el":
      return "Greek (Native)";
    case "ur":
      return "Urdu (Native)";
    case "uk":
      return "Ukrainian (Native)";
    case "fa":
      return "Farsi (Native)";
    default:
      return "Native (optional)";
  }
}

function targetPlaceholder(targetLang) {
  switch (targetLang) {
    case "tr":
      return "e.g., duruşmanın ertelenmesi";
    case "fr":
      return "e.g., ajournement";
    case "es":
      return "e.g., aplazamiento";
    case "pt":
      return "e.g., adiamento";
    case "hi":
      return "e.g., nyayalaya / vakil";
    case "ar":
      return "e.g., mahkama / 3am / 7aqq";
    case "zh":
      return "e.g., fayuan / lüshi";
    case "ta":
      return "e.g., neethimandram / vakkeel";
    case "pa":
      return "e.g., adaalat / wakeel";
    case "tl":
      return "e.g., hukuman / pagdinig";
    case "so":
      return "e.g., maxkamad / qareen";
    case "el":
      return "e.g., dikastirio / diki";
    case "ur":
      return "e.g., adaalat / wakeel";
    case "uk":
      return "e.g., sud / advokat";
    case "fa":
      return "e.g., dadgah / vakil";
    default:
      return "e.g., translation";
  }
}

function targetNativePlaceholder(targetLang) {
  switch (targetLang) {
    case "ar":
      return "e.g., محكمة / عام / حق";
    case "hi":
      return "e.g., न्यायालय / वकील";
    case "zh":
      return "e.g., 法院 / 律师";
    case "ta":
      return "e.g., நீதிமன்றம் / வழக்கறிஞர்";
    case "pa":
      return "e.g., ਅਦਾਲਤ / ਵਕੀਲ";
    case "el":
      return "e.g., δικαστήριο / δικηγόρος";
    case "ur":
      return "e.g., عدالت / وکیل";
    case "uk":
      return "e.g., суд / адвокат";
    case "fa":
      return "e.g., دادگاه / وکیل";
    default:
      return "e.g., native script";
  }
}

function splitTargets(raw) {
  const s = (raw || "").toString().trim();
  if (!s) return [];
  return s
    .split(/\s*(?:\/|\||;|\n)\s*/g)
    .map((x) => x.trim())
    .filter(Boolean);
}

function dedupeAndMergeTargets(a, b) {
  const parts = [...splitTargets(a), ...splitTargets(b)];
  const seen = new Set();
  const out = [];

  for (const p of parts) {
    const key = normalizeKey(p);
    if (!key) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out.join(" / ");
}

export default function Glossary() {
  const [q, setQ] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const [targetLang, setTargetLang] = useState("tr");
  const [domainFilter, setDomainFilter] = useState("all");

  const [status, setStatus] = useState("");
  const statusTimerRef = useRef(null);
  const addFormRef = useRef(null);

  const [form, setForm] = useState({
    id: null,
    domain: "court",
    source_text: "",
    target_text: "",
    target_native: "",
    notes: "",
  });

  const [savingIds, setSavingIds] = useState(() => new Set());

  function showStatus(msg) {
    setStatus(msg);
    if (statusTimerRef.current) window.clearTimeout(statusTimerRef.current);
    statusTimerRef.current = window.setTimeout(() => setStatus(""), 1800);
  }

  function scrollToAddForm() {
    addFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  useEffect(() => {
    const saved = localStorage.getItem("ispeak_target_lang");
    if (
      [
        "tr",
        "fr",
        "es",
        "pt",
        "hi",
        "ar",
        "zh",
        "ta",
        "pa",
        "tl",
        "so",
        "el",
        "ur",
        "uk",
        "fa",
      ].includes(saved)
    ) {
      setTargetLang(saved);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("ispeak_target_lang", targetLang);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetLang]);

  function termKey(it) {
    return `${normalizeKey(it.domain)}|${normalizeKey(it.source_text)}|${normalizeKey(
      it.target_lang || targetLang
    )}|${it.__kind || ""}`;
  }

  function dedupeList(list) {
    const map = new Map();

    for (const it of list) {
      const key = termKey(it);
      const prev = map.get(key);

      if (!prev) {
        map.set(key, { ...it });
        continue;
      }

      const mergedTarget = dedupeAndMergeTargets(prev.target_text, it.target_text);
      const mergedNative = dedupeAndMergeTargets(prev.target_native, it.target_native);

      const prevSrc = (prev.source_text || "").toString().trim();
      const nextSrc = (it.source_text || "").toString().trim();
      const betterSource =
        prevSrc && nextSrc
          ? prevSrc.length >= nextSrc.length
            ? prevSrc
            : nextSrc
          : prevSrc || nextSrc;

      map.set(key, {
        ...prev,
        source_text: betterSource,
        target_text: mergedTarget,
        target_native: mergedNative,
      });
    }

    return Array.from(map.values());
  }

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();

    return items.filter((it) => {
      const domainOk = domainFilter === "all" || it.domain === domainFilter;
      if (!domainOk) return false;

      if (!t) return true;

      const s = (it.source_text || "").toLowerCase();
      const tr = (it.target_text || "").toLowerCase();
      const tn = (it.target_native || "").toLowerCase();
      const n = (it.notes || "").toLowerCase();

      return s.includes(t) || tr.includes(t) || tn.includes(t) || n.includes(t);
    });
  }, [items, q, domainFilter]);

  async function load() {
    setLoading(true);

    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;

    const sharedRes = await supabase
      .from("terms")
      .select("id,domain,source_text,target_text,target_native,source_lang,target_lang")
      .eq("source_lang", "en")
      .eq("target_lang", targetLang)
      .limit(5000);

    if (sharedRes.error) {
      console.error("Shared terms error:", sharedRes.error);
      showStatus(`Shared load error: ${sharedRes.error.message}`);
    }

    let personalRes = { data: [], error: null };
    if (user) {
      personalRes = await supabase
        .from("user_terms")
        .select(
          "id,domain,source_text,target_text,target_native,notes,source_lang,target_lang,created_at"
        )
        .eq("source_lang", "en")
        .eq("target_lang", targetLang)
        .order("created_at", { ascending: false })
        .limit(5000);

      if (personalRes.error) {
        console.error("Personal terms error:", personalRes.error);
        showStatus(`My terms load error: ${personalRes.error.message}`);
      }
    }

    const shared = (sharedRes.data || []).map((t) => ({
      ...t,
      __kind: "shared",
      notes: null,
    }));

    const personal = (personalRes.data || []).map((t) => ({
      ...t,
      __kind: "personal",
    }));

    const personalKeyNoKind = (it) =>
      `${normalizeKey(it.domain)}|${normalizeKey(it.source_text)}|${normalizeKey(
        it.target_lang || targetLang
      )}`;

    const personalKeys = new Set(personal.map(personalKeyNoKind));
    const sharedFiltered = shared.filter((t) => !personalKeys.has(personalKeyNoKind(t)));

    const personalDeduped = dedupeList(personal);
    const sharedDeduped = dedupeList(sharedFiltered);

    setItems([...personalDeduped, ...sharedDeduped]);
    setLoading(false);
  }

  async function upsert(e) {
    e.preventDefault();
    if (!form.source_text.trim() || !form.target_text.trim()) return;

    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (!user) return alert("Please sign in to add terms.");

    const payload = {
      user_id: user.id,
      source_lang: "en",
      target_lang: targetLang,
      domain: form.domain,
      source_text: form.source_text.trim(),
      target_text: form.target_text.trim(),
      target_native: LANGS_WITH_NATIVE.has(targetLang)
        ? form.target_native.trim() || null
        : null,
      notes: form.notes.trim() || null,
    };

    let res;
    if (form.id) {
      res = await supabase.from("user_terms").update(payload).eq("id", form.id);
    } else {
      res = await supabase.from("user_terms").insert(payload);
    }

    if (res.error) return alert(res.error.message);

    setForm({
      id: null,
      domain: "court",
      source_text: "",
      target_text: "",
      target_native: "",
      notes: "",
    });

    showStatus(form.id ? "Saved ✓" : "Added ✓");
    await load();
  }

  function edit(it) {
    if (it.__kind !== "personal") return;

    setForm({
      id: it.id,
      domain: it.domain || "court",
      source_text: it.source_text ?? "",
      target_text: it.target_text ?? "",
      target_native: it.target_native ?? "",
      notes: it.notes ?? "",
    });

    scrollToAddForm();
  }

  async function del(id) {
    if (!confirm("Delete this term?")) return;

    const res = await supabase.from("user_terms").delete().eq("id", id);
    if (res.error) return alert(res.error.message);

    showStatus("Deleted ✓");
    await load();
  }

  async function addSharedToMyTerms(sharedTerm) {
    if (savingIds.has(sharedTerm.id)) return;

    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (!user) return alert("Please sign in to save terms.");

    setSavingIds((prev) => new Set(prev).add(sharedTerm.id));

    const payload = {
      user_id: user.id,
      source_lang: "en",
      target_lang: sharedTerm.target_lang,
      domain: sharedTerm.domain,
      source_text: sharedTerm.source_text,
      target_text: sharedTerm.target_text,
      target_native: sharedTerm.target_native || null,
      notes: null,
    };

    const res = await supabase.from("user_terms").insert(payload);

    setSavingIds((prev) => {
      const next = new Set(prev);
      next.delete(sharedTerm.id);
      return next;
    });

    if (res.error) {
      if (res.error.code === "23505") {
        showStatus("Already in My Terms");
      } else {
        alert(res.error.message);
      }
      return;
    }

    showStatus("Added to My Terms ✓");
    await load();
  }

  const usesNative = LANGS_WITH_NATIVE.has(targetLang);

  return (
    <div className="container">
      <div className="card">
        <div className="h1">Glossary</div>
        <div
          className="small muted"
          style={{ marginTop: 6, lineHeight: 1.6, maxWidth: 620 }}
        >
          Search shared terminology, save important terms to My Terms, and build a
          personal glossary by domain and language.
        </div>
      </div>

      <div style={{ height: 12 }} />

      <div className="card">
        <div className="h2" style={{ marginBottom: 10 }}>
          Browse Terms
        </div>

        <div className="small muted" style={{ marginBottom: 12, lineHeight: 1.6 }}>
          Search first. If a term is missing, you can add it below.
        </div>

        <div className="row" style={{ gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
          <button type="button" className="btn" onClick={scrollToAddForm}>
            Add New Term
          </button>
        </div>

        <div className="col" style={{ gap: 12 }}>
          <label>
            <div className="muted" style={{ marginBottom: 6 }}>
              Language
            </div>
            <select
              className="input"
              value={targetLang}
              onChange={(e) => setTargetLang(e.target.value)}
            >
              {languages.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>

          <input
            className="input"
            placeholder="Search glossary..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />

          <select
            className="input"
            value={domainFilter}
            onChange={(e) => setDomainFilter(e.target.value)}
          >
            <option value="all">All Domains</option>
            {domains.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>

          <div className="hr" />

          {loading ? (
            <div className="muted">Loading glossary...</div>
          ) : filtered.length === 0 ? (
            <div className="muted">
              No terms found for this search. Try another term or domain.
            </div>
          ) : (
            <div className="col" style={{ gap: 12 }}>
              {filtered.map((it) => (
                <div key={`${it.__kind}-${it.id}`} className="card" style={{ padding: 14 }}>
                  <div
                    className="row"
                    style={{
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: 12,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="small muted" style={{ marginBottom: 6 }}>
                        {domainLabel(it.domain)} •{" "}
                        {it.__kind === "personal" ? "My Terms" : "Shared"}
                      </div>

                      <div className="h2" style={{ marginBottom: 8 }}>
                        {it.source_text}
                      </div>

                      {it.target_native ? (
                        <div
                          style={{
                            fontSize: 20,
                            lineHeight: 1.5,
                            direction:
                              it.target_lang === "ar" ||
                              it.target_lang === "ur" ||
                              it.target_lang === "fa"
                                ? "rtl"
                                : "auto",
                          }}
                        >
                          {it.target_native}
                        </div>
                      ) : null}

                      <div className="muted" style={{ marginTop: it.target_native ? 4 : 0 }}>
                        {it.target_text}
                      </div>

                      {it.notes ? (
                        <div className="small muted" style={{ marginTop: 8, lineHeight: 1.6 }}>
                          {it.notes}
                        </div>
                      ) : null}
                    </div>

                    <div className="col" style={{ gap: 8, minWidth: 160 }}>
                      {it.__kind === "personal" ? (
                        <>
                          <button className="btn" onClick={() => edit(it)}>
                            Edit
                          </button>
                          <button className="btn btnDanger" onClick={() => del(it.id)}>
                            Delete
                          </button>
                        </>
                      ) : (
                        <button
                          className="btn"
                          onClick={() => addSharedToMyTerms(it)}
                          disabled={savingIds.has(it.id)}
                        >
                          {savingIds.has(it.id) ? "Saving..." : "Add to My Terms"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ height: 12 }} />

      <div ref={addFormRef} className="card">
        <div className="h2" style={{ marginBottom: 10 }}>
          {form.id ? "Edit Term" : "Add a New Term"}
        </div>

        <div className="small muted" style={{ marginBottom: 12, lineHeight: 1.6 }}>
          Add your own terminology when you want to build a personal study list.
        </div>

        <form onSubmit={upsert} className="col" style={{ gap: 12 }}>
          <label>
            <div className="muted" style={{ marginBottom: 6 }}>
              Domain
            </div>
            <select
              className="input"
              value={form.domain}
              onChange={(e) => setForm((f) => ({ ...f, domain: e.target.value }))}
            >
              {domains.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            <div className="muted" style={{ marginBottom: 6 }}>
              English Term
            </div>
            <input
              className="input"
              value={form.source_text}
              onChange={(e) => setForm((f) => ({ ...f, source_text: e.target.value }))}
              placeholder="e.g., adjournment"
            />
          </label>

          <label>
            <div className="muted" style={{ marginBottom: 6 }}>
              {targetLabel(targetLang)}
            </div>
            <input
              className="input"
              value={form.target_text}
              onChange={(e) => setForm((f) => ({ ...f, target_text: e.target.value }))}
              placeholder={targetPlaceholder(targetLang)}
            />
          </label>

          {usesNative ? (
            <label>
              <div className="muted" style={{ marginBottom: 6 }}>
                {targetNativeLabel(targetLang)}
              </div>
              <input
                className="input"
                value={form.target_native}
                onChange={(e) => setForm((f) => ({ ...f, target_native: e.target.value }))}
                placeholder={targetNativePlaceholder(targetLang)}
                dir={
                  targetLang === "ar" || targetLang === "ur" || targetLang === "fa"
                    ? "rtl"
                    : "auto"
                }
              />
            </label>
          ) : null}

          <label>
            <div className="muted" style={{ marginBottom: 6 }}>
              Notes
            </div>
            <input
              className="input"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="context, caution, dialect notes..."
            />
          </label>

          <button className="btn btnPrimary" type="submit">
            {form.id ? "Save Term" : "Add Term"}
          </button>

          {form.id ? (
            <button
              type="button"
              className="btn"
              onClick={() =>
                setForm({
                  id: null,
                  domain: "court",
                  source_text: "",
                  target_text: "",
                  target_native: "",
                  notes: "",
                })
              }
            >
              Cancel Edit
            </button>
          ) : null}

          {status ? <div className="small muted">{status}</div> : null}
        </form>
      </div>
    </div>
  );
}