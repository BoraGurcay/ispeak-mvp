"use client";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

const domains = [
  { value: "court", label: "Court" },
  { value: "immigration", label: "Immigration" },
  { value: "family", label: "Family" },
];

export default function Glossary() {
  const [q, setQ] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");

  const [form, setForm] = useState({
    id: null,
    domain: "court",
    source_text: "",
    target_text: "",
    notes: "",
  });

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return items;
    return items.filter((it) =>
      (it.source_text || "").toLowerCase().includes(t) ||
      (it.target_text || "").toLowerCase().includes(t) ||
      (it.notes || "").toLowerCase().includes(t)
    );
  }, [items, q]);

  async function load() {
    setLoading(true);
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (!user) return;

    const { data, error } = await supabase
      .from("user_terms")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error) setItems(data || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function upsert(e) {
    e.preventDefault();

    const source = form.source_text.trim();
    const target = form.target_text.trim();

    if (!source || !target) return;

    // duplicate check
    const { data: existing } = await supabase
      .from("user_terms")
      .select("id")
      .ilike("source_text", source)
      .ilike("target_text", target)
      .limit(1);

    if (existing && existing.length > 0 && !form.id) {
      setStatus("⚠️ This term already exists.");
      return;
    }

    const payload = {
      domain: form.domain,
      source_text: source,
      target_text: target,
      notes: form.notes.trim() || null,
    };

    let res;

    if (form.id) {
      res = await supabase.from("user_terms").update(payload).eq("id", form.id);
    } else {
      res = await supabase.from("user_terms").insert(payload);
    }

    if (res.error) {
      setStatus(res.error.message);
      return;
    }

    setForm({
      id: null,
      domain: "court",
      source_text: "",
      target_text: "",
      notes: "",
    });

    setStatus("");
    await load();
  }

  async function edit(it) {
    setForm({
      id: it.id,
      domain: it.domain,
      source_text: it.source_text ?? "",
      target_text: it.target_text ?? "",
      notes: it.notes ?? "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function del(id) {
    if (!confirm("Delete this term?")) return;
    const res = await supabase.from("user_terms").delete().eq("id", id);
    if (res.error) alert(res.error.message);
    await load();
  }

  return (
    <div className="container">
      <div className="card">
        <div className="h1">Glossary</div>

        <form onSubmit={upsert} className="col">
          <label className="small muted">Domain</label>
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
            onChange={(e) =>
              setForm({ ...form, source_text: e.target.value })
            }
            placeholder="e.g., adjournment"
          />

          <label className="small muted">Turkish</label>
          <input
            className="input"
            value={form.target_text}
            onChange={(e) =>
              setForm({ ...form, target_text: e.target.value })
            }
            placeholder="e.g., duruşmanın ertelenmesi"
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

          {status && <div className="small muted">{status}</div>}
        </form>
      </div>

      <div style={{ height: 12 }} />

      <div className="card">
        <input
          className="input"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search your glossary…"
        />
        <div className="hr" />

        {loading ? <div className="muted">Loading…</div> : null}
        {!loading && filtered.length === 0 ? (
          <div className="muted">No terms yet.</div>
        ) : null}

        <div className="col" style={{ marginTop: 10 }}>
          {filtered.map((it) => (
            <div key={it.id} className="card" style={{ padding: 12 }}>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <span className="badge">{it.domain}</span>
                <div className="row">
                  <button className="btn" onClick={() => edit(it)}>
                    Edit
                  </button>
                  <button
                    className="btn btnDanger"
                    onClick={() => del(it.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
              <div style={{ marginTop: 8, fontWeight: 700 }}>
                {it.source_text}
              </div>
              <div style={{ marginTop: 4 }}>{it.target_text}</div>
              {it.notes && (
                <div className="small muted" style={{ marginTop: 6 }}>
                  {it.notes}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}