"use client";

import { useState } from "react";
import Papa from "papaparse";
import { supabase } from "../lib/supabaseClient";

export default function CsvImport({ onImported }) {
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function insertRows(rows) {
    const { error } = await supabase.from("user_terms").insert(rows);
    if (error) throw error;
  }

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setBusy(true);
    setStatus("Reading CSV...");

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const rows = results.data
            .map((r) => ({
              domain: r.domain || "Court",
              term_en: r.term_en?.trim(),
              term_tr: r.term_tr?.trim(),
              notes: r.notes || null,
            }))
            .filter((r) => r.term_en && r.term_tr);

          if (!rows.length) {
            setStatus("No valid rows found.");
            setBusy(false);
            return;
          }

          await insertRows(rows);

          setStatus(`✅ Imported ${rows.length} terms`);
          onImported?.();
        } catch (err) {
          console.error(err);
          setStatus("Import failed");
        } finally {
          setBusy(false);
        }
      },
    });
  }

  return (
    <div style={{ marginTop: 16 }}>
      <div className="small muted" style={{ marginBottom: 8 }}>
        Import CSV (domain, term_en, term_tr, notes)
      </div>

      <input
        type="file"
        accept=".csv"
        onChange={handleFile}
        disabled={busy}
      />

      {status && (
        <div className="small muted" style={{ marginTop: 8 }}>
          {status}
        </div>
      )}
    </div>
  );
}