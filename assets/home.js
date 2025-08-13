import { addQueryHistory, addUserSite } from "./utils.js";

// ثبت عبارت جستجو در هنگام ارسال فرم
const form = document.getElementById("homeForm");
form?.addEventListener("submit", (e) => {
  const data = new FormData(form);
  const q = (data.get("q") || "").toString();
  if (q.trim()) addQueryHistory(q);
});

// مدیریت دیالوگ افزودن سایت
const dlg = document.getElementById("addSiteDialog");
const openBtn = document.getElementById("addSiteBtn");
const closeBtn = document.getElementById("closeAddSite");
const addSiteForm = document.getElementById("addSiteForm");

openBtn?.addEventListener("click", () => dlg.showModal());
closeBtn?.addEventListener("click", () => dlg.close());

addSiteForm?.addEventListener("submit", (e) => {
  e.preventDefault();
  const fd = new FormData(addSiteForm);
  const item = {
    title: (fd.get("title") || "").toString().trim(),
    url: (fd.get("url") || "").toString().trim(),
    description: (fd.get("description") || "").toString().trim(),
    tags: splitCsv(fd.get("tags")),
    keywords: splitCsv(fd.get("keywords")),
    rank: parseInt((fd.get("rank") || "").toString().trim(), 10) || undefined
  };
  if (!item.title || !item.url){ return; }
  addUserSite(item);
  addSiteForm.reset();
  dlg.close();
  alert("سایت با موفقیت ذخیره شد و در نتایج جستجو لحاظ می‌شود.");
});

function splitCsv(val){
  const s = (val || "").toString();
  return s.split(/[,\u060C]/).map(x => x.trim()).filter(Boolean);
}