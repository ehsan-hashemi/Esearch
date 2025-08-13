// نرمال‌سازی فارسی: ی/ي، ک/ك، حذف حرکات، نیم‌فاصله، کشیدگی
export function normalizeFa(str = "") {
  return str
    .toString()
    .trim()
    .replace(/\u200c/g, " ")        // ZWNJ -> space
    .replace(/[\u0640]/g, "")       // Tatweel
    .replace(/[ًٌٍَُِّْـ]/g, "")    // Harakat
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[ۀة]/g, "ه")
    .replace(/[أإآ]/g, "ا")
    .replace(/[ء]/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export function tokenize(str) {
  const s = normalizeFa(str).replace(/[^\p{L}\p{N}\s]/gu, " ");
  const tokens = s.split(/\s+/).filter(Boolean);
  return tokens;
}

export function highlight(text, tokens) {
  if (!text) return "";
  const norm = normalizeFa(text);
  let out = text;
  // ساده: فقط کلمات کامل را هایلایت می‌کنیم
  tokens.forEach(t => {
    if (!t) return;
    const re = new RegExp(`(${escapeRegExp(t)})`, "gi");
    out = out.replace(re, "<mark>$1</mark>");
  });
  return out;
}

function escapeRegExp(s){ return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

export function getDomain(url) {
  try { return new URL(url).hostname; } catch { return url; }
}

export function searchIndex(query, items) {
  const t0 = performance.now();
  const q = normalizeFa(query);
  const qTokens = tokenize(q);

  const qPhrase = qTokens.join(" ");
  const results = [];

  for (const it of items) {
    const title = it.title || "";
    const desc = it.description || "";
    const url = it.url || "";
    const tags = Array.isArray(it.tags) ? it.tags.join(" ") : (it.tags || "");
    const keywords = Array.isArray(it.keywords) ? it.keywords.join(" ") : (it.keywords || "");

    const n = {
      title: normalizeFa(title),
      desc: normalizeFa(desc),
      url: normalizeFa(url),
      tags: normalizeFa(tags),
      keywords: normalizeFa(keywords),
    };

    let score = 0;

    // تطبیق عبارت کامل
    if (qPhrase && (n.title.includes(qPhrase) || n.desc.includes(qPhrase))) score += 10;

    // وزن‌دهی حوزه‌ها
    for (const tok of qTokens) {
      if (!tok) continue;
      if (n.title.includes(tok)) score += 3;
      if (n.desc.includes(tok)) score += 2;
      if (n.keywords.includes(tok)) score += 2;
      if (n.tags.includes(tok)) score += 1.5;
      if (n.url.includes(tok)) score += 1;
      // شروع شدن عنوان با توکن
      if (n.title.startsWith(tok)) score += 1.5;
    }

    // بوست دستی (اختیاری): محبوبیت یا رتبه
    if (it.rank) score += Math.max(0, 5 - it.rank); // rank=1 بهتر

    if (score > 0) {
      results.push({ item: it, score });
    }
  }

  results.sort((a,b) => b.score - a.score);
  const t1 = performance.now();
  return { results, timeMs: (t1 - t0) };
}
