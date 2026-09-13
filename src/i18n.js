// ---------------------------------------------------------------------------
// App text in English plus the 22 languages of the Eighth Schedule of India's
// Constitution. English ships with the app; the others load when picked.
// ---------------------------------------------------------------------------
import { createContext, useContext } from "react";
import en from "./locales/en";

export const LANGUAGES = [
  { code: "en", name: "English", native: "English" },
  { code: "as", name: "Assamese", native: "অসমীয়া" },
  { code: "bn", name: "Bengali", native: "বাংলা" },
  { code: "brx", name: "Bodo", native: "बड़ो" },
  { code: "doi", name: "Dogri", native: "डोगरी" },
  { code: "gu", name: "Gujarati", native: "ગુજરાતી" },
  { code: "hi", name: "Hindi", native: "हिन्दी" },
  { code: "kn", name: "Kannada", native: "ಕನ್ನಡ" },
  { code: "ks", name: "Kashmiri", native: "کٲشُر", dir: "rtl" },
  { code: "kok", name: "Konkani", native: "कोंकणी" },
  { code: "mai", name: "Maithili", native: "मैथिली" },
  { code: "ml", name: "Malayalam", native: "മലയാളം" },
  { code: "mni", name: "Manipuri", native: "ꯃꯩꯇꯩꯂꯣꯟ" },
  { code: "mr", name: "Marathi", native: "मराठी" },
  { code: "ne", name: "Nepali", native: "नेपाली" },
  { code: "or", name: "Odia", native: "ଓଡ଼ିଆ" },
  { code: "pa", name: "Punjabi", native: "ਪੰਜਾਬੀ" },
  { code: "sa", name: "Sanskrit", native: "संस्कृतम्" },
  { code: "sat", name: "Santali", native: "ᱥᱟᱱᱛᱟᱲᱤ" },
  { code: "sd", name: "Sindhi", native: "سنڌي", dir: "rtl" },
  { code: "ta", name: "Tamil", native: "தமிழ்" },
  { code: "te", name: "Telugu", native: "తెలుగు" },
  { code: "ur", name: "Urdu", native: "اردو", dir: "rtl" },
];

export function languageLabel(l) {
  return l.native === l.name ? l.name : `${l.native} — ${l.name}`;
}

export function textDirection(code) {
  return LANGUAGES.find((l) => l.code === code)?.dir ?? "ltr";
}

const loaders = import.meta.glob(["./locales/*.js", "!./locales/en.js"], { import: "default" });

// A language without a file yet shows English.
export function loadMessages(code) {
  const load = loaders[`./locales/${code}.js`];
  return load ? load() : Promise.resolve(en);
}

// Missing keys fall back to English. {name} placeholders are filled from vars.
export function translate(messages, key, vars) {
  const text = messages[key] ?? en[key] ?? key;
  return vars ? text.replace(/\{(\w+)\}/g, (match, name) => (name in vars ? vars[name] : match)) : text;
}

const TContext = createContext((key, vars) => translate(en, key, vars));
export const TProvider = TContext.Provider;
export const useT = () => useContext(TContext);
