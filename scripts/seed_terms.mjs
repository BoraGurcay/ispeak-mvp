import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.");
  process.exit(1);
}

const supabase = createClient(url, serviceKey);

function parseCSV(text) {
  // simple CSV parser for our controlled file (no embedded newlines)
  const lines = text.split(/\r?\n/).filter(Boolean);
  const header = lines[0].split(",");
  const rows = lines.slice(1).map((l) => {
    const out = {};
    // naive split with quotes support
    const vals = [];
    let cur = "";
    let inQ = false;
    for (let i=0;i<l.length;i++){
      const ch = l[i];
      if (ch === '"' ) { inQ = !inQ; continue; }
      if (ch === ',' && !inQ) { vals.push(cur); cur=""; continue; }
      cur += ch;
    }
    vals.push(cur);
    header.forEach((h, i) => out[h] = vals[i] ?? "");
    return out;
  });
  return rows;
}

async function main() {
  const file = path.join(process.cwd(), "data", "terms_seed.csv");
  const csv = fs.readFileSync(file, "utf8");
  const rows = parseCSV(csv).map((r) => ({
    source_lang: r.source_lang,
    target_lang: r.target_lang,
    domain: r.domain,
    difficulty: Number(r.difficulty || 1),
    source_text: r.source_text,
    target_text: r.target_text,
    plain_meaning_en: r.plain_meaning_en || null,
    plain_meaning_tr: r.plain_meaning_tr || null,
    example_en: r.example_en || null,
    example_tr: r.example_tr || null,
    tags: (r.tags || "").split("|").filter(Boolean),
  }));

  const { error } = await supabase.from("terms").insert(rows);
  if (error) {
    console.error(error);
    process.exit(1);
  }
  console.log(`Seeded ${rows.length} terms.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
