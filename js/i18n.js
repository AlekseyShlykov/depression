// Simple i18n loader: every UI string lives in /locales/<lang>.json.

const SUPPORTED = ["en", "ru"];
const DEFAULT_LANG = "en";
const STORAGE_KEY = "earthling.lang";

let _strings = null;
let _lang = DEFAULT_LANG;

export function getSupportedLangs() {
  return [...SUPPORTED];
}

export function getCurrentLang() {
  return _lang;
}

export function getStoredLang() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v && SUPPORTED.includes(v)) return v;
  } catch (_) {
    /* ignore */
  }
  return null;
}

function storeLang(lang) {
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch (_) {
    /* ignore */
  }
}

export async function loadLang(lang) {
  if (!SUPPORTED.includes(lang)) lang = DEFAULT_LANG;
  const res = await fetch(`locales/${lang}.json`, { cache: "no-cache" });
  if (!res.ok) throw new Error(`Failed to load locale ${lang}`);
  _strings = await res.json();
  _lang = lang;
  storeLang(lang);
  document.documentElement.setAttribute("lang", lang);
  return _strings;
}

export function t(path, fallback = "") {
  if (!_strings) return fallback;
  const parts = path.split(".");
  let cur = _strings;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return fallback;
    cur = cur[p];
  }
  return cur ?? fallback;
}

export function otherLang() {
  return _lang === "en" ? "ru" : "en";
}
