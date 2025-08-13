import {
  getQueryHistory, clearQueryHistory,
  getVisitHistory, clearVisitHistory
} from "./utils.js";

const qList = document.getElementById("queryList");
const vList = document.getElementById("visitList");

renderQueries();
renderVisits();

document.getElementById("clearQueries")?.addEventListener("click", () => {
  if (confirm("همه جستجوها حذف شود؟")) {
    clearQueryHistory(); renderQueries();
  }
});
document.getElementById("clearVisits")?.addEventListener("click", () => {
  if (confirm("همه بازدیدها حذف شود؟")) {
    clearVisitHistory(); renderVisits();
  }
});

function renderQueries(){
  const data = getQueryHistory();
  qList.innerHTML = "";
  if (!data.length){
    qList.innerHTML = `<li><div class="item-main"><div>هیچ جستجویی ثبت نشده است.</div></div></li>`;
    return;
  }
  data.forEach((it, idx) => {
    const li = document.createElement("li");
    const main = document.createElement("div");
    main.className = "item-main";
    const title = document.createElement("div");
    title.innerHTML = `<a href="results.html?q=${encodeURIComponent(it.term)}">${escapeHtml(it.term)}</a>`;
    const sub = document.createElement("div");
    sub.className = "item-sub";
    sub.textContent = new Date(it.ts).toLocaleString();
    main.appendChild(title); main.appendChild(sub);

    const actions = document.createElement("div");
    actions.className = "item-actions";
    const del = document.createElement("button");
    del.className = "kbd-btn secondary";
    del.textContent = "حذف";
    del.addEventListener("click", () => {
      // حذف تکی
      const arr = getQueryHistory().filter((x, i) => i !== idx);
      localStorage.setItem("esearch_queries", JSON.stringify(arr));
      renderQueries();
    });
    actions.appendChild(del);

    li.appendChild(main);
    li.appendChild(actions);
    qList.appendChild(li);
  });
}

function renderVisits(){
  const data = getVisitHistory();
  vList.innerHTML = "";
  if (!data.length){
    vList.innerHTML = `<li><div class="item-main"><div>هنوز بازدیدی ثبت نشده است.</div></div></li>`;
    return;
  }
  data.forEach((it) => {
    const li = document.createElement("li");
    const main = document.createElement("div");
    main.className = "item-main";
    const title = document.createElement("div");
    title.innerHTML = `<a href="${it.url}" target="_blank" rel="noopener">${escapeHtml(it.title || it.url)}</a>`;
    const sub = document.createElement("div");
    sub.className = "item-sub";
    sub.textContent = new Date(it.ts).toLocaleString();
    main.appendChild(title); main.appendChild(sub);
    li.appendChild(main);
    vList.appendChild(li);
  });
}

function escapeHtml(s){
  return (s || "").toString()
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#039;");
}