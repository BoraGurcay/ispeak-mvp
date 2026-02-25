// lib/answerMatch.js

function normalizeTR(s = "") {
  return s
    .toLowerCase()
    .trim()
    // normalize Turkish chars so "karari" can match "kararı"
    .replace(/ı/g, "i")
    .replace(/İ/g, "i")
    .replace(/ş/g, "s")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    // remove quotes/apostrophes and most punctuation
    .replace(/[’'".,;:!?]/g, "")
    // collapse whitespace
    .replace(/\s+/g, " ");
}

function getAcceptedAnswers(expected = "") {
  const raw = String(expected).trim();
  if (!raw) return [];

  const accepted = new Set();

  // 1) grab parenthesis content as separate valid answers
  // e.g. "kefaletle serbest bırakma (salıverme emri)" -> "salıverme emri"
  const parenMatches = raw.match(/\(([^)]+)\)/g) || [];
  for (const m of parenMatches) {
    const inside = m.replace(/[()]/g, "").trim();
    if (inside) accepted.add(inside);
  }

  // 2) base text with parentheses removed
  const base = raw.replace(/\(([^)]+)\)/g, " ").replace(/\s+/g, " ").trim();
  if (base) accepted.add(base);

  // 3) split both base and parenthesis answers by separators (/ , ; |)
  // also supports " veya " and " ya da "
  const splitters = /\/|,|;|\||\bveya\b|\bya da\b/gi;

  const expanded = new Set();
  for (const item of accepted) {
    const parts = item.split(splitters).map((x) => x.trim()).filter(Boolean);
    for (const p of parts) expanded.add(p);
  }

  // 4) normalize everything
  return Array.from(expanded)
    .map(normalizeTR)
    .filter(Boolean);
}

export function isCorrectAnswer(userInput, expectedAnswer) {
  const user = normalizeTR(userInput);
  if (!user) return false;

  const accepted = getAcceptedAnswers(expectedAnswer);
  return accepted.includes(user);
}