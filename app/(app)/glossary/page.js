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
];

function domainLabel(value) {
  const d = domains.find((x) => x.value === value);
  return d?.label ?? "Unassigned";
}

function normalizeKey(s) {
  return (s || "").toString().trim().toLowerCase();
}

export default function Glossary() {
  const [q, setQ] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // Match Practice page key
  const [targetLang, setTargetLang] = useState("tr");

  // list filter (separate from form domain)
  const [domainFilter, setDomainFilter] = useState("all"); // all | court | immigration | family

  // status message
  const [status, setStatus] = useState("");
  const statusTimerRef = useRef(null);

  const [form, setForm] = useState({
    id: null,
    domain: "court",
    source_text: "",
    target_text: "",
    notes: "",
  });

  // track pack-to-my-term saves to prevent double taps
  const [savingIds, setSavingIds] = useState(() => new Set());

  function showStatus(msg) {
    setStatus(msg);
    if (statusTimerRef.current) window.clearTimeout(statusTimerRef.current);
    statusTimerRef.current = window.setTimeout(() => setStatus(""), 1800);
  }

  // Load saved language
  useEffect(() => {
    const saved = localStorage.getItem("ispeak_target_lang");
    if (saved === "tr" || saved === "fr" || saved === "es" || saved === "pt") {
      setTargetLang(saved);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("ispeak_target_lang", targetLang);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetLang]);

  // Use the row’s own target_lang for the key (more robust)
  function termKey(it) {
    return `${normalizeKey(it.domain)}|${normalizeKey(it.source_text)}|${normalizeKey(
      it.target_lang || targetLang
    )}`;
  }

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();

    return items.filter((it) => {
      const domainOk = domainFilter === "all" || it.domain === domainFilter;
      if (!domainOk) return false;

      if (!t) return true;

      const s = (it.source_text || "").toLowerCase();
      const tr = (it.target_text || "").toLowerCase();
      const n = (it.notes || "").toLowerCase();
      return s.includes(t) || tr.includes(t) || n.includes(t);
    });
  }, [items, q, domainFilter]);

  async function load() {
    setLoading(true);

    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;

    // Shared pack terms
    const sharedRes = await supabase
      .from("terms")
      .select("id,domain,source_text,target_text,source_lang,target_lang")
      .eq("source_lang", "en")
      .eq("target_lang", targetLang)
      .limit(5000);

    if (sharedRes.error) {
      console.error("Shared terms error:", sharedRes.error);
      showStatus(`Shared load error: ${sharedRes.error.message}`);
    }

    // Personal terms
    let personalRes = { data: [], error: null };
    if (user) {
      personalRes = await supabase
        .from("user_terms")
        .select("id,domain,source_text,target_text,notes,source_lang,target_lang,created_at")
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

    // Deduplicate: if personal overrides a pack term, hide the pack term
    const personalKeys = new Set(personal.map(termKey));
    const sharedFiltered = shared.filter((t) => !personalKeys.has(termKey(t)));

    setItems([...personal, ...sharedFiltered]);
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
      notes: form.notes.trim() || null,
    };

    let res;
    if (form.id) {
      res = await supabase.from("user_terms").update(payload).eq("id", form.id);
    } else {
      res = await supabase.from("user_terms").insert(payload);
    }

    if (res.error) return alert(res.error.message);

    setForm({ id: null, domain: "court", source_text: "", target_text: "", notes: "" });
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

  // Copy a shared term into user_terms so it becomes "My term"
  async function addSharedToMyTerms(sharedTerm) {
    if (savingIds.has(sharedTerm.id)) return;

    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (!user) return alert("Please sign in to save personal terms.");

    const alreadyPersonal = items.some(
      (it) => it.__kind === "personal" && termKey(it) === termKey(sharedTerm)
    );
    if (alreadyPersonal) return showStatus("Already in My terms");

    const next = new Set(savingIds);
    next.add(sharedTerm.id);
    setSavingIds(next);

    const payload = {
      user_id: user.id,
      source_lang: "en",
      target_lang: targetLang,
      domain: sharedTerm.domain || "court",
      source_text: (sharedTerm.source_text || "").trim(),
      target_text: (sharedTerm.target_text || "").trim(),
      notes: null,
    };

    const res = await supabase.from("user_terms").insert(payload);

    const next2 = new Set(next);
    next2.delete(sharedTerm.id);
    setSavingIds(next2);

    if (res.error) return alert(res.error.message);

    showStatus("Saved to My terms ✓");
    await load();
  }

  return (
    <div className="container">
      <div className="card">
        <div className="h1">Glossary</div>

        {status ? (
          <div className="small muted" style={{ marginTop: 8 }}>
            {status}
          </div>
        ) : null}

        <label className="small muted" style={{ marginTop: 10 }}>
          Language
        </label>
        <select className="select" value={targetLang} onChange={(e) => setTargetLang(e.target.value)}>
          {languages.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </select>

        <label className="small muted" style={{ marginTop: 10 }}>
          Filter list by domain
        </label>
        <select className="select" value={domainFilter} onChange={(e) => setDomainFilter(e.target.value)}>
          <option value="all">All</option>
          {domains.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>

        <div className="hr" />

        <form onSubmit={upsert} className="col">
          <label className="small muted">Domain for new term</label>
          <select
            className="select"
            value={form.domain}
            onChange={(e) => setForm({ ...form, domain: e.target.value })}
          >
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

          <label className="small muted">
            {targetLang === "tr"
              ? "Turkish"
              : targetLang === "fr"
              ? "French"
              : targetLang === "es"
              ? "Spanish"
              : "Portuguese"}
          </label>

          <input
            className="input"
            value={form.target_text}
            onChange={(e) => setForm({ ...form, target_text: e.target.value })}
            placeholder={
              targetLang === "tr"
                ? "e.g., duruşmanın ertelenmesi"
                : targetLang === "fr"
                ? "e.g., ajournement"
                : targetLang === "es"
                ? "e.g., aplazamiento"
                : "e.g., adiamento"
            }
          />

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
              onClick={() => setForm({ id: null, domain: "court", source_text: "", target_text: "", notes: "" })}
            >
              Cancel edit
            </button>
          ) : null}
        </form>
      </div>

      <div style={{ height: 12 }} />

      <div className="card">
        <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search glossary…" />
        <div className="hr" />

        {loading ? <div className="muted">Loading…</div> : null}
        {!loading && filtered.length === 0 ? <div className="muted">No terms found.</div> : null}

        <div className="col" style={{ marginTop: 10 }}>
          {filtered.map((it) => {
            const kindLabel = it.__kind === "shared" ? "Shared" : "My terms";
            const dLabel = domainLabel(it.domain);

            return (
              <div key={`${it.__kind}-${it.id}`} className="card" style={{ padding: 12 }}>
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <span className="badge">
                    {kindLabel} • {dLabel}
                  </span>

                  {it.__kind === "personal" ? (
                    <div className="row">
                      <button className="btn" onClick={() => edit(it)}>
                        Edit
                      </button>
                      <button className="btn btnDanger" onClick={() => del(it.id)}>
                        Delete
                      </button>
                    </div>
                  ) : (
                    <button className="btn" disabled={savingIds.has(it.id)} onClick={() => addSharedToMyTerms(it)}>
                      {savingIds.has(it.id) ? "Saving…" : "Add to My Terms"}
                    </button>
                  )}
                </div>

                <div style={{ marginTop: 8, fontWeight: 700 }}>{it.source_text}</div>
                <div style={{ marginTop: 4 }}>{it.target_text}</div>

                {it.notes ? (
                  <div className="small muted" style={{ marginTop: 6 }}>
                    {it.notes}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}