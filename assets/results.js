import {
  searchIndex, highlight, getDomain,
  addQueryHistory, addVisitHistory, getUserSites
} from "./utils.js";

/* ==== ترجمه (کارت سبک گوگل) ==== */
const LANGS = [
  { code: "fa", nameFa: "فارسی", nameEn: "Persian" },
  { code: "en", nameFa: "انگلیسی", nameEn: "English" },
  { code: "ar", nameFa: "عربی", nameEn: "Arabic" },
  { code: "tr", nameFa: "ترکی", nameEn: "Turkish" },
  { code: "de", nameFa: "آلمانی", nameEn: "German" },
  { code: "fr", nameFa: "فرانسوی", nameEn: "French" }
];

function isArabicScript(s){ return /[\u0600-\u06FF]/.test(s); }
function isLatinScript(s){ return /[A-Za-z]/.test(s); }
function nameToLangCode(s){
  const t = (s || "").toString().trim().toLowerCase();
  const map = {
    "فارسی":"fa","persian":"fa","farsi":"fa","fa":"fa",
    "انگلیسی":"en","english":"en","en":"en",
    "عربی":"ar","arabic":"ar","ar":"ar",
    "ترکی":"tr","turkish":"tr","tr":"tr",
    "آلمانی":"de","المانی":"de","german":"de","de":"de",
    "فرانسوی":"fr","french":"fr","fr":"fr"
  };
  return map[t];
}
function guessLangByScript(text){
  if (isArabicScript(text) && !isLatinScript(text)) return "fa";
  if (isLatinScript(text) && !isArabicScript(text)) return "en";
  return "fa";
}
function parseTranslateIntent(q){
  const s = (q || "").trim();
  let m = s.match(/^ترجمه\s+(.+?)\s+به\s+(\S+)$/i);
  if (m){
    const text = m[1].trim();
    const tgtCode = nameToLangCode(m[2]) || guessLangByScript(m[2]) || "en";
    const srcCode = guessLangByScript(text);
    return { text, source: srcCode, target: tgtCode, intent: true };
  }
  m = s.match(/^translate\s+(.+?)\s+to\s+(\S+)$/i);
  if (m){
    const text = m[1].trim();
    const tgtCode = nameToLangCode(m[2]) || guessLangByScript(m[2]) || "fa";
    const srcCode = guessLangByScript(text);
    return { text, source: srcCode, target: tgtCode, intent: true };
  }
  m = s.match(/^ترجمه\s+(.+)$/i);
  if (m){
    const text = m[1].trim();
    const srcCode = guessLangByScript(text);
    const tgtCode = srcCode === "fa" ? "en" : "fa";
    return { text, source: srcCode, target: tgtCode, intent: true };
  }
  m = s.match(/^معنی\s+(.+)$/i);
  if (m){
    const text = m[1].trim();
    const srcCode = guessLangByScript(text);
    const tgtCode = srcCode === "fa" ? "en" : "fa";
    return { text, source: srcCode, target: tgtCode, intent: true };
  }
  return { intent: false };
}
async function translateDirect(text, source, target){
  const apiUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${source}&tl=${target}&dt=t&q=${encodeURIComponent(text)}`;
  const res = await fetch(apiUrl);
  if (!res.ok) throw new Error("ترجمه در دسترس نیست");
  const data = await res.json();
  if (data && data[0]) return data[0].map(r => r[0]).join("");
  return "";
}
function renderTranslateCardRoot(){
  let host = document.getElementById("translateCard");
  if (!host) {
    host = document.createElement("div");
    host.id = "translateCard";
    const resultsContainer = document.getElementById("results");
    resultsContainer?.parentNode?.insertBefore(host, resultsContainer);
  }
  host.style.display = "block";
  host.style.maxWidth = "700px";
  host.style.width = "100%";
  host.style.margin = "1rem auto";
  host.innerHTML = `
    <div class="translate-head">
      <div class="lang-select">
        <span class="tlabel">از</span>
        <select id="srcLang"></select>
      </div>
      <button class="swap-btn" id="swapLang" title="تعویض">↔</button>
      <div class="lang-select">
        <span class="tlabel">به</span>
        <select id="tgtLang"></select>
      </div>
    </div>
    <div class="translate-body">
      <div>
        <div class="tlabel">متن</div>
        <div id="srcBox" class="tbox" contenteditable="true" dir="auto"></div>
      </div>
      <div>
        <div class="tlabel">ترجمه</div>
        <div id="tgtBox" class="tbox tresult" dir="auto"></div>
        <div class="tactions"><button class="icon-btn small" id="copyBtn">کپی</button></div>
      </div>
    </div>
  `;
  const fill = (selId) => {
    const sel = host.querySelector("#" + selId);
    sel.innerHTML = LANGS.map(l => `<option value="${l.code}">${l.nameFa}</option>`).join("");
  };
  fill("srcLang"); fill("tgtLang");
  return host;
}

/* ==== کارت نهاد/کسب‌وکار ==== */
function ensureTopCards() {
  let top = document.getElementById("topCards");
  if (!top) {
    top = document.createElement("div");
    top.id = "topCards";
    const resultsContainer = document.getElementById("results");
    resultsContainer?.parentNode?.insertBefore(top, resultsContainer);
  }
  return top;
}
const DAY_ORDER = ["sat","sun","mon","tue","wed","thu","fri"];
function jsDayToKey(d){ return ["sun","mon","tue","wed","thu","fri","sat"][d]; }
function parseTimeToMin(hhmm){
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m) return null;
  return parseInt(m[1],10)*60 + parseInt(m[2],10);
}
function expandHours(hours){
  const map = {};
  if (!hours || typeof hours !== "object") return map;
  for (const k of Object.keys(hours)){
    const v = (hours[k] || "").toString().toLowerCase();
    const parts = k.toLowerCase().split(",");
    for (let part of parts){
      part = part.trim();
      if (!part) continue;
      if (part.includes("-")){
        const [a,b] = part.split("-").map(s=>s.trim());
        const ia = DAY_ORDER.indexOf(a), ib = DAY_ORDER.indexOf(b);
        if (ia>=0 && ib>=0){
          let i = ia;
          while (true){
            map[DAY_ORDER[i]] = v;
            if (i === ib) break;
            i = (i+1) % DAY_ORDER.length;
          }
        }
      } else if (DAY_ORDER.includes(part)) {
        map[part] = v;
      }
    }
  }
  return map;
}
function computeOpenStatus(hours){
  const now = new Date();
  const dayKey = jsDayToKey(now.getDay());
  const hm = now.getHours()*60 + now.getMinutes();
  const hmap = expandHours(hours);
  const spec = (hmap[dayKey] || "").trim();
  if (!spec || /^(closed|تعطیل|بسته)$/i.test(spec)) return { open: false, text: "امروز تعطیل" };
  const ranges = spec.split(";").map(s=>s.trim()).filter(Boolean);
  let isOpen = false, nextChange = null;
  for (const r of ranges){
    const [a,b] = r.split("-").map(s=>s.trim());
    const start = parseTimeToMin(a), end = parseTimeToMin(b);
    if (start==null || end==null) continue;
    if (hm >= start && hm < end){ isOpen = true; nextChange = end; break; }
    if (!isOpen && hm < start){ if (nextChange==null || start < nextChange) nextChange = start; }
  }
  if (isOpen){ const h=Math.floor(nextChange/60), m=nextChange%60; return { open:true, text:`الان باز است تا ${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}` }; }
  if (nextChange!=null){ const h=Math.floor(nextChange/60), m=nextChange%60; return { open:false, text:`الان بسته است · بازگشایی ${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}` }; }
  return { open:false, text:"الان بسته است" };
}
const FA_DAYS = { sat:"شنبه", sun:"یکشنبه", mon:"دوشنبه", tue:"سه‌شنبه", wed:"چهارشنبه", thu:"پنجشنبه", fri:"جمعه" };
function renderEntityCard(entity){
  const top = ensureTopCards();
  const card = document.createElement("div");
  card.className = "card entity-card";
  const status = computeOpenStatus(entity.hours || {});
  const safe = (s) => (s || "").toString();

  // تعیین فقط امروز
  const todayKey = jsDayToKey(new Date().getDay());
  const todayHoursMap = expandHours(entity.hours || {});
  const todayHours = todayHoursMap[todayKey];
  let hoursLine = "";
  if (todayHours) {
    if (/^(closed|تعطیل|بسته)$/i.test(todayHours)) {
      hoursLine = `<div class="entity-row closed"><span class="lbl">وضعیت:</span> <span>تعطیل است</span></div>`;
    } else {
      hoursLine = `<div class="entity-row open"><span class="lbl">وضعیت:</span> <span>${todayHours}</span></div>`;
    }
  }

  card.innerHTML = `
    <div class="entity-header">
      <div class="entity-title">${safe(entity.title || entity.name || "")}</div>
      ${entity.url ? `<a class="entity-site" href="${entity.url}" target="_blank">وب‌سایت</a>` : ""}
    </div>
    <div class="entity-desc">${safe(entity.description || entity.snippet || "")}</div>
    <div class="entity-meta">
      ${entity.address ? `<div class="entity-row"><span class="lbl">آدرس:</span> ${safe(entity.address)}</div>` : ""}
      ${entity.phone ? `<div class="entity-row"><span class="lbl">تلفن:</span> <a href="tel:${safe(entity.phone)}">${safe(entity.phone)}</a></div>` : ""}
      ${hoursLine}
    </div>
  `;
  top.appendChild(card);
}
function findBestEntity(query, items){
  const q = (query || "").toString().trim().toLowerCase();
  if (!q) return null;
  const isEntityType = (t) => ["store","organization","company","business","place","person","about","service"].includes((t||"").toLowerCase());
  const candidates = items.filter(it => isEntityType(it.type));

  let best = null, bestScore = -1;
  for (const it of candidates){
    const title = ((it.title || it.name || "")+"").toLowerCase();
    const desc = ((it.description || it.snippet || "")+"").toLowerCase();
    let s = 0;
    if (!title) continue;
    if (q === title) s += 100;
    if (title.includes(q)) s += 60;
    if (q.includes(title)) s += 50;
    if (desc.includes(q)) s += 10;
    // بوست ساده روی واژه‌های رایج
    const boosts = ["گروه","برنامه","نویسی","فروشگاه","شرکت","درباره","about","store","shop","group","company"];
    boosts.forEach(b => { if (q.includes(b)) s += 2; });
    if (s > bestScore){ best = it; bestScore = s; }
  }
  return bestScore >= 50 ? best : null;
}

/* ==== کارت تقویم ==== */
function pad2(n){ return String(n).padStart(2,"0"); }
function formatWithCalendar(date, locale, calendar, opts={}){
  try{
    return new Intl.DateTimeFormat(`${locale}-u-ca-${calendar}`, { year:"numeric", month:"long", day:"numeric", weekday:"long", ...opts }).format(date);
  } catch { return "پشتیبانی نمی‌شود"; }
}
function renderCalendarCard(){
  const top = ensureTopCards();
  const card = document.createElement("div");
  card.className = "card calendar-card";

  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth()+1, d = now.getDate();
  const todayStr = `${y}-${pad2(m)}-${pad2(d)}`;
  const timeStr = now.toLocaleTimeString();

  card.innerHTML = `
    <div class="calendar-header"><div class="calendar-title">تقویم و تبدیل تاریخ</div></div>
    <div class="calendar-body">
      <div class="calendar-row">
        <label class="lbl">انتخاب تاریخ (میلادی):</label>
        <input id="calDate" type="date" value="${todayStr}" />
        <span class="time-now">${timeStr}</span>
      </div>
      <div class="calendar-row">
        <div class="cal-col"><div class="lbl">شمسی (جلالی):</div><div id="calJalali" class="cal-line">—</div></div>
        <div class="cal-col"><div class="lbl">قمری (هجری):</div><div id="calHijri" class="cal-line">—</div></div>
        <div class="cal-col"><div class="lbl">میلادی (Gregorian):</div><div id="calGreg" class="cal-line">—</div></div>
      </div>
    </div>
  `;
  top.appendChild(card);

  const calDate = card.querySelector("#calDate");
  const jalali = card.querySelector("#calJalali");
  const hijri  = card.querySelector("#calHijri");
  const greg   = card.querySelector("#calGreg");
  const timeNow= card.querySelector(".time-now");

  function updateAll(){
    const val = calDate.value;
    const dt = val ? new Date(val+"T00:00:00") : new Date();
    jalali.textContent = formatWithCalendar(dt, "fa-IR", "persian");
    hijri.textContent  = formatWithCalendar(dt, "ar-SA", "islamic-umalqura");
    greg.textContent   = new Intl.DateTimeFormat("en-GB", { weekday:"long", year:"numeric", month:"long", day:"numeric" }).format(dt);
  }
  function tickTime(){ timeNow.textContent = new Date().toLocaleTimeString(); }

  updateAll();
  setInterval(tickTime, 1000);
  calDate.addEventListener("change", updateAll);
}

/* ==== تحلیل هوشمند کوئری (Boost/Intent) ==== */
function analyzeQuery(q){
  const s = (q||"").toString().trim();
  const lower = s.toLowerCase();
  const intents = {
    wantsTranslate: /(^|[\s\-])(ترجمه|translate|meaning)([\s\-]|$)/i.test(s),
    wantsCalendar: /(^|[\s\-])(تقویم|calendar)([\s\-]|$)/i.test(s),
    aboutEntity: /^(درباره|about)\s+(.+)$/i.exec(s)
  };
  const keywords = s.split(/\s+/).filter(Boolean);
  const boosts = [];
  if (/فروشگاه|shop|store/i.test(s)) boosts.push("store");
  if (/گروه|group|شرکت|company/i.test(s)) boosts.push("organization","company","group");
  if (/آدرس|address|شماره|phone|ایمیل|email/i.test(s)) boosts.push("place","business");
  return { intents, keywords, boosts, raw: s, lower };
}

/* ==== کمک‌ها ==== */
function pathFromUrl(u){
  try{ const url = new URL(u); return url.pathname.replace(/\/$/, "") + (url.search || ""); }
  catch{ return ""; }
}
function isRelevantByTokens(item, tokens){
  if (!tokens.length) return true;
  const hay = ((item.title || "") + " " + (item.description || item.snippet || "") + " " + (item.url || "")).toLowerCase();
  return tokens.some(t => hay.includes(t.toLowerCase()));
}

/* ==== رتبه‌بندی بر اساس کلمات جستجو + rank ==== */
function relevanceScoreByTokens(item, tokens){
  const title = (item.title || "").toLowerCase();
  const desc  = (item.description || item.snippet || "").toLowerCase();
  const url   = (item.url || "").toLowerCase();
  let s = 0;
  for (const t of tokens){
    const tt = t.toLowerCase();
    if (title.includes(tt)) s += 10;
    if (desc.includes(tt))  s += 6;
    if (url.includes(tt))   s += 3;
  }
  // اگر rank عدد کوچکتری باشد، بالاتر بیاید
  if (typeof item.rank === "number") s -= item.rank;
  return s;
}

(async function(){
  const params = new URLSearchParams(location.search);
  const q = params.get("q")?.trim() || "";
  const lucky = params.get("lucky") === "1";

  const input = document.querySelector('input[name="q"]');
  if (input) input.value = q;

  if (q) addQueryHistory(q);
  const intent = parseTranslateIntent(q);
  const analysis = analyzeQuery(q);

  // نمایش کارت ترجمه اگر نیت یا کلمه «ترجمه» باشد
  if (intent.intent || analysis.intents.wantsTranslate) {
    const host = renderTranslateCardRoot();
    if (host) {
      const srcSel = host.querySelector("#srcLang");
      const tgtSel = host.querySelector("#tgtLang");
      const srcBox = host.querySelector("#srcBox");
      const tgtBox = host.querySelector("#tgtBox");
      const swapBtn = host.querySelector("#swapLang");
      const copyBtn = host.querySelector("#copyBtn");

      if (intent.intent) {
        srcSel.value = intent.source || guessLangByScript(intent.text || "");
        tgtSel.value = intent.target || (srcSel.value === "fa" ? "en" : "fa");
        srcBox.textContent = intent.text || "";
      } else {
        srcSel.value = "fa";
        tgtSel.value = "en";
        srcBox.textContent = "";
      }

      async function doTranslate(){
        const text = (srcBox.textContent || "").trim();
        if (!text) { tgtBox.textContent = ""; return; }
        tgtBox.textContent = "در حال ترجمه...";
        try {
          const out = await translateDirect(text, srcSel.value, tgtSel.value);
          tgtBox.textContent = out || "—";
          tgtBox.setAttribute("dir", isArabicScript(out) ? "rtl" : "ltr");
        } catch { tgtBox.textContent = "خطا در ترجمه"; }
      }

      srcSel.addEventListener("change", doTranslate);
      tgtSel.addEventListener("change", doTranslate);
      srcBox.addEventListener("input", () => {
        clearTimeout(srcBox._t);
        srcBox._t = setTimeout(doTranslate, 350);
      });
      swapBtn.addEventListener("click", () => {
        const tmp = srcSel.value;
        srcSel.value = tgtSel.value;
        tgtSel.value = tmp;
        const t = srcBox.textContent;
        srcBox.textContent = tgtBox.textContent || t;
        doTranslate();
      });
      copyBtn.addEventListener("click", async () => {
        try { await navigator.clipboard.writeText(tgtBox.textContent || ""); } catch {}
        copyBtn.textContent = "کپی شد";
        setTimeout(() => copyBtn.textContent = "کپی", 1200);
      });

      if (srcBox.textContent.trim()) doTranslate();
    }
  }

  // کارت تقویم
  if (analysis.intents.wantsCalendar) {
    renderCalendarCard();
  }

  // بارگذاری داده‌ها (مسیر ریشه یا data/)
  let items = [];
  try {
    const res = await fetch("sites.json", { cache: "no-store" });
    if (res.ok) items = await res.json();
    else throw new Error("sites.json not ok");
  } catch (e1) {
    try {
      const res2 = await fetch("data/sites.json", { cache: "no-store" });
      if (res2.ok) items = await res2.json();
      else throw new Error("data/sites.json not ok");
    } catch (e2) {
      console.warn("خطا در بارگذاری داده‌ها", e1, e2);
    }
  }

  // ادغام با سایت‌های کاربر
  const userSites = getUserSites();
  const allItems = [...userSites, ...items];

  // کارت دانش (entity) روی داده‌های موجود
  const entity = findBestEntity(q, allItems);
  if (entity) renderEntityCard(entity);

  // اگر عبارت جستجو خالی است، پیام بده و برگرد
  const container = document.getElementById("results");
  const meta = document.getElementById("meta");
  const countBox = document.getElementById("count");
  if (!q) {
    if (meta) meta.textContent = "";
    if (countBox) countBox.textContent = "";
    container.innerHTML = `<p class="hint">عبارت جستجو خالی است.</p>`;
    return;
  }

  // جستجو
  const { results, timeMs } = searchIndex(q, allItems);

  // احساس خوش‌شانسی
  if (lucky && results && results.length) {
    const url = results[0].item.url;
    addVisitHistory(url, results[0].item.title || "");
    location.href = url;
    return;
  }

  // متا
  if (meta) meta.textContent = `${results.length} نتیجه در حدود ${timeMs?.toFixed ? timeMs.toFixed(1) : timeMs} میلی‌ثانیه`;
  if (countBox) countBox.textContent = `${results.length} نتیجه (${timeMs} میلی‌ثانیه)`;

  // امتیازدهی و مرتب‌سازی نتایج بر اساس توکن‌های کوئری + rank
  const qTokens = q.split(/\s+/).filter(Boolean);
  if (Array.isArray(results)) {
    results.sort((a, b) => {
      const ia = a.item || a, ib = b.item || b;
      return relevanceScoreByTokens(ib, qTokens) - relevanceScoreByTokens(ia, qTokens);
    });
  }

  // رندر نتایج (فقط موارد مرتبط واقعی، نه همه)
  container.innerHTML = "";

  let shown = 0;
  for (const r of (results || [])) {
    const it = r.item || r; // در صورت تفاوت ساختار
    // فقط وب‌سایت‌ها به‌عنوان نتیجه معمولی
    const type = (it.type || "website").toLowerCase();
    if (type !== "website") continue;

    // فیلتر ارتباط: باید حداقل یکی از توکن‌ها در عنوان/توضیح/URL باشد
    if (!isRelevantByTokens(it, qTokens)) continue;

    const el = document.createElement("article");
    el.className = "result";

    const domain = getDomain(it.url);
    const crumb = document.createElement("div");
    crumb.className = "crumb";
    crumb.textContent = `${domain}${pathFromUrl(it.url)}`;
    el.appendChild(crumb);

    const h3 = document.createElement("h3");
    const a = document.createElement("a");
    a.href = it.url;
    // عنوان بدون هایلایت (فقط توضیحات هایلایت شود)
    a.textContent = it.title || it.url;
    a.addEventListener("click", () => addVisitHistory(it.url, it.title || ""));
    h3.appendChild(a);
    el.appendChild(h3);

    const p = document.createElement("p");
    // توضیحات با هایلایت
    p.innerHTML = highlight(it.description || it.snippet || "", qTokens);
    el.appendChild(p);

    container.appendChild(el);
    shown++;
  }

  if (!shown) {
    container.innerHTML = `<p class="hint">نتیجه‌ای پیدا نشد. کلیدواژه‌ها را دقیق‌تر وارد کن یا داده‌های بیشتری اضافه کن.</p>`;
  }

  // ثبت جستجو از فرم بالای نتایج (اگر وجود دارد)
  const form = document.getElementById("resultsForm");
  form?.addEventListener("submit", (e) => {
    const data = new FormData(form);
    const term = (data.get("q") || "").toString();
    if (term.trim()) addQueryHistory(term);
  });
})();