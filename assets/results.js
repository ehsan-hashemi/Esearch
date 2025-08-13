import { searchIndex, highlight, getDomain } from "./utils.js";

(async function(){
  const params = new URLSearchParams(location.search);
  const q = params.get("q")?.trim() || "";
  const lucky = params.get("lucky") === "1";

  const input = document.querySelector('input[name="q"]');
  if (input) input.value = q;

  // داده‌ها را بگیر
  let items = [];
  try {
    const res = await fetch("data/sites.json", { cache: "no-store" });
    items = await res.json();
  } catch (e) {
    console.error("خطا در بارگذاری داده‌ها", e);
  }

  const { results, timeMs } = searchIndex(q, items);

  if (lucky && results.length) {
    location.href = results[0].item.url;
    return;
  }

  // متا
  const meta = document.getElementById("meta");
  meta.textContent = q ? `${results.length} نتیجه در حدود ${timeMs.toFixed(1)} میلی‌ثانیه` : "";

  // رندر
  const container = document.getElementById("results");
  container.innerHTML = "";

  if (!q) {
    container.innerHTML = `<p class="hint">عبارت جستجو خالی است.</p>`;
    return;
  }
  if (!results.length) {
    container.innerHTML = `<p class="hint">نتیجه‌ای پیدا نشد. کلیدواژه‌های بیشتری به داده‌ها اضافه کن.</p>`;
    return;
  }

  const qTokens = q.split(/\s+/).filter(Boolean);

  for (const { item } of results) {
    const el = document.createElement("article");
    el.className = "result";

    const domain = getDomain(item.url);

    const crumb = document.createElement("div");
    crumb.className = "crumb";
    crumb.textContent = `${domain}${pathFromUrl(item.url)}`;
    el.appendChild(crumb);

    const h3 = document.createElement("h3");
    const a = document.createElement("a");
    a.href = item.url;
    a.innerHTML = highlight(item.title, qTokens);
    h3.appendChild(a);
    el.appendChild(h3);

    const p = document.createElement("p");
    p.innerHTML = highlight(item.description || "", qTokens);
    el.appendChild(p);

    container.appendChild(el);
  }
})();

function pathFromUrl(u){
  try {
    const url = new URL(u);
    return url.pathname.replace(/\/$/, "") + (url.search || "");
  } catch {
    return "";
  }
}