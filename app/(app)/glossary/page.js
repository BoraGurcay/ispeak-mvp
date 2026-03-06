"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

const domains = [
  { value: "court", label: "Court" },
  { value: "immigration", label: "Immigration" },
  { value: "family", label: "Family" },
];

const languages = [
  { value: "tr", label: "Turkish (TR)" },
  { value: "fr", label: "French (FR)" },
  { value: "es", label: "Spanish (ES)" },
  { value: "pt", label: "Portuguese (PT)" },
  { value: "hi", label: "Hindi (HI)" },
  { value: "ar", label: "Arabic (AR)" },
];

// which languages benefit from native script entry/display
const LANGS_WITH_NATIVE = new Set(["ar"]);

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
      return "Hindi";
    case "ar":
      return "Arabic (Roman)";
    default:
      return "Translation";
  }
}

function targetNativeLabel(targetLang) {
  switch (targetLang) {
    case "ar":
      return "Arabic (Native)";
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
      return "e.g., nyayalaya";
    case "ar":
      return "e.g., mahkama / 3am / 7aqq";
    default:
      return "e.g., translation";
  }
}

function targetNativePlaceholder(targetLang) {
  switch (targetLang) {
    case "ar":
      return "e.g., محكمة / عام / حق";
    default:
      return "e.g., native script";
  }
}

// Split target strings with obvious separators only
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

  useEffect(() => {
    const saved = localStorage.getItem("ispeak_target_lang");
    if (["tr", "fr", "es", "pt", "hi", "ar"].includes(saved)) setTargetLang(saved);
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
        .select("id,domain,source_text,target_text,target_native,notes,source_lang,target_lang,created_at")
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

    // personal overrides shared for same English/domain/lang
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
      target_native: form.target_native.trim() || null,
      notes: form.notes.trim() || null,
    };

    let res;
    if (form.id) res = await supabase.from("user_terms").update(payload).eq("id", form.id);
    else res = await supabase.from("user_terms").insert(payload);

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

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function del(id) {
    if (!confirm("Delete this term?")) return;
    const res = await supabase.from("user_terms").delete().eq("id", id);
    if (res.error) return alert(res.error.message);
    showStatus("Deleted ✓");
    await load();
  }

  async function addSharedToMyTerms(sharedTerm) {
    try {
      const next = new Set(savingIds);
      next.add(sharedTerm.id);
      setSavingIds(next);

      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes?.user;
      if (!user) return alert("Please sign in.");

      const payload = {
        user_id: user.id,
        source_lang: "en",
        target_lang: targetLang,
        domain: sharedTerm.domain || "court",
        source_text: (sharedTerm.source_text || "").trim(),
        target_text: (sharedTerm.target_text || "").trim(),
        target_native: (sharedTerm.target_native || "").trim() || null,
        notes: null,
      };

      const res = await supabase.from("user_terms").insert(payload);
      if (res.error) return alert(res.error.message);

      showStatus("Added to My Terms ✓");
      await load();
    } finally {
      const next = new Set(savingIds);
      next.delete(sharedTerm.id);
      setSavingIds(next);
    }
  }

  const showNativeField = LANGS_WITH_NATIVE.has(targetLang);

  return (
    <div className="container">
      <div className="card">
        <div className="h1">Glossary</div>

        {/* Language picker */}
        <label className="small muted">Language</label>
        <select className="select" value={targetLang} onChange={(e) => setTargetLang(e.target.value)}>
          {languages.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </select>

        <div className="hr" />

        {/* Add/Edit form */}
        <form onSubmit={upsert} className="col">
          <label className="small muted">Domain</label>
          <select className="select" value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })}>
            {domains.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>

          <label className="small muted">English</label>
          <input
            className="input"
            value={form.source_text}
            onChange={(e) => setForm({ ...form, source_text: e.target.value })}
            placeholder="e.g., adjournment"
          />

          <label className="small muted">{targetLabel(targetLang)}</label>
          <input
            className="input"
            value={form.target_text}
            onChange={(e) => setForm({ ...form, target_text: e.target.value })}
            placeholder={targetPlaceholder(targetLang)}
          />

          {showNativeField ? (
            <>
              <label className="small muted">{targetNativeLabel(targetLang)}</label>
              <input
                className="input"
                value={form.target_native}
                onChange={(e) => setForm({ ...form, target_native: e.target.value })}
                placeholder={targetNativePlaceholder(targetLang)}
              />
            </>
          ) : null}

          <label className="small muted">Notes (optional)</label>
          <input
            className="input"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="context, caution, dialect notes…"
          />

          <button className="btn btnPrimary" type="submit">
            {form.id ? "Save" : "Add term"}
          </button>

          {form.id ? (
            <button
              className="btn"
              type="button"
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
              Cancel edit
            </button>
          ) : null}

          {status ? <div className="small muted" style={{ marginTop: 8 }}>{status}</div> : null}
        </form>
      </div>

      <div style={{ height: 12 }} />

      <div className="card">
        {/* Filters */}
        <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
          <input
            className="input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search glossary…"
            style={{ flex: 1, minWidth: 220 }}
          />

          <select className="select" value={domainFilter} onChange={(e) => setDomainFilter(e.target.value)}>
            <option value="all">All domains</option>
            {domains.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </div>

        <div className="hr" />

        {loading ? <div className="muted">Loading…</div> : null}
        {!loading && filtered.length === 0 ? <div className="muted">No terms found.</div> : null}

        <div className="col" style={{ marginTop: 10 }}>
          {filtered.map((it) => (
            <div key={`${it.__kind}-${it.id}`} className="card" style={{ padding: 12 }}>
              <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                  <span className="badge">{domainLabel(it.domain)}</span>
                  <span className="badge">{it.__kind === "shared" ? "Shared" : "My term"}</span>
                </div>

                <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                  {it.__kind === "personal" ? (
                    <>
                      <button className="btn" onClick={() => edit(it)}>Edit</button>
                      <button className="btn btnDanger" onClick={() => del(it.id)}>Delete</button>
                    </>
                  ) : (
                    <button
                      className="btn"
                      onClick={() => addSharedToMyTerms(it)}
                      disabled={savingIds.has(it.id)}
                    >
                      {savingIds.has(it.id) ? "Adding…" : "Add to My Terms"}
                    </button>
                  )}
                </div>
              </div>

              <div style={{ marginTop: 10, fontWeight: 800 }}>{it.source_text}</div>

              {/* Native first (if exists), then roman */}
              {it.target_native ? (
                <div style={{ marginTop: 6, fontSize: 18, lineHeight: 1.3 }}>{it.target_native}</div>
              ) : null}
              <div style={{ marginTop: it.target_native ? 4 : 6 }}>{it.target_text}</div>

              {it.notes ? <div className="small muted" style={{ marginTop: 6 }}>{it.notes}</div> : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}