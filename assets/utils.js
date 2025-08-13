// نرمال‌سازی فارسی
export function normalizeFa(str = "") {
  return str
    .toString()
    .trim()
    .replace(/\u200c/g, " ")
    .replace(/[\u0640]/g, "")
    .replace(/[ًٌٍَُِّْـ]/g, "")
    .replace(/ي/g, "ی").replace(/ك/g, "ک")
    .replace(/[ۀة]/g, "ه")
    .replace(/[أإآ]/g, "ا")
    .replace(/[ء]/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export function tokenize(str) {
  const s = normalizeFa(str).replace(/[^\p{L}\p{N}\s]/gu, " ");
  return s.split(/\s+/).filter(Boolean);
}

export function highlight(text, tokens) {
  if (!text) return "";
  let out = text;
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
    if (qPhrase && (n.title.includes(qPhrase) || n.desc.includes(qPhrase))) score += 10;

    for (const tok of qTokens) {
      if (!tok) continue;
      if (n.title.includes(tok)) score += 3;
      if (n.desc.includes(tok)) score += 2;
      if (n.keywords.includes(tok)) score += 2;
      if (n.tags.includes(tok)) score += 1.5;
      if (n.url.includes(tok)) score += 1;
      if (n.title.startsWith(tok)) score += 1.5;
    }

    if (it.rank) score += Math.max(0, 5 - it.rank);
    if (score > 0) results.push({ item: it, score });
  }

  results.sort((a,b) => b.score - a.score);
  const t1 = performance.now();
  return { results, timeMs: (t1 - t0) };
}

/* LocalStorage helpers */
export const STORAGE_KEYS = {
  queries: "esearch_queries",
  visits: "esearch_visits",
  userSites: "esearch_user_sites"
};

function loadJSON(key, fallback){
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch { return fallback; }
}
function saveJSON(key, val){
  localStorage.setItem(key, JSON.stringify(val));
}

export function addQueryHistory(q){
  const term = (q || "").trim();
  if (!term) return;
  const list = loadJSON(STORAGE_KEYS.queries, []);
  list.unshift({ term, ts: Date.now() });
  // حذف تکرارهای پشت‌سرهم
  for (let i = 1; i < list.length; i++){
    if (list[i].term === term){ list.splice(i,1); i--; }
  }
  saveJSON(STORAGE_KEYS.queries, list.slice(0, 500));
}
export function getQueryHistory(){ return loadJSON(STORAGE_KEYS.queries, []); }
export function clearQueryHistory(){ saveJSON(STORAGE_KEYS.queries, []); }

export function addVisitHistory(url, title=""){
  const list = loadJSON(STORAGE_KEYS.visits, []);
  list.unshift({ url, title, ts: Date.now() });
  saveJSON(STORAGE_KEYS.visits, list.slice(0, 1000));
}
export function getVisitHistory(){ return loadJSON(STORAGE_KEYS.visits, []); }
export function clearVisitHistory(){ saveJSON(STORAGE_KEYS.visits, []); }

export function getUserSites(){ return loadJSON(STORAGE_KEYS.userSites, []); }
export function addUserSite(item){
  const list = getUserSites();
  // حذف قبلی با همان URL
  const url = item.url;
  const idx = list.findIndex(x => x.url === url);
  if (idx >= 0) list.splice(idx,1);
  list.unshift(item);
  saveJSON(STORAGE_KEYS.userSites, list);
}
export function removeUserSite(url){
  const list = getUserSites().filter(x => x.url !== url);
  saveJSON(STORAGE_KEYS.userSites, list);
}