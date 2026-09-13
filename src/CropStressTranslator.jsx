import React, { useState, useRef, useEffect, useMemo, useId } from "react";
import {
  Leaf, Upload, Thermometer, Droplets, CloudRain, Sprout,
  Home, History, ChevronRight, ChevronDown, TrendingUp, TrendingDown,
  AlertTriangle, Lightbulb, Image as ImageIcon, X, Cpu, CheckCircle2,
  MapPin, LocateFixed, LogOut, User, Lock, Languages, CloudSun, Sun, Cloud,
  CloudFog, CloudDrizzle, CloudSnow, CloudLightning, RefreshCw, LoaderCircle,
  Video, VideoOff, SwitchCamera, RotateCcw, Camera, Check, Sunrise, Sunset,
  UserRound, Phone, Tractor, Ruler, Settings, Trash2, Search,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine,
} from "recharts";
import { searchPlaces, resolvePlace, loadClimate, PlaceNotFoundError } from "./climate";
import {
  MAX_CLIP_MS, recordingSupport, openCamera, hasMultipleCameras, pickRecorderType,
  cameraErrorKey, captureFrame, formatClipTime,
} from "./camera";
import { LANGUAGES, languageLabel, textDirection, loadMessages, translate, TProvider, useT } from "./i18n";
import en from "./locales/en";

// ---------------------------------------------------------------------------
// Design tokens
// ---------------------------------------------------------------------------
// Palette: colorhunt.co/palette/607456eee0ccba6a4c7b2525 — olive, cream, clay, maroon.
// Everything else is a tint or shade of those; ochre bridges olive and clay for "mild".
const COLORS = {
  accent: "#607456", // olive
  accentDeep: "#4b5c43",
  accentGlow: "#7c9170", // gradient highlights
  accentTint: "#e7eadd",
  accentInk: "#4b5c43", // olive text on accentTint
  onAccent: "#fff", // text and icons on olive and clay fills
  page: "#eee0cc", // cream
  inset: "#f7efe3", // cream tint: panels sunk into a card
  surface: "#fffaf3",
  warm: "#ba6a4c", // clay
  warmDeep: "#9a5436",
  warmTint: "#f6e6dc",
  danger: "#7b2525", // maroon
  dangerTint: "#f4e1dd",
  caution: "#86672b", // ochre
  cautionTint: "#f6ecd9",
  ink: "#2c2a26",
  inkSoft: "#5f574b",
  line: "#e3d4bd",
  frame: "#1d1b18", // behind camera and video
  onFrame: "#f3ece1",
  rail: "#3a4833", // gradient ends and the desktop icon rail
};

// Depth: gradients and shadows mixed only from the palette above.
const GRADIENTS = {
  accent: `linear-gradient(135deg, ${COLORS.accentGlow} 0%, ${COLORS.accent} 45%, ${COLORS.accentDeep} 100%)`,
  hero: `linear-gradient(135deg, ${COLORS.accent} 0%, ${COLORS.accentDeep} 55%, ${COLORS.rail} 100%)`,
  // Dashboard cards: a faint olive glow rising from the bottom
  glow: `radial-gradient(90% 80% at 50% 100%, rgba(96,116,86,0.08), transparent 70%), ${COLORS.surface}`,
  rail: `linear-gradient(180deg, ${COLORS.accentDeep} 0%, ${COLORS.rail} 100%)`,
  warm: `linear-gradient(135deg, #cf8264 0%, ${COLORS.warm} 50%, ${COLORS.warmDeep} 100%)`,
  strip: `linear-gradient(90deg, ${COLORS.accent}, ${COLORS.caution}, ${COLORS.warm}, ${COLORS.danger})`,
  page: `radial-gradient(900px 520px at 100% 0%, rgba(186,106,76,0.16), transparent 65%), radial-gradient(800px 600px at 0% 100%, rgba(96,116,86,0.2), transparent 65%), ${COLORS.page}`,
};

const SHADOWS = {
  card: "0 1px 2px rgba(44,42,38,0.05), 0 12px 28px -16px rgba(44,42,38,0.28)",
  raised: "0 2px 4px rgba(44,42,38,0.06), 0 22px 44px -22px rgba(44,42,38,0.45)",
  accent: "0 10px 22px -10px rgba(75,92,67,0.75)",
  warm: "0 10px 22px -10px rgba(154,84,54,0.7)",
};

// Common Indian crops, grouped for the dropdown; local names in brackets.
const CROP_GROUPS = [
  { label: "Cereals & millets", crops: ["Rice (Paddy)", "Wheat", "Maize (Corn)", "Sorghum (Jowar)", "Pearl millet (Bajra)", "Finger millet (Ragi)", "Barley"] },
  { label: "Pulses", crops: ["Chickpea (Chana)", "Pigeon pea (Tur/Arhar)", "Green gram (Moong)", "Black gram (Urad)", "Lentil (Masoor)", "Field pea (Matar)"] },
  { label: "Oilseeds", crops: ["Groundnut", "Soybean", "Mustard (Sarson)", "Sunflower", "Sesame (Til)", "Castor"] },
  { label: "Cash crops", crops: ["Cotton", "Sugarcane", "Jute", "Tobacco"] },
  { label: "Vegetables", crops: ["Tomato", "Potato", "Onion", "Brinjal", "Okra (Bhindi)", "Cauliflower", "Cabbage", "Chilli", "Garlic"] },
  { label: "Fruits", crops: ["Grape", "Mango", "Banana", "Pomegranate", "Orange", "Papaya", "Guava", "Apple"] },
  { label: "Spices & plantation", crops: ["Turmeric", "Ginger", "Cardamom", "Black pepper", "Tea", "Coffee", "Coconut", "Arecanut", "Rubber"] },
];
const GROWTH_STAGES = ["Seedling", "Vegetative", "Flowering", "Fruiting", "Maturity"];

const EMPTY_FORM = {
  temperature: "",
  humidity: "",
  rainfall: "",
  cropType: "Grape",
  growthStage: GROWTH_STAGES[1],
};

const HISTORY = [
  { day: 1, value: 12 },
  { day: 2, value: 19 },
  { day: 3, value: 31 },
  { day: 4, value: 48 },
  { day: 5, value: 72 },
];

function statusForProb(p) {
  if (p < 25) return { key: "normal", emoji: "🟢", color: COLORS.accent, soft: COLORS.accentTint };
  if (p < 50) return { key: "mild", emoji: "🟡", color: COLORS.caution, soft: COLORS.cautionTint };
  if (p < 75) return { key: "moderate", emoji: "🟠", color: COLORS.warmDeep, soft: COLORS.warmTint };
  return { key: "severe", emoji: "🔴", color: COLORS.danger, soft: COLORS.dangerTint };
}

// Deterministic-ish pseudo model: turns form inputs into stress read-out.
function runModel({ temperature, humidity, rainfall, cropType, growthStage }) {
  const t = Number(temperature) || 24;
  const h = Number(humidity) || 50;
  const r = Number(rainfall) || 5;

  const water = clamp(Math.round(60 + (t - 24) * 2.2 - (r - 5) * 3 - (h - 50) * 0.4 + hash(cropType) % 10));
  const nutrient = clamp(Math.round(30 + hash(growthStage) % 30 + (h < 35 ? 15 : 0)));
  const disease = clamp(Math.round(15 + (h - 50) * 0.5 + (r > 20 ? 12 : 0) + hash(cropType + growthStage) % 8));

  const overall = clamp(Math.round(water * 0.5 + nutrient * 0.3 + disease * 0.2));
  const dominant = [
    { key: "water", value: water },
    { key: "nutrient", value: nutrient },
    { key: "disease", value: disease },
  ].sort((a, b) => b.value - a.value)[0].key;

  return { water, nutrient, disease, overall, status: statusForProb(overall), dominant, temperature: t, rainfall: r };
}

// Plain-language read-out of a model result, in the chosen language. Built at render
// time so switching language re-words a result that's already on screen.
function describeResult({ status, dominant, temperature, rainfall }, t) {
  if (status.key === "normal") {
    return {
      headline: t("result.none"),
      translation: t("explain.normal"),
      recommendation: t(`advice.${dominant}`, { when: t("when.mild") }),
    };
  }
  const stress = t(`stress.${dominant}`);
  return {
    headline: t("result.headline", { level: t(`level.${status.key}`), stress }),
    translation: t("explain.stress", {
      stress, temp: temperature, rain: rainfall, watch: t(`watch.${dominant}`),
      window: t(status.key === "severe" ? "window.soon" : "window.later"),
    }),
    recommendation: t(`advice.${dominant}`, { when: t(`when.${status.key}`) }),
  };
}

function clamp(n) { return Math.max(2, Math.min(98, n)); }
function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

// ---------------------------------------------------------------------------
// Session (name + location), remembered on this device
// ---------------------------------------------------------------------------
const SESSION_KEY = "cropStress.session";

function loadSession() {
  try {
    const saved = JSON.parse(localStorage.getItem(SESSION_KEY));
    return saved?.name && saved?.location?.name ? saved : null;
  } catch {
    return null;
  }
}

function saveSession(session) {
  try {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    // Storage blocked (e.g. private mode): the session just won't survive a reload.
  }
}

function placeLabel(place) {
  return place.region ? `${place.name}, ${place.region}` : place.name;
}

// Home starts on the farmer's main crop, when their profile names one.
function formFor(session) {
  return session?.mainCrop ? { ...EMPTY_FORM, cropType: session.mainCrop } : EMPTY_FORM;
}

// ---------------------------------------------------------------------------
// Chosen language (list and text live in i18n.js), kept on this device across logouts.
// ---------------------------------------------------------------------------
const LANGUAGE_KEY = "cropStress.language";

function loadLanguage() {
  try {
    const saved = localStorage.getItem(LANGUAGE_KEY);
    return LANGUAGES.some((l) => l.code === saved) ? saved : LANGUAGES[0].code;
  } catch {
    return LANGUAGES[0].code;
  }
}

function saveLanguage(code) {
  try {
    localStorage.setItem(LANGUAGE_KEY, code);
  } catch {
    // Storage blocked (e.g. private mode): the choice just won't survive a reload.
  }
}

function LanguageSelect({ value, onChange, ...props }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} {...props}>
      {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{languageLabel(l)}</option>)}
    </select>
  );
}

// ---------------------------------------------------------------------------
// Climate helpers
// ---------------------------------------------------------------------------
// Live readings go straight into the Home form's temperature and humidity.
function withClimate(form, reading) {
  return { ...form, temperature: String(reading.temperature), humidity: String(reading.humidity) };
}

// WMO weather codes, as returned by Open-Meteo. Labels are text keys; art is the WeatherArt picture.
function weatherLook(code) {
  if (code === 0) return { label: "weather.clear", icon: Sun, art: "clear" };
  if (code === 1) return { label: "weather.mainlyClear", icon: CloudSun, art: "partly" };
  if (code === 2) return { label: "weather.partlyCloudy", icon: CloudSun, art: "partly" };
  if (code === 3) return { label: "weather.overcast", icon: Cloud, art: "cloudy" };
  if (code <= 48) return { label: "weather.fog", icon: CloudFog, art: "fog" };
  if (code <= 57) return { label: "weather.drizzle", icon: CloudDrizzle, art: "rain" };
  if (code <= 67) return { label: "weather.rain", icon: CloudRain, art: "rain" };
  if (code <= 77) return { label: "weather.snow", icon: CloudSnow, art: "snow" };
  if (code <= 82) return { label: "weather.rainShowers", icon: CloudRain, art: "rain" };
  if (code <= 86) return { label: "weather.snowShowers", icon: CloudSnow, art: "snow" };
  return { label: "weather.thunderstorm", icon: CloudLightning, art: "storm" };
}

// Open-Meteo gives times local to the place with no offset; reading them as UTC
// keeps the viewer's own time zone from shifting them.
function placeDate(iso) {
  return new Date(iso.length === 10 ? `${iso}T00:00:00Z` : `${iso}:00Z`);
}

function formatPlaceTime(iso, language, options) {
  return new Intl.DateTimeFormat(language, { timeZone: "UTC", numberingSystem: "latn", ...options }).format(placeDate(iso));
}

// Clock time with AM/PM split off, so it can sit smaller beside the digits.
function clockParts(iso, language) {
  const parts = new Intl.DateTimeFormat(language, {
    timeZone: "UTC", numberingSystem: "latn", hour: "numeric", minute: "2-digit",
  }).formatToParts(placeDate(iso));
  return {
    time: parts.filter((p) => p.type !== "dayPeriod").map((p) => p.value).join("").trim(),
    period: parts.find((p) => p.type === "dayPeriod")?.value ?? "",
  };
}

function uvLevel(uv) {
  if (uv < 3) return { key: "uv.low", color: COLORS.accent };
  if (uv < 6) return { key: "uv.moderate", color: COLORS.caution };
  if (uv < 8) return { key: "uv.high", color: COLORS.warm };
  if (uv < 11) return { key: "uv.veryHigh", color: COLORS.danger };
  return { key: "uv.extreme", color: COLORS.danger };
}

// ---------------------------------------------------------------------------
// Weather pictures, drawn in SVG: sun or moon, cloud, then rain, snow, fog or lightning.
// Gradient ids are per instance, since several pictures share a page.
// ---------------------------------------------------------------------------
const CLOUD_PATH = "M30 86 C18 86 12 78 12 70 C12 61 19 54 28 54 C30 44 39 37 50 37 C60 37 68 43 71 51 C73 50 76 49 79 49 C90 49 98 57 98 67 C98 77 90 86 80 86 Z";
const DROP_PATH = "M30 4 C30 4 8 30 8 48 A22 22 0 0 0 52 48 C52 30 30 4 30 4 Z";
const SUN_RAYS = Array.from({ length: 12 }, (_, i) => i * 30);

function WeatherArt({ code, isDay = true, size = 120, label }) {
  const id = useId().replace(/:/g, "");
  const { art } = weatherLook(code);
  const clear = art === "clear";
  const heavy = art === "rain" || art === "snow" || art === "storm"; // greyer cloud
  // Sun or moon: centred when clear, peeking out behind the cloud otherwise
  const [cx, cy, r] = clear ? [60, 50, 25] : [76, 34, 17];
  const a11y = label ? { role: "img", "aria-label": label } : { "aria-hidden": true };

  return (
    <svg width={size} height={(size * 100) / 120} viewBox="0 0 120 100" {...a11y} style={{ display: "block", flexShrink: 0, overflow: "visible" }}>
      <defs>
        <radialGradient id={`${id}sun`} cx="40%" cy="38%" r="65%">
          <stop offset="0%" stopColor="#fff4b8" />
          <stop offset="45%" stopColor="#ffc53d" />
          <stop offset="100%" stopColor="#ff7b1c" />
        </radialGradient>
        <linearGradient id={`${id}ray`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffe066" />
          <stop offset="100%" stopColor="#ffa41b" />
        </linearGradient>
        <linearGradient id={`${id}moon`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fffbe8" />
          <stop offset="100%" stopColor="#d9cf9f" />
        </linearGradient>
        <linearGradient id={`${id}cloud`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={heavy ? "#e9eff5" : "#ffffff"} />
          <stop offset="55%" stopColor={heavy ? "#b7c7d8" : "#d9eeff"} />
          <stop offset="100%" stopColor={heavy ? "#8499ad" : "#9fd0ff"} />
        </linearGradient>
        <linearGradient id={`${id}back`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#c9d6e2" />
          <stop offset="100%" stopColor="#7f93a8" />
        </linearGradient>
        <linearGradient id={`${id}drop`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8fd8ff" />
          <stop offset="100%" stopColor="#2f8cff" />
        </linearGradient>
        <mask id={`${id}crescent`}>
          <rect width="120" height="100" fill="#fff" />
          <circle cx={cx + r * 0.55} cy={cy - r * 0.35} r={r * 0.9} fill="#000" />
        </mask>
      </defs>

      {(clear || art === "partly") && (isDay ? (
        <g>
          <circle cx={cx} cy={cy} r={r * 1.55} fill="#ffb347" opacity="0.16" />
          {SUN_RAYS.map((deg) => (
            <path
              key={deg}
              d={`M${cx - r * 0.16} ${cy - r * 1.12} L${cx} ${cy - r * 1.62} L${cx + r * 0.16} ${cy - r * 1.12}Z`}
              fill={`url(#${id}ray)`}
              transform={`rotate(${deg} ${cx} ${cy})`}
            />
          ))}
          <circle cx={cx} cy={cy} r={r} fill={`url(#${id}sun)`} />
        </g>
      ) : (
        <circle cx={cx} cy={cy} r={r} fill={`url(#${id}moon)`} mask={`url(#${id}crescent)`} />
      ))}

      {!clear && (
        <>
          {/* A second, greyer cloud behind, except when it's only partly cloudy */}
          {art !== "partly" && <path d={CLOUD_PATH} fill={`url(#${id}back)`} transform="translate(30 -16) scale(0.72)" opacity="0.9" />}
          <path d={CLOUD_PATH} fill={`url(#${id}cloud)`} stroke="#7fb6e6" strokeOpacity="0.55" strokeWidth="1.2" />
        </>
      )}

      {art === "rain" && [36, 52, 68].map((x, i) => (
        <ellipse key={x} cx={x} cy={i === 1 ? 94 : 91} rx="2.8" ry="4.6" fill={`url(#${id}drop)`} transform={`rotate(18 ${x} ${i === 1 ? 94 : 91})`} />
      ))}
      {art === "snow" && [36, 52, 68].map((x, i) => (
        <circle key={x} cx={x} cy={i === 1 ? 95 : 92} r="3" fill="#f4f9ff" stroke="#b9d7f2" strokeWidth="0.8" />
      ))}
      {art === "fog" && (
        <g fill="#c5d5e3">
          <rect x="22" y="89" width="66" height="4" rx="2" opacity="0.85" />
          <rect x="34" y="95.5" width="52" height="4" rx="2" opacity="0.6" />
        </g>
      )}
      {art === "storm" && (
        <path d="M60 74 L50 88 L57 88 L52 99 L68 83 L60 83 L65 74Z" fill="#ffd23f" stroke="#f59e0b" strokeWidth="1" strokeLinejoin="round" />
      )}
    </svg>
  );
}

// Droplet filled to the humidity level.
function HumidityDrop({ value, size = 58 }) {
  const id = useId().replace(/:/g, "");
  const top = 70 - (66 * value) / 100; // the drop spans y 4–70
  return (
    <svg width={size} height={(size * 76) / 60} viewBox="0 0 60 76" aria-hidden style={{ display: "block", margin: "0 auto" }}>
      <defs>
        <clipPath id={`${id}shape`}><path d={DROP_PATH} /></clipPath>
        <linearGradient id={`${id}water`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8fd8ff" />
          <stop offset="100%" stopColor="#2f8cff" />
        </linearGradient>
      </defs>
      <path d={DROP_PATH} fill="rgba(143,216,255,0.1)" />
      <rect x="0" y={top} width="60" height={76 - top} fill={`url(#${id}water)`} clipPath={`url(#${id}shape)`} />
      <path d={DROP_PATH} fill="none" stroke="#8fd8ff" strokeOpacity="0.7" strokeWidth="1.6" />
    </svg>
  );
}

function humidityKey(h) {
  if (h >= 80) return "humidity.veryHumid";
  if (h >= 60) return "humidity.humid";
  if (h >= 35) return "humidity.comfortable";
  return "humidity.dry";
}

// Text key for one plain-language line on what today's climate means for crop stress.
function insightKey({ temperature, humidity, rainToday }) {
  if (temperature >= 35) return "insight.heat";
  if (temperature <= 10) return "insight.cold";
  if (humidity >= 80) return "insight.humid";
  if (humidity <= 35) return "insight.dry";
  if (rainToday >= 20) return "insight.rain";
  return "insight.moderate";
}

// ---------------------------------------------------------------------------
// Small building blocks
// ---------------------------------------------------------------------------
function ProgressBar({ label, value, color }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7 }}>
        <span style={{ fontSize: 13.5, color: COLORS.ink, fontWeight: 550 }}>{label}</span>
        <span style={{ fontSize: 13.5, color: COLORS.ink, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{value}%</span>
      </div>
      <div style={{ height: 10, borderRadius: 999, background: COLORS.inset, boxShadow: `inset 0 0 0 1px ${COLORS.line}`, overflow: "hidden" }}>
        <div
          className="bar-fill"
          style={{
            height: "100%",
            width: `${value}%`,
            background: `linear-gradient(90deg, ${color}99, ${color})`,
            borderRadius: 999,
            transition: "width 700ms cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        />
      </div>
    </div>
  );
}

// Ring showing the overall stress probability.
function Gauge({ value, color }) {
  const r = 30;
  const circumference = 2 * Math.PI * r;
  return (
    <div style={{ position: "relative", width: 78, height: 78, flexShrink: 0 }}>
      <svg width="78" height="78" viewBox="0 0 78 78" aria-hidden style={{ transform: "rotate(-90deg)" }}>
        <circle cx="39" cy="39" r={r} fill="none" stroke={`${color}24`} strokeWidth="8" />
        <circle
          className="gauge-arc"
          cx="39" cy="39" r={r} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={circumference * (1 - value / 100)}
          style={{ "--gauge-empty": `${circumference}px` }}
        />
      </svg>
      <span style={{
        position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 18, fontWeight: 750, color: COLORS.ink, fontVariantNumeric: "tabular-nums",
      }}>
        {value}%
      </span>
    </div>
  );
}

function FieldLabel({ icon: Icon, htmlFor, children }) {
  return (
    <label htmlFor={htmlFor} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13.5, color: COLORS.inkSoft, marginBottom: 6, fontWeight: 500 }}>
      <Icon size={14} strokeWidth={2} color={COLORS.accent} />
      {children}
    </label>
  );
}

// Grouped crop choices for a <select>. Values stay English: the model reads them whatever the language.
function CropOptions() {
  const t = useT();
  return CROP_GROUPS.map((g) => (
    <optgroup key={g.label} label={t(`cropGroup.${g.label}`)}>
      {g.crops.map((c) => <option key={c} value={c}>{t(`crop.${c}`)}</option>)}
    </optgroup>
  ));
}

// Icon on a tinted (or solid gradient) tile. Spans only: this also renders inside buttons.
const TONES = {
  accent: { color: COLORS.accent, tint: COLORS.accentTint, fill: GRADIENTS.accent, glow: SHADOWS.accent },
  warm: { color: COLORS.warm, tint: COLORS.warmTint, fill: GRADIENTS.warm, glow: SHADOWS.warm },
  caution: { color: COLORS.caution, tint: COLORS.cautionTint },
};

function IconBadge({ icon: Icon, tone = "accent", solid = false, size = 30 }) {
  const { color, tint, fill, glow } = TONES[tone];
  return (
    <span style={{
      width: size, height: size, borderRadius: Math.round(size * 0.32), flexShrink: 0,
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      background: solid ? fill : tint, boxShadow: solid ? glow : "none",
    }}>
      <Icon size={Math.round(size * 0.5)} color={solid ? COLORS.onAccent : color} strokeWidth={2.1} />
    </span>
  );
}

function PageHeader({ icon, title, intro }) {
  return (
    <header style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
      <IconBadge icon={icon} solid size={42} />
      <div style={{ minWidth: 0 }}>
        <h1 style={{ fontSize: 20, fontWeight: 720, color: COLORS.ink, margin: 0, letterSpacing: "-0.015em" }}>{title}</h1>
        {intro && <p style={{ fontSize: 13, color: COLORS.inkSoft, margin: "3px 0 0", lineHeight: 1.5 }}>{intro}</p>}
      </div>
    </header>
  );
}

// Clay call-out for advice.
function TipBox({ title, children }) {
  return (
    <div style={{
      background: `linear-gradient(135deg, ${COLORS.warmTint} 0%, #fbf3ec 100%)`, border: `1px solid ${COLORS.warm}40`,
      borderRadius: 14, padding: "14px 16px", display: "flex", alignItems: "flex-start", gap: 12,
    }}>
      <IconBadge icon={Lightbulb} tone="warm" solid size={32} />
      <div style={{ minWidth: 0, paddingTop: title ? 0 : 5 }}>
        {title && <div style={{ fontSize: 12.5, fontWeight: 700, color: COLORS.warmDeep, marginBottom: 3 }}>{title}</div>}
        <p style={{ fontSize: 13.5, color: "#5b3625", lineHeight: 1.55, margin: 0 }}>{children}</p>
      </div>
    </div>
  );
}

// Maroon error line in a form.
function FormAlert({ style, children }) {
  return (
    <div role="alert" style={{
      display: "flex", alignItems: "flex-start", gap: 8, background: COLORS.dangerTint, color: COLORS.danger,
      borderRadius: 8, padding: "9px 12px", fontSize: 13, marginBottom: 14, ...style,
    }}>
      <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
      {children}
    </div>
  );
}

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "11px 13px",
  borderRadius: 10,
  border: `1px solid ${COLORS.line}`,
  fontSize: 15,
  color: COLORS.ink,
  background: "#fff",
  outline: "none",
  fontFamily: "inherit",
};

const cardStyle = {
  background: COLORS.surface, border: `1px solid ${COLORS.line}`, borderRadius: 16, padding: 18,
  boxShadow: SHADOWS.card,
};

const pageStyle = { maxWidth: 640, margin: "0 auto" };

const linkButtonStyle = {
  display: "inline-flex", alignItems: "center", gap: 5, background: "none", border: "none", padding: 0,
  color: COLORS.accent, fontSize: 12.5, fontWeight: 650, cursor: "pointer",
};

const smallButtonStyle = {
  display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 9,
  border: `1px solid ${COLORS.line}`, background: "#fff", color: COLORS.ink,
  fontSize: 13, fontWeight: 600, cursor: "pointer", flexShrink: 0,
};

const smallPrimaryStyle = {
  ...smallButtonStyle, border: `1px solid ${COLORS.accentDeep}`, background: GRADIENTS.accent, color: COLORS.onAccent,
  boxShadow: "0 6px 14px -8px rgba(75,92,67,0.8)",
};

const iconButtonStyle = {
  width: 32, height: 32, borderRadius: 9, border: `1px solid ${COLORS.line}`, background: "#fff",
  display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
  color: COLORS.inkSoft, flexShrink: 0,
};

// On the olive hero banner.
const heroChipStyle = {
  display: "inline-flex", alignItems: "center", gap: 7, maxWidth: "100%", padding: "6px 12px", borderRadius: 999,
  background: "rgba(255,255,255,0.14)", border: "1px solid rgba(255,255,255,0.22)", color: "#fff",
  fontSize: 12.5, fontWeight: 600, cursor: "pointer",
};

function PrimaryButton({ onClick, disabled, type = "button", children }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="lift"
      style={{
        width: "100%",
        padding: "15px 0",
        borderRadius: 13,
        border: "none",
        background: disabled ? COLORS.accentDeep : GRADIENTS.accent,
        color: COLORS.onAccent,
        fontSize: 15.5,
        fontWeight: 650,
        letterSpacing: "0.01em",
        cursor: disabled ? "default" : "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 9,
        boxShadow: `${SHADOWS.accent}, inset 0 1px 0 rgba(255,255,255,0.18)`,
      }}
    >
      {children}
    </button>
  );
}

function AnalyzeButton({ loading, onClick }) {
  const t = useT();
  return (
    <PrimaryButton onClick={onClick} disabled={loading}>
      {loading ? (
        <>
          <Cpu size={17} className="spin" />
          {t("home.analyzing")}
        </>
      ) : (
        <>{t("home.analyze")}<ChevronRight size={17} /></>
      )}
    </PrimaryButton>
  );
}

// ---------------------------------------------------------------------------
// Location search: type a place (with suggestions) or use the device's GPS.
// `value` is { query, place } — place is set once a real location is chosen.
// The "search" variant is the top bar's pill, with GPS as a button inside it.
// ---------------------------------------------------------------------------
const placePanelStyle = {
  position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, zIndex: 30,
  background: COLORS.surface, border: `1px solid ${COLORS.line}`, borderRadius: 12, padding: 4,
  boxShadow: "0 12px 28px -12px rgba(44,42,38,0.28)", maxHeight: 250, overflowY: "auto",
};

const searchInputStyle = {
  width: "100%", height: 46, boxSizing: "border-box", borderRadius: 999, border: `1px solid ${COLORS.line}`,
  background: COLORS.surface, color: COLORS.ink, fontSize: 15, fontFamily: "inherit", outline: "none",
  paddingBlock: 0, paddingInlineStart: 44, paddingInlineEnd: 48,
};

const searchGpsStyle = {
  position: "absolute", insetInlineEnd: 7, top: "50%", transform: "translateY(-50%)",
  width: 32, height: 32, borderRadius: 999, border: "none", background: "transparent", color: COLORS.inkSoft,
  display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
};

function LocationPicker({ value, onChange, inputId, autoFocus, variant = "field", label }) {
  const t = useT();
  const search = variant === "search";
  const [found, setFound] = useState({ query: "", places: [], failed: false });
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const [gpsError, setGpsError] = useState("");

  const query = value.query.trim();
  const active = open && !value.place && query.length >= 2;

  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setSearching(true);
      searchPlaces(query, controller.signal)
        .then((places) => setFound({ query, places, failed: false }))
        .catch(() => {
          if (!controller.signal.aborted) setFound({ query, places: [], failed: true });
        })
        .finally(() => {
          if (!controller.signal.aborted) setSearching(false);
        });
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
      setSearching(false);
    };
  }, [active, query]);

  const select = (place) => {
    onChange({ query: placeLabel(place), place });
    setOpen(false);
  };

  const locateMe = () => {
    if (!navigator.geolocation) {
      setGpsError("loc.noGps");
      return;
    }
    setLocating(true);
    setGpsError("");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocating(false);
        select({
          name: t("loc.current"),
          region: `${coords.latitude.toFixed(2)}°, ${coords.longitude.toFixed(2)}°`,
          latitude: coords.latitude,
          longitude: coords.longitude,
        });
      },
      () => {
        setLocating(false);
        setGpsError("loc.gpsFailed");
      },
      { timeout: 10000, maximumAge: 10 * 60 * 1000 },
    );
  };

  const message = (text) => (
    <div style={{ padding: "10px 12px", fontSize: 13, color: COLORS.inkSoft }}>{text}</div>
  );

  let suggestions;
  if (found.places.length > 0) {
    suggestions = found.places.map((p) => (
      <button
        type="button"
        key={`${p.latitude},${p.longitude}`}
        className="place-option"
        onClick={() => select(p)}
        style={{
          width: "100%", display: "flex", alignItems: "flex-start", gap: 9, padding: "8px 10px",
          border: "none", borderRadius: 7, cursor: "pointer", textAlign: "left",
        }}
      >
        <MapPin size={14} color={COLORS.accent} style={{ flexShrink: 0, marginTop: 3 }} />
        <span style={{ minWidth: 0 }}>
          <span style={{ display: "block", fontSize: 14, fontWeight: 550, color: COLORS.ink }}>{p.name}</span>
          {p.region && <span style={{ display: "block", fontSize: 12, color: COLORS.inkSoft }}>{p.region}</span>}
        </span>
      </button>
    ));
  } else if (searching || found.query !== query) {
    suggestions = message(t("loc.searching"));
  } else if (found.failed) {
    suggestions = message(t("loc.searchDown"));
  } else {
    suggestions = message(t("loc.noMatches"));
  }

  return (
    <div onBlur={(e) => {
      if (e.currentTarget.contains(e.relatedTarget)) return;
      setOpen(false);
      if (search) setGpsError(""); // its message floats over the page, so it goes with focus
    }}>
      <div style={{ position: "relative" }}>
        {search && (
          <Search size={17} aria-hidden color={COLORS.inkSoft} style={{
            position: "absolute", insetInlineStart: 16, top: "50%", transform: "translateY(-50%)", pointerEvents: "none",
          }} />
        )}
        <input
          id={inputId}
          aria-label={label}
          autoFocus={autoFocus}
          autoComplete="off"
          spellCheck={false}
          style={search ? searchInputStyle : { ...inputStyle, paddingRight: value.place ? 36 : 12 }}
          placeholder={t("loc.placeholder")}
          value={value.query}
          onChange={(e) => { onChange({ query: e.target.value, place: null }); setOpen(true); setGpsError(""); }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}
        />
        {value.place && (
          <CheckCircle2
            size={17}
            color={COLORS.accent}
            aria-label={t("loc.confirmed")}
            style={{ position: "absolute", right: 11, top: "50%", transform: "translateY(-50%)" }}
          />
        )}
        {search && (
          <button
            type="button"
            onClick={locateMe}
            disabled={locating}
            aria-label={t("loc.useCurrent")}
            title={t("loc.useCurrent")}
            className="search-gps"
            style={searchGpsStyle}
          >
            {locating ? <LoaderCircle size={16} className="spin" /> : <LocateFixed size={16} />}
          </button>
        )}
        {active && (
          // preventDefault keeps focus in the input so a click on a suggestion always lands.
          <div onMouseDown={(e) => e.preventDefault()} style={placePanelStyle}>
            {suggestions}
          </div>
        )}
        {search && gpsError && !active && (
          <div role="alert" style={{ ...placePanelStyle, padding: "10px 12px", fontSize: 13, color: COLORS.danger }}>
            {t(gpsError)}
          </div>
        )}
      </div>

      {!search && (
        <>
          <button type="button" onClick={locateMe} disabled={locating} style={{ ...linkButtonStyle, marginTop: 9 }}>
            {locating ? <LoaderCircle size={14} className="spin" /> : <LocateFixed size={14} />}
            {locating ? t("loc.finding") : t("loc.useCurrent")}
          </button>
          {gpsError && <p style={{ fontSize: 12.5, color: COLORS.danger, margin: "6px 0 0" }}>{t(gpsError)}</p>}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Login (name + password + farm location)
// ---------------------------------------------------------------------------
function LoginView({ onLogin, language, onLanguageChange }) {
  const t = useT();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [location, setLocation] = useState({ query: "", place: null });
  const [error, setError] = useState(null); // { key, vars }: worded at render, so it follows the language
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const typed = location.query.trim();
    if (!name.trim()) { setError({ key: "login.errName" }); return; }
    if (password.length < 4) { setError({ key: "login.errPassword" }); return; }
    if (!typed) { setError({ key: "login.errLocation" }); return; }
    setError(null);

    let place = location.place;
    if (!place) {
      // Typed but no suggestion picked: take the best match.
      setSubmitting(true);
      try {
        place = await resolvePlace(typed);
      } catch (err) {
        if (err instanceof PlaceNotFoundError) {
          setSubmitting(false);
          setError({ key: "loc.notFound", vars: { query: err.query } });
          return;
        }
        // Location service unreachable: keep the name, climate looks it up again later.
        place = { name: typed, region: "", latitude: null, longitude: null };
      }
    }
    onLogin({ name: name.trim(), location: place });
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "32px 18px" }}>
      {/* Faint leaves in the corners */}
      <Leaf aria-hidden size={260} strokeWidth={0.9} color={COLORS.accent} style={{
        position: "fixed", top: -50, right: -60, opacity: 0.1, transform: "rotate(-24deg)", pointerEvents: "none",
      }} />
      <Sprout aria-hidden size={220} strokeWidth={0.9} color={COLORS.warm} style={{
        position: "fixed", bottom: -40, left: -40, opacity: 0.1, transform: "rotate(14deg)", pointerEvents: "none",
      }} />

      <div className="view-enter" style={{ position: "relative", width: "100%", maxWidth: 400 }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{
            width: 60, height: 60, borderRadius: 18, background: GRADIENTS.accent, margin: "0 auto 16px",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: `0 0 0 7px rgba(96,116,86,0.12), ${SHADOWS.accent}`,
          }}>
            <Leaf size={28} color={COLORS.onAccent} strokeWidth={2.2} />
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 750, color: COLORS.rail, margin: 0, letterSpacing: "-0.02em" }}>
            {t("app.name")}
          </h1>
          <p style={{ fontSize: 14, color: COLORS.inkSoft, margin: "8px auto 0", maxWidth: 330, lineHeight: 1.5 }}>
            {t("login.intro")}
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          noValidate
          style={{
            ...cardStyle, borderRadius: 20, padding: "26px 22px 22px", boxShadow: SHADOWS.raised,
            // Palette strip along the top edge, clipped by the rounded corners
            background: `${GRADIENTS.strip} top / 100% 5px no-repeat border-box, ${COLORS.surface}`,
            borderTopColor: "transparent",
          }}
        >
          <div style={{ marginBottom: 14 }}>
            <FieldLabel icon={User} htmlFor="login-name">{t("login.name")}</FieldLabel>
            <input
              id="login-name"
              autoFocus
              autoComplete="name"
              style={inputStyle}
              placeholder={t("login.namePlaceholder")}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div style={{ marginBottom: 14 }}>
            <FieldLabel icon={Lock} htmlFor="login-password">{t("login.password")}</FieldLabel>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              style={inputStyle}
              placeholder={t("login.passwordPlaceholder")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div style={{ marginBottom: 14 }}>
            <FieldLabel icon={MapPin} htmlFor="login-location">{t("login.location")}</FieldLabel>
            <LocationPicker inputId="login-location" value={location} onChange={setLocation} />
          </div>

          <div style={{ marginBottom: 18 }}>
            <FieldLabel icon={Languages} htmlFor="login-language">{t("login.language")}</FieldLabel>
            <LanguageSelect
              id="login-language"
              style={{ ...inputStyle, appearance: "auto" }}
              value={language}
              onChange={onLanguageChange}
            />
          </div>

          {error && <FormAlert>{t(error.key, error.vars)}</FormAlert>}

          <PrimaryButton type="submit" disabled={submitting}>
            {submitting ? (
              <>
                <LoaderCircle size={17} className="spin" />
                {t("loc.finding")}
              </>
            ) : (
              <>{t("login.submit")}<ChevronRight size={17} /></>
            )}
          </PrimaryButton>
        </form>

        <p style={{ textAlign: "center", fontSize: 12, color: COLORS.inkSoft, margin: "14px 0 0" }}>
          {t("login.saved")}
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Live video recorder: camera preview → record up to 30 s → review → attach.
// The camera only runs while framing or recording, never during review.
// ---------------------------------------------------------------------------
const fillFrameStyle = {
  position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", display: "block",
};

const frameOverlayStyle = {
  position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
  gap: 8, padding: 24, color: COLORS.onFrame, fontSize: 13.5, lineHeight: 1.5, textAlign: "center",
};

const onFrameChipStyle = {
  position: "absolute", top: 10, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
  border: "none", borderRadius: 999, background: "rgba(29,27,24,0.6)", color: "#fff",
};

const wideButtonStyle = { ...smallButtonStyle, flex: 1, justifyContent: "center", padding: "11px 14px", fontSize: 14 };
const widePrimaryStyle = { ...smallPrimaryStyle, flex: 1, justifyContent: "center", padding: "11px 14px", fontSize: 14 };

function VideoRecorder({ onSave, onClose }) {
  const t = useT();
  const [unsupported] = useState(recordingSupport);
  const [touch] = useState(() => window.matchMedia?.("(pointer: coarse)").matches ?? false);
  const [status, setStatus] = useState(unsupported ? "error" : "starting"); // starting | live | recording | review | error
  const [error, setError] = useState(unsupported ?? "");
  const [notice, setNotice] = useState("");
  const [facing, setFacing] = useState("environment");
  const [canFlip, setCanFlip] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [clip, setClip] = useState(null);

  const dialogRef = useRef(null);
  const liveRef = useRef(null);
  const fileRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const startedAtRef = useRef(0);
  const autoStopRef = useRef(null);
  const stopInfoRef = useRef(null);
  const closedRef = useRef(false);
  const keptRef = useRef(false);

  const reviewing = status === "review";
  const recording = status === "recording";
  const ready = status === "live";

  // Focus the dialog and lock page scroll. Closing mid-recording throws the clip away.
  useEffect(() => {
    closedRef.current = false; // StrictMode re-mounts after a simulated close
    dialogRef.current?.focus();
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      closedRef.current = true;
      document.body.style.overflow = overflow;
      clearTimeout(autoStopRef.current);
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== "inactive") recorder.stop();
    };
  }, []);

  useEffect(() => {
    if (unsupported || reviewing) return;
    let cancelled = false;
    let stream = null;
    openCamera(facing)
      .then((s) => {
        if (cancelled) { s.getTracks().forEach((t) => t.stop()); return; }
        stream = s;
        const el = liveRef.current;
        el.srcObject = s;
        // Allow recording once frames are actually on screen.
        el.play().catch(() => {}).finally(() => { if (!cancelled) setStatus("live"); });
        hasMultipleCameras().then((many) => { if (!cancelled) setCanFlip(many); }).catch(() => {});
      })
      .catch((err) => {
        if (cancelled) return;
        setError(cameraErrorKey(err));
        setStatus("error");
      });
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [unsupported, reviewing, facing, attempt]);

  useEffect(() => {
    if (!recording) return;
    const id = setInterval(() => setElapsed(Date.now() - startedAtRef.current), 200);
    return () => clearInterval(id);
  }, [recording]);

  // A clip that isn't kept is released when it's retaken or the dialog closes.
  useEffect(() => {
    if (!clip) return;
    return () => { if (!keptRef.current) URL.revokeObjectURL(clip.url); };
  }, [clip]);

  const stopRecording = () => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    clearTimeout(autoStopRef.current);
    stopInfoRef.current = {
      duration: Math.min(Date.now() - startedAtRef.current, MAX_CLIP_MS),
      poster: captureFrame(liveRef.current),
    };
    recorder.stop();
  };

  const startRecording = () => {
    const stream = liveRef.current?.srcObject;
    if (!stream) return;
    const mimeType = pickRecorderType();
    chunksRef.current = [];
    stopInfoRef.current = null;
    try {
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorder.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        recorderRef.current = null;
        if (closedRef.current) return;
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || mimeType || "video/webm" });
        if (!blob.size) {
          setNotice("rec.empty");
          setStatus("live");
          return;
        }
        setClip({ url: URL.createObjectURL(blob), ...stopInfoRef.current });
        setStatus("review");
      };
      recorder.start(250);
      recorderRef.current = recorder;
    } catch {
      setError("rec.cantRecord");
      setStatus("error");
      return;
    }
    startedAtRef.current = Date.now();
    autoStopRef.current = setTimeout(stopRecording, MAX_CLIP_MS);
    setElapsed(0);
    setNotice("");
    setStatus("recording");
  };

  const retake = () => { setClip(null); setElapsed(0); setStatus("starting"); };
  const retry = () => { setError(""); setStatus("starting"); setAttempt((n) => n + 1); };
  const flip = () => { setStatus("starting"); setFacing((f) => (f === "environment" ? "user" : "environment")); };
  const keep = () => { keptRef.current = true; onSave(clip); onClose(); };

  // Fallback when live recording can't run: the phone's camera app, or a saved video.
  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file || (file.type && !file.type.startsWith("video/"))) return;
    onSave({ url: URL.createObjectURL(file), duration: null, poster: null });
    onClose();
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 50, background: "rgba(29,27,24,0.62)",
      display: "flex", padding: 16, overflowY: "auto",
    }}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="recorder-title"
        tabIndex={-1}
        onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
        style={{
          ...cardStyle, margin: "auto", width: "100%", maxWidth: 520, borderRadius: 14, outline: "none",
          boxShadow: "0 24px 60px -24px rgba(29,27,24,0.6)",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 id="recorder-title" style={{ fontSize: 16, fontWeight: 650, color: COLORS.ink, margin: 0 }}>
              {reviewing ? t("rec.reviewTitle") : t("rec.title")}
            </h2>
            <p style={{ fontSize: 13, color: COLORS.inkSoft, margin: "4px 0 0", lineHeight: 1.5 }}>
              {reviewing ? t("rec.reviewHint") : t("rec.hint")}
            </p>
          </div>
          <button onClick={onClose} aria-label={t("rec.close")} style={iconButtonStyle}>
            <X size={16} />
          </button>
        </div>

        <div className="recorder-frame" style={{ position: "relative", background: COLORS.frame, borderRadius: 10, overflow: "hidden" }}>
          {/* Distinct keys: a reused live <video> keeps the camera as srcObject, which overrides src */}
          {reviewing ? (
            <video
              key="review"
              src={clip.url}
              poster={clip.poster ?? undefined}
              controls
              playsInline
              preload="metadata"
              aria-label={t("rec.video")}
              style={fillFrameStyle}
            />
          ) : (
            <video key="live" ref={liveRef} muted playsInline autoPlay aria-label={t("rec.preview")} style={fillFrameStyle} />
          )}

          {status === "starting" && (
            <div style={frameOverlayStyle}>
              <LoaderCircle size={17} className="spin" style={{ flexShrink: 0 }} />
              {t("rec.starting")}
            </div>
          )}
          {status === "error" && (
            <div role="alert" style={{ ...frameOverlayStyle, flexDirection: "column", background: COLORS.frame }}>
              <VideoOff size={26} />
              <p style={{ margin: 0, maxWidth: 320 }}>{t(error)}</p>
            </div>
          )}
          {recording && (
            <div style={{ ...onFrameChipStyle, left: 10, padding: "4px 10px", fontSize: 11.5, fontWeight: 650, letterSpacing: "0.05em" }}>
              <span className="rec-dot" style={{ width: 8, height: 8, borderRadius: 999, background: COLORS.warm }} />
              REC
            </div>
          )}
          {ready && canFlip && (
            <button
              onClick={flip}
              aria-label={t("rec.switch")}
              title={t("rec.switch")}
              style={{ ...onFrameChipStyle, right: 10, width: 38, height: 38, cursor: "pointer" }}
            >
              <SwitchCamera size={18} />
            </button>
          )}
        </div>

        {reviewing ? (
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <button onClick={retake} style={wideButtonStyle}><RotateCcw size={14} /> {t("rec.again")}</button>
            <button onClick={keep} style={widePrimaryStyle}><Check size={15} /> {t("rec.use")}</button>
          </div>
        ) : status === "error" ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
            {!unsupported && <button onClick={retry} style={wideButtonStyle}><RefreshCw size={14} /> {t("common.tryAgain")}</button>}
            <button onClick={() => fileRef.current?.click()} style={widePrimaryStyle}>
              <Camera size={15} /> {touch ? t("rec.cameraApp") : t("rec.chooseFile")}
            </button>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14 }}>
              <div style={{ flex: 1, height: 4, borderRadius: 999, background: COLORS.page, overflow: "hidden" }}>
                <div style={{
                  height: "100%", width: `${Math.min(100, (elapsed / MAX_CLIP_MS) * 100)}%`,
                  background: COLORS.danger, transition: "width 200ms linear",
                }} />
              </div>
              <span style={{ fontSize: 12, color: COLORS.inkSoft, fontVariantNumeric: "tabular-nums" }}>
                {formatClipTime(elapsed)} / {formatClipTime(MAX_CLIP_MS)}
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, marginTop: 12 }}>
              <button
                onClick={recording ? stopRecording : startRecording}
                disabled={!ready && !recording}
                aria-label={recording ? t("rec.stop") : t("rec.start")}
                style={{
                  width: 62, height: 62, borderRadius: 999, border: `3px solid ${COLORS.danger}`, padding: 0,
                  background: COLORS.surface, display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: ready || recording ? "pointer" : "default", opacity: ready || recording ? 1 : 0.45,
                }}
              >
                <span style={{
                  width: recording ? 22 : 44, height: recording ? 22 : 44, borderRadius: recording ? 5 : 999,
                  background: COLORS.danger, transition: "width 150ms ease, height 150ms ease, border-radius 150ms ease",
                }} />
              </button>
              <span style={{ fontSize: 12.5, color: COLORS.inkSoft }}>
                {recording ? t("rec.tapStop") : t("rec.tapRecord")}
              </span>
            </div>
          </>
        )}

        {notice && <p style={{ fontSize: 12.5, color: COLORS.danger, margin: "10px 0 0", textAlign: "center" }}>{t(notice)}</p>}
        <input ref={fileRef} type="file" accept="video/*" capture="environment" hidden onChange={handleFile} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Home / Input Dashboard
// ---------------------------------------------------------------------------
const TILE_BORDER = `${COLORS.accent}59`;
const TILE_BACKGROUND = `linear-gradient(180deg, #fffdf9 0%, ${COLORS.inset} 100%)`;

const mediaTileStyle = {
  minWidth: 0, borderRadius: 18, border: `1.5px dashed ${TILE_BORDER}`, background: TILE_BACKGROUND,
  textAlign: "center", display: "flex", flexDirection: "column", justifyContent: "center",
};

const mediaPreviewStyle = { width: "100%", height: 200, objectFit: "cover", borderRadius: 12, display: "block" };

const removeMediaStyle = {
  position: "absolute", top: 8, right: 8, background: "rgba(44,42,38,0.7)",
  border: "none", borderRadius: 7, width: 28, height: 28, display: "flex",
  alignItems: "center", justifyContent: "center", cursor: "pointer",
};

// Spans only: this also renders inside a <button>.
function MediaPrompt({ icon, title, hint, tone }) {
  return (
    <>
      <span style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
        <IconBadge icon={icon} tone={tone} solid size={52} />
      </span>
      <span style={{ display: "block", fontSize: 15, fontWeight: 650, color: COLORS.ink, marginBottom: 4 }}>{title}</span>
      <span style={{ display: "block", fontSize: 12.5, color: COLORS.inkSoft, lineHeight: 1.5 }}>{hint}</span>
    </>
  );
}

function MediaCaption({ icon: Icon, label, children }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
      marginTop: 10, fontSize: 12.5, color: COLORS.inkSoft,
    }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <Icon size={14} color={COLORS.accent} /> {label}
      </span>
      {children}
    </div>
  );
}

function ClimateBanner({ climate, location, onOpen, onRetry }) {
  const t = useT();
  const base = {
    display: "flex", alignItems: "center", gap: 8, borderRadius: 11, padding: "10px 12px",
    fontSize: 12.5, lineHeight: 1.4, marginBottom: 16, borderWidth: 1, borderStyle: "solid", borderColor: "transparent",
  };
  if (climate.status === "error") {
    return (
      <div style={{ ...base, background: COLORS.dangerTint, color: COLORS.danger }}>
        <AlertTriangle size={14} style={{ flexShrink: 0 }} />
        <span style={{ flex: 1 }}>{t("home.climateError", { place: location.name })}</span>
        <button onClick={onRetry} style={{ ...linkButtonStyle, color: COLORS.danger }}>{t("common.retry")}</button>
      </div>
    );
  }
  if (!climate.reading) {
    return (
      <div style={{ ...base, background: COLORS.inset, color: COLORS.inkSoft }}>
        <LoaderCircle size={14} className="spin" style={{ flexShrink: 0 }} />
        {t("home.climateLoading", { place: location.name })}
      </div>
    );
  }
  return (
    <div style={{ ...base, background: `linear-gradient(90deg, ${COLORS.accentTint}, #f2f3ea)`, borderColor: `${COLORS.accent}2e`, color: COLORS.accentInk }}>
      <MapPin size={14} style={{ flexShrink: 0 }} />
      <span style={{ flex: 1 }}>{t("home.climateFilled", { place: location.name })}</span>
      <button onClick={onOpen} style={linkButtonStyle}>{t("home.viewClimate")}</button>
    </div>
  );
}

function LiveNote() {
  const t = useT();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 600, color: COLORS.accent, marginTop: 6 }}>
      <span className="live-dot" style={{ width: 6, height: 6, borderRadius: 999, background: COLORS.accent, flexShrink: 0 }} />
      {t("home.live")}
    </div>
  );
}

function HomeView({ form, setForm, image, setImage, video, setVideo, climate, location, loading, onAnalyze, onOpenClimate, onRetryClimate }) {
  const t = useT();
  const fileRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [recorderOpen, setRecorderOpen] = useState(false);

  const reading = climate.reading;
  const liveTemperature = reading && form.temperature === String(reading.temperature);
  const liveHumidity = reading && form.humidity === String(reading.humidity);
  const WeatherIcon = reading && weatherLook(reading.weatherCode).icon;

  const handleFiles = (files) => {
    const file = files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (e) => setImage(e.target.result);
    reader.readAsDataURL(file);
  };

  return (
    <div style={pageStyle}>
      <header style={{
        position: "relative", overflow: "hidden", background: GRADIENTS.hero, borderRadius: 20,
        padding: "20px 20px 18px", marginBottom: 20, color: "#fff", boxShadow: SHADOWS.raised,
      }}>
        <Leaf aria-hidden size={170} strokeWidth={1.1} color="#fff" style={{
          position: "absolute", right: -30, bottom: -50, opacity: 0.12, transform: "rotate(-18deg)", pointerEvents: "none",
        }} />
        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 11, background: "rgba(255,255,255,0.16)",
            border: "1px solid rgba(255,255,255,0.25)",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <Leaf size={19} color="#fff" strokeWidth={2.2} />
          </div>
          <h1 style={{ fontSize: 21, fontWeight: 750, color: "#fff", margin: 0, letterSpacing: "-0.015em" }}>
            {t("app.name")}
          </h1>
        </div>
        <p style={{ position: "relative", fontSize: 13.5, color: "rgba(255,255,255,0.86)", margin: "10px 0 0", lineHeight: 1.55, maxWidth: 480 }}>
          {t("home.intro")}
        </p>
        {/* Farm + today's weather at a glance; opens the Climate page */}
        <button onClick={onOpenClimate} title={t("home.viewClimate")} style={{ ...heroChipStyle, position: "relative", marginTop: 14 }}>
          <MapPin size={13} style={{ flexShrink: 0 }} />
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{location.name}</span>
          {WeatherIcon && (
            <>
              <span aria-hidden style={{ width: 1, height: 12, background: "rgba(255,255,255,0.35)", flexShrink: 0 }} />
              <WeatherIcon size={14} style={{ flexShrink: 0 }} />
              <span style={{ fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{reading.temperature}°C</span>
            </>
          )}
        </button>
      </header>

      {/* Plant photo + live video, side by side (stacked on phones) */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 12, marginBottom: 20 }}>
        <div
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
          className="tile"
          style={{
            ...mediaTileStyle,
            borderColor: dragOver ? COLORS.accent : TILE_BORDER,
            background: dragOver ? COLORS.accentTint : TILE_BACKGROUND,
            padding: image ? 12 : "32px 18px",
            cursor: "pointer",
          }}
        >
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => handleFiles(e.target.files)}
          />
          {image ? (
            <>
              <div style={{ position: "relative" }}>
                <img src={image} alt={t("home.uploadedAlt")} style={mediaPreviewStyle} />
                <button
                  onClick={(e) => { e.stopPropagation(); setImage(null); }}
                  style={removeMediaStyle}
                  aria-label={t("home.removeImage")}
                >
                  <X size={15} color="#fff" />
                </button>
              </div>
              {/* The whole tile opens the picker, so this is just a label */}
              <MediaCaption icon={ImageIcon} label={t("home.photoAdded")}>
                <span style={linkButtonStyle}>{t("home.changePhoto")}</span>
              </MediaCaption>
            </>
          ) : (
            <MediaPrompt icon={Upload} title={t("home.uploadTitle")} hint={t("home.uploadHint")} />
          )}
        </div>

        {video ? (
          <div style={{ ...mediaTileStyle, padding: 12 }}>
            <div style={{ position: "relative" }}>
              <video
                src={video.url}
                poster={video.poster ?? undefined}
                controls
                playsInline
                preload="metadata"
                aria-label={t("rec.video")}
                style={{ ...mediaPreviewStyle, background: COLORS.frame }}
              />
              <button onClick={() => setVideo(null)} style={removeMediaStyle} aria-label={t("home.removeVideo")}>
                <X size={15} color="#fff" />
              </button>
            </div>
            <MediaCaption
              icon={Video}
              label={video.duration ? t("home.videoLength", { time: formatClipTime(video.duration) }) : t("home.videoAdded")}
            >
              <button onClick={() => setRecorderOpen(true)} style={linkButtonStyle}>
                <RotateCcw size={13} /> {t("rec.again")}
              </button>
            </MediaCaption>
          </div>
        ) : (
          <button
            type="button"
            className="tile"
            onClick={() => setRecorderOpen(true)}
            style={{ ...mediaTileStyle, width: "100%", padding: "32px 18px", cursor: "pointer" }}
          >
            <MediaPrompt icon={Video} tone="warm" title={t("rec.title")} hint={t("home.videoHint")} />
          </button>
        )}
      </div>

      {recorderOpen && <VideoRecorder onSave={setVideo} onClose={() => setRecorderOpen(false)} />}

      {/* Environmental context */}
      <div style={{ ...cardStyle, padding: 20, marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <IconBadge icon={CloudRain} size={30} />
          <h2 style={{ fontSize: 15, fontWeight: 680, color: COLORS.ink, margin: 0 }}>{t("home.env")}</h2>
        </div>

        <ClimateBanner climate={climate} location={location} onOpen={onOpenClimate} onRetry={onRetryClimate} />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
          <div>
            <FieldLabel icon={Thermometer} htmlFor="home-temperature">{t("home.temperature")}</FieldLabel>
            <input
              id="home-temperature"
              type="number"
              style={inputStyle}
              placeholder="24"
              value={form.temperature}
              onChange={(e) => setForm({ ...form, temperature: e.target.value })}
            />
            {liveTemperature && <LiveNote />}
          </div>
          <div>
            <FieldLabel icon={Droplets} htmlFor="home-humidity">{t("home.humidity")}</FieldLabel>
            <input
              id="home-humidity"
              type="number"
              style={inputStyle}
              placeholder="55"
              value={form.humidity}
              onChange={(e) => setForm({ ...form, humidity: e.target.value })}
            />
            {liveHumidity && <LiveNote />}
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <FieldLabel icon={CloudRain}>{t("home.rainfall")}</FieldLabel>
          <input
            type="number"
            style={inputStyle}
            placeholder="5"
            value={form.rainfall}
            onChange={(e) => setForm({ ...form, rainfall: e.target.value })}
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div>
            <FieldLabel icon={Sprout}>{t("home.crop")}</FieldLabel>
            <select
              style={{ ...inputStyle, appearance: "auto" }}
              value={form.cropType}
              onChange={(e) => setForm({ ...form, cropType: e.target.value })}
            >
              <CropOptions />
            </select>
          </div>
          <div>
            <FieldLabel icon={Leaf}>{t("home.stage")}</FieldLabel>
            <select
              style={{ ...inputStyle, appearance: "auto" }}
              value={form.growthStage}
              onChange={(e) => setForm({ ...form, growthStage: e.target.value })}
            >
              {GROWTH_STAGES.map((g) => <option key={g} value={g}>{t(`stage.${g}`)}</option>)}
            </select>
          </div>
        </div>
      </div>

      <AnalyzeButton loading={loading} onClick={onAnalyze} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Climate dashboard — live conditions and the week ahead at the farm (Home analyzes without it)
// ---------------------------------------------------------------------------
const dashCardStyle = {
  position: "relative", overflow: "hidden", borderRadius: 24, border: `1px solid ${COLORS.line}`,
  boxShadow: SHADOWS.raised, minWidth: 0,
}; // padding comes from the dash-card class: tighter on phones

const insetPanelStyle = { background: COLORS.inset, borderRadius: 18, padding: "16px 18px", minWidth: 0 };

const dashTitleStyle = { fontSize: 22, fontWeight: 500, color: COLORS.ink, margin: "0 0 18px", letterSpacing: "-0.01em" };

// On the olive weather card.
const glassButtonStyle = {
  width: 38, height: 38, borderRadius: 999, flexShrink: 0, cursor: "pointer",
  border: "1px solid rgba(255,255,255,0.24)", background: "rgba(255,255,255,0.14)", color: "#fff",
  display: "flex", alignItems: "center", justifyContent: "center",
};

// Now: place, condition, temperature and today's range, beside a big weather picture.
function WeatherNowCard({ place, reading, loading, onRefresh }) {
  const t = useT();
  const look = weatherLook(reading.weatherCode);
  return (
    <section className="dash-card" style={{ ...dashCardStyle, background: GRADIENTS.hero }}>
      {/* Darker disc behind the temperature, as on the dashboard */}
      <span aria-hidden style={{
        position: "absolute", insetInlineStart: -90, bottom: -150, width: 340, height: 340, borderRadius: 999,
        background: "rgba(44,42,38,0.2)", pointerEvents: "none",
      }} />
      <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <span title={placeLabel(place)} style={{
          display: "inline-flex", alignItems: "center", gap: 7, minWidth: 0, padding: "7px 14px", borderRadius: 999,
          background: COLORS.surface, color: COLORS.accentDeep, fontSize: 14, fontWeight: 600,
        }}>
          <MapPin size={15} style={{ flexShrink: 0 }} />
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{place.name}</span>
        </span>
        <button
          onClick={onRefresh}
          disabled={loading}
          aria-label={t("climate.refresh")}
          title={t("climate.refresh")}
          className="lift"
          style={glassButtonStyle}
        >
          <RefreshCw size={16} className={loading ? "spin" : undefined} />
        </button>
      </div>

      <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 12, marginTop: 20 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ fontSize: 24, fontWeight: 500, color: "#fff", margin: 0 }}>{t(look.label)}</h2>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.8)", margin: "4px 0 0" }}>
            {t("climate.updated", { time: reading.observedAt.slice(11, 16) })}
          </p>
          <div style={{
            fontSize: "clamp(56px, 11vw, 84px)", fontWeight: 400, lineHeight: 1, letterSpacing: "-0.04em",
            color: "#fff", margin: "22px 0 8px", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap",
          }}>
            {Math.round(reading.temperature)}°C
          </div>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.8)", margin: 0 }}>{t("climate.feelsLike", { value: reading.feelsLike })}</p>
        </div>
        <div className="float now-art" style={{ filter: "drop-shadow(0 18px 24px rgba(44,42,38,0.35))" }}>
          <WeatherArt code={reading.weatherCode} isDay={reading.isDay} size={190} />
        </div>
      </div>

      <p style={{ position: "relative", display: "flex", justifyContent: "flex-end", gap: 8, margin: "16px 0 0", fontSize: 14 }}>
        <span style={{ color: "rgba(255,255,255,0.8)" }}>{t("climate.highLow")}</span>
        <span style={{ color: "#fff", fontVariantNumeric: "tabular-nums" }}>{reading.high}° / {reading.low}°</span>
      </p>
    </section>
  );
}

function SunTime({ icon: Icon, label, parts }) {
  return (
    <div>
      <dt style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: COLORS.inkSoft }}>
        <Icon size={15} color={COLORS.caution} /> {label}
      </dt>
      <dd style={{ margin: "4px 0 0", display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
        <span style={{ fontSize: 26, color: COLORS.ink, fontVariantNumeric: "tabular-nums" }}>{parts.time}</span>
        <span style={{ fontSize: 14, color: COLORS.inkSoft }}>{parts.period}</span>
      </dd>
    </div>
  );
}

// The next hours or the next days as pills, tomorrow at a glance, and daylight.
function ForecastCard({ reading, hours, days, language }) {
  const t = useT();
  const [range, setRange] = useState("today");
  const tomorrow = days[1];
  const minutes = Math.round(reading.daylightSeconds / 60);
  const items = range === "today"
    ? hours.slice(0, 5).map((h, i) => ({
      key: h.time, code: h.weatherCode, isDay: h.isDay, temperature: h.temperature,
      label: i === 0 ? t("climate.now") : formatPlaceTime(h.time, language, { hour: "numeric" }),
    }))
    : days.slice(0, 5).map((d, i) => ({
      key: d.date, code: d.weatherCode, isDay: true, temperature: d.high,
      label: i === 0 ? t("climate.today") : formatPlaceTime(d.date, language, { weekday: "short" }),
    }));

  const rangeButton = (key) => (
    <button
      type="button"
      onClick={() => setRange(key)}
      aria-pressed={range === key}
      className="range-btn"
      style={{
        background: "none", border: "none", padding: 0, font: "inherit", cursor: "pointer",
        color: range === key ? COLORS.ink : COLORS.inkSoft,
      }}
    >
      {t(`climate.${key}`)}
    </button>
  );

  return (
    <section className="dash-card" style={{ ...dashCardStyle, background: GRADIENTS.glow }}>
      <h2 style={{ ...dashTitleStyle, display: "flex", alignItems: "center", gap: 8 }}>
        {rangeButton("today")}
        <span aria-hidden style={{ color: COLORS.inkSoft }}>/</span>
        {rangeButton("week")}
      </h2>
      <div className="week-grid">
        <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 14 }}>
          <ul className="forecast-pills" style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {items.map((item, i) => (
              <li key={item.key} style={{
                flex: "1 0 50px", display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
                padding: "14px 4px 12px", borderRadius: 999,
                border: `1px solid ${i === 0 ? `${COLORS.accent}8c` : COLORS.line}`,
                background: i === 0 ? `linear-gradient(180deg, ${COLORS.accentTint}, transparent)` : "transparent",
              }}>
                <span style={{ fontSize: 13, color: i === 0 ? COLORS.ink : COLORS.inkSoft, whiteSpace: "nowrap" }}>{item.label}</span>
                <WeatherArt code={item.code} isDay={item.isDay} size={40} label={t(weatherLook(item.code).label)} />
                <span style={{ fontSize: 16, color: COLORS.ink, fontVariantNumeric: "tabular-nums" }}>{item.temperature}°</span>
              </li>
            ))}
          </ul>
          {tomorrow && (
            <div style={{ ...insetPanelStyle, display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 15, color: COLORS.ink }}>{t("climate.tomorrow")}</div>
                <div style={{ fontSize: 12.5, color: COLORS.inkSoft, marginTop: 2 }}>{t(weatherLook(tomorrow.weatherCode).label)}</div>
              </div>
              <div style={{ marginInlineStart: "auto", fontSize: 34, color: COLORS.ink, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                {tomorrow.high}°C
              </div>
              <WeatherArt code={tomorrow.weatherCode} size={58} />
            </div>
          )}
        </div>
        <dl style={{ ...insetPanelStyle, margin: 0, display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 14 }}>
          <SunTime icon={Sunrise} label={t("climate.sunrise")} parts={clockParts(reading.sunrise, language)} />
          <SunTime icon={Sunset} label={t("climate.sunset")} parts={clockParts(reading.sunset, language)} />
          <div>
            <dt style={{ fontSize: 13, color: COLORS.inkSoft }}>{t("climate.dayLength")}</dt>
            <dd style={{ margin: "4px 0 0", fontSize: 20, color: COLORS.ink }}>
              {t("climate.dayLengthValue", { h: Math.floor(minutes / 60), m: minutes % 60 })}
            </dd>
          </div>
        </dl>
      </div>
    </section>
  );
}

function HighlightTile({ title, aside, footer, children }) {
  return (
    <div style={{
      background: `radial-gradient(90% 70% at 50% 100%, rgba(96,116,86,0.1), transparent 70%), ${COLORS.inset}`,
      borderRadius: 16, padding: "14px 16px", minHeight: 170, minWidth: 0, display: "flex", flexDirection: "column", gap: 12,
    }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
        <h3 style={{ fontSize: 14, fontWeight: 500, color: COLORS.ink, margin: 0 }}>{title}</h3>
        {aside && (
          <span style={{ fontSize: 14, fontWeight: 600, color: COLORS.accent, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
            {aside}
          </span>
        )}
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>{children}</div>
      {footer && (
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12, color: COLORS.inkSoft }}>{footer}</div>
      )}
    </div>
  );
}

// One bar per day, today's highlighted; read out as one line for screen readers.
function RainChanceBars({ days, language }) {
  const bars = days.map((d) => ({ ...d, day: formatPlaceTime(d.date, language, { weekday: "short" }) }));
  return (
    <div
      role="img"
      aria-label={bars.map((d) => `${d.day} ${d.rainChance ?? "–"}%`).join(", ")}
      style={{ display: "flex", alignItems: "stretch", gap: 4, height: 96 }}
    >
      {bars.map((d, i) => (
        <div key={d.date} style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <div style={{ flex: 1, width: 10, display: "flex", alignItems: "flex-end" }}>
            <div className="bar-rise" style={{
              width: "100%", height: `${Math.max(d.rainChance ?? 0, 4)}%`, borderRadius: 999,
              background: i === 0 ? COLORS.accent : "rgba(95,87,75,0.32)", opacity: d.rainChance == null ? 0.25 : 1,
            }} />
          </div>
          <span style={{ fontSize: 10.5, color: i === 0 ? COLORS.ink : COLORS.inkSoft, maxWidth: "100%", overflow: "hidden", whiteSpace: "nowrap" }}>
            {d.day}
          </span>
        </div>
      ))}
    </div>
  );
}

const UV_ARC = "M14 82 A66 66 0 0 1 146 82";

// Half ring filled to the day's peak UV, on the 0–11+ scale.
function UvGauge({ value }) {
  const t = useT();
  const rounded = Math.round(value); // UV bands are defined on whole numbers
  const level = uvLevel(rounded);
  const share = Math.min(value / 11, 1) * 100;
  return (
    <div style={{ position: "relative", width: 160, maxWidth: "100%", margin: "0 auto" }}>
      <svg viewBox="0 0 160 90" width="160" height="90" aria-hidden style={{ display: "block", width: "100%", height: "auto" }}>
        <path d={UV_ARC} fill="none" stroke={COLORS.line} strokeWidth="10" strokeLinecap="round" />
        {share > 0 && (
          <path
            className="gauge-arc" d={UV_ARC} fill="none" stroke={level.color} strokeWidth="10" strokeLinecap="round"
            pathLength="100" strokeDasharray="100" strokeDashoffset={100 - share} style={{ "--gauge-empty": 100 }}
          />
        )}
      </svg>
      <div style={{ position: "absolute", insetInline: 0, bottom: 0, textAlign: "center" }}>
        <div style={{ fontSize: 26, color: COLORS.ink, lineHeight: 1.1, fontVariantNumeric: "tabular-nums" }}>{rounded}</div>
        <div style={{ fontSize: 12.5, color: level.color }}>{t(level.key)}</div>
      </div>
    </div>
  );
}

// Wind over the next hours, now highlighted. The tile's numbers carry the reading; this is the shape of the day.
function WindBars({ hours }) {
  const max = Math.max(10, ...hours.map((h) => h.windSpeed));
  return (
    <div aria-hidden style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 3, height: 70 }}>
      {hours.map((h, i) => (
        <span key={h.time} className="bar-rise" style={{
          flex: "1 1 0", maxWidth: 8, height: `${Math.max(12, (h.windSpeed / max) * 100)}%`, borderRadius: 3,
          transformOrigin: "center",
          background: i === 0 ? COLORS.accent : "linear-gradient(180deg, rgba(95,87,75,0.5), rgba(95,87,75,0.14))",
        }} />
      ))}
    </div>
  );
}

function HighlightsCard({ reading, hours, days, language }) {
  const t = useT();
  const rainChance = days[0]?.rainChance;
  const windHours = hours.slice(0, 16);
  const lastWindHour = windHours[windHours.length - 1];
  return (
    <section className="dash-card" style={{ ...dashCardStyle, background: GRADIENTS.glow }}>
      <h2 style={dashTitleStyle}>{t("climate.highlights")}</h2>
      <div className="highlight-grid">
        <HighlightTile title={t("climate.rainChance")} aside={rainChance != null ? `${rainChance}%` : null}>
          <RainChanceBars days={days} language={language} />
        </HighlightTile>
        <HighlightTile title={t("climate.uv")}>
          {reading.uvIndex != null
            ? <UvGauge value={reading.uvIndex} />
            : <span style={{ textAlign: "center", color: COLORS.inkSoft }}>–</span>}
        </HighlightTile>
        <HighlightTile
          title={t("climate.wind")}
          aside={`${reading.windSpeed} km/h`}
          footer={lastWindHour && (
            <>
              <span>{t("climate.now")}</span>
              <span>{formatPlaceTime(lastWindHour.time, language, { hour: "numeric" })}</span>
            </>
          )}
        >
          <WindBars hours={windHours} />
        </HighlightTile>
        <HighlightTile
          title={t("climate.humidity")}
          aside={`${reading.humidity}%`}
          footer={<span>{t(humidityKey(reading.humidity))}</span>}
        >
          <HumidityDrop value={reading.humidity} />
        </HighlightTile>
      </div>
    </section>
  );
}

// In place of the dashboard's "other cities": what today's weather means on the farm.
function CropsSection({ reading, onOpenHome }) {
  const t = useT();
  const rainToday = reading.rainToday ?? 0;
  return (
    <section>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
        <h2 style={{ ...dashTitleStyle, margin: 0 }}>{t("climate.crops")}</h2>
        <button onClick={onOpenHome} className="top-pill" style={{ ...topPillStyle, height: 40, fontSize: 13.5 }}>
          {t("home.analyze")} <ChevronRight size={15} />
        </button>
      </div>
      <div className="crops-grid">
        <div className="dash-card" style={{
          ...dashCardStyle, background: GRADIENTS.glow, display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 10,
        }}>
          <div>
            <div style={{ fontSize: 34, color: COLORS.ink, lineHeight: 1.1, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
              {rainToday} mm
            </div>
            <div style={{ fontSize: 15, color: COLORS.ink, marginTop: 10 }}>{t("climate.rainToday")}</div>
          </div>
          <WeatherArt code={rainToday > 0 ? 61 : 0} size={64} />
        </div>
        <div className="dash-card" style={{ ...dashCardStyle, background: GRADIENTS.glow, display: "flex", alignItems: "flex-start", gap: 12 }}>
          <IconBadge icon={Sprout} solid size={36} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 15, color: COLORS.ink, marginBottom: 4 }}>{t("climate.cropTip")}</div>
            <p style={{ fontSize: 13.5, color: COLORS.inkSoft, lineHeight: 1.5, margin: 0 }}>{t(insightKey(reading))}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function ClimateView({ location, climate, language, onRefresh, onOpenHome }) {
  const t = useT();
  const { reading, status, hours = [], days = [] } = climate;
  const place = climate.place ?? location;

  if (!reading) {
    return (
      <div style={pageStyle}>
        <PageHeader icon={CloudSun} title={t("climate.title")} intro={t("climate.intro")} />
        {status === "error" ? (
          <div style={{ ...cardStyle, textAlign: "center", padding: "26px 20px" }}>
            <AlertTriangle size={22} color={COLORS.danger} />
            <h3 style={{ fontSize: 14.5, fontWeight: 620, color: COLORS.ink, margin: "10px 0 4px" }}>
              {t("climate.error", { place: place.name })}
            </h3>
            <p style={{ fontSize: 13, color: COLORS.inkSoft, margin: "0 0 14px", lineHeight: 1.5 }}>
              {t(climate.message.key, climate.message.vars)} {t("climate.errorHint")}
            </p>
            <button onClick={onRefresh} style={smallPrimaryStyle}>
              <RefreshCw size={13} /> {t("common.tryAgain")}
            </button>
          </div>
        ) : (
          <div style={{
            ...cardStyle, display: "flex", alignItems: "center", justifyContent: "center", gap: 9,
            padding: "34px 20px", color: COLORS.inkSoft, fontSize: 13.5,
          }}>
            <LoaderCircle size={17} className="spin" color={COLORS.accent} />
            {t("home.climateLoading", { place: place.name })}
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <h1 className="sr-only">{t("climate.title")}</h1>
      <div className="climate-grid">
        <div className="climate-col">
          <WeatherNowCard place={place} reading={reading} loading={status === "loading"} onRefresh={onRefresh} />
          <ForecastCard reading={reading} hours={hours} days={days} language={language} />
        </div>
        <div className="climate-col">
          <HighlightsCard reading={reading} hours={hours} days={days} language={language} />
          <CropsSection reading={reading} onOpenHome={onOpenHome} />
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Results / Translator view
// ---------------------------------------------------------------------------
function ResultsView({ result, image, video, onBack }) {
  const t = useT();
  if (!result) {
    return (
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "60px 20px", textAlign: "center" }}>
        <span style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
          <IconBadge icon={Sprout} size={52} />
        </span>
        <p style={{ color: COLORS.inkSoft, fontSize: 14.5 }}>
          {t("results.empty")}
        </p>
      </div>
    );
  }

  const { water, nutrient, disease, overall, status } = result;
  const { headline, translation, recommendation } = describeResult(result, t);

  return (
    <div style={pageStyle}>
      <PageHeader icon={ImageIcon} title={t("results.title")} />

      <div style={{
        background: COLORS.surface, border: `1px solid ${COLORS.line}`, borderRadius: 18, overflow: "hidden",
        boxShadow: SHADOWS.raised,
      }}>
        {/* status strip */}
        <div style={{
          background: `linear-gradient(135deg, ${status.soft} 0%, ${COLORS.surface} 100%)`, padding: "18px 20px",
          borderBottom: `1px solid ${COLORS.line}`, display: "flex", alignItems: "center", gap: 16,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 700,
              color: status.color, background: COLORS.surface, padding: "5px 11px", borderRadius: 999,
              border: `1px solid ${status.color}33`, marginBottom: 10, boxShadow: "0 2px 6px -3px rgba(44,42,38,0.2)",
            }}>
              <span>{status.emoji}</span> {t(`status.${status.key}`)}
            </div>
            <h2 style={{ fontSize: 19, fontWeight: 720, color: COLORS.ink, margin: "0 0 4px", letterSpacing: "-0.015em" }}>
              {headline}
            </h2>
            <p style={{ fontSize: 13, color: COLORS.inkSoft, margin: 0 }}>
              {t("results.probability")} <strong style={{ color: COLORS.ink }}>{overall}%</strong>
            </p>
          </div>
          <Gauge value={overall} color={status.color} />
        </div>

        {(image || video) && (
          <div style={{ display: "grid", gridTemplateColumns: image && video ? "1fr 1fr" : "1fr", gap: 2, background: COLORS.line }}>
            {image && (
              <img src={image} alt={t("results.alt")} style={{ width: "100%", height: 180, objectFit: "cover", display: "block" }} />
            )}
            {video && (
              <video
                src={video.url}
                poster={video.poster ?? undefined}
                controls
                playsInline
                preload="metadata"
                aria-label={t("results.video")}
                style={{ width: "100%", height: 180, objectFit: "cover", display: "block", background: COLORS.frame }}
              />
            )}
          </div>
        )}

        <div style={{ padding: "20px" }}>
          <h3 style={{ fontSize: 13, fontWeight: 620, color: COLORS.ink, margin: "0 0 14px" }}>{t("results.breakdown")}</h3>
          <ProgressBar label={t("results.water")} value={water} color={COLORS.accent} />
          <ProgressBar label={t("results.nutrient")} value={nutrient} color={COLORS.warm} />
          <ProgressBar label={t("results.disease")} value={disease} color={COLORS.danger} />

          <div style={{ height: 1, background: COLORS.line, margin: "18px 0" }} />

          <h3 style={{ fontSize: 13, fontWeight: 620, color: COLORS.ink, margin: "0 0 8px" }}>{t("results.meaning")}</h3>
          <p style={{ fontSize: 14, color: COLORS.ink, lineHeight: 1.6, margin: "0 0 18px" }}>
            {translation}
          </p>

          <TipBox title={t("results.recommendation")}>{recommendation}</TipBox>
        </div>
      </div>

      <button
        onClick={onBack}
        className="lift"
        style={{
          marginTop: 18, width: "100%", padding: "13px 0", borderRadius: 13,
          border: `1px solid ${COLORS.line}`, background: "#fff", color: COLORS.accentInk,
          fontSize: 14, fontWeight: 650, cursor: "pointer", boxShadow: SHADOWS.card,
        }}
      >
        {t("results.again")}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// History / Research dashboard
// ---------------------------------------------------------------------------
function HistoryView() {
  const t = useT();
  const trend = HISTORY[HISTORY.length - 1].value - HISTORY[0].value;
  const increasing = trend > 0;

  return (
    <div style={pageStyle}>
      <PageHeader icon={History} title={t("history.title")} intro={t("history.intro")} />

      <div style={{ ...cardStyle, borderRadius: 18, padding: "18px 18px 6px", marginBottom: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
          <div>
            <h3 style={{ fontSize: 13.5, fontWeight: 620, color: COLORS.ink, margin: "0 0 2px" }}>{t("history.timeline")}</h3>
            <span style={{ fontSize: 12, color: COLORS.inkSoft }}>{t("history.axis")}</span>
          </div>
          <div style={{
            display: "flex", alignItems: "center", gap: 4, fontSize: 12.5, fontWeight: 700, flexShrink: 0,
            color: increasing ? COLORS.danger : COLORS.accent, background: increasing ? COLORS.dangerTint : COLORS.accentTint,
            padding: "4px 10px", borderRadius: 999,
          }}>
            {increasing ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            {increasing ? t("history.up") : t("history.down")}
          </div>
        </div>

        <div style={{ height: 190, marginTop: 8 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={HISTORY} margin={{ top: 10, right: 12, left: -18, bottom: 0 }}>
              <defs>
                {/* Soft fill under the line; the line itself runs olive (low stress) to maroon (high) */}
                <linearGradient id="stress-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={COLORS.warm} stopOpacity={0.32} />
                  <stop offset="100%" stopColor={COLORS.accent} stopOpacity={0.03} />
                </linearGradient>
                <linearGradient id="stress-line" x1="0" y1="1" x2="0" y2="0">
                  <stop offset="0%" stopColor={COLORS.accent} />
                  <stop offset="100%" stopColor={COLORS.danger} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={COLORS.line} strokeDasharray="3 5" vertical={false} />
              <XAxis
                dataKey="day" tickFormatter={(n) => t("history.day", { n })}
                tick={{ fontSize: 11, fill: COLORS.inkSoft }} axisLine={{ stroke: COLORS.line }} tickLine={false}
              />
              <YAxis tick={{ fontSize: 11, fill: COLORS.inkSoft }} axisLine={false} tickLine={false} domain={[0, 100]} />
              <ReferenceLine y={50} stroke={COLORS.warm} strokeDasharray="4 4" />
              <Tooltip
                contentStyle={{ borderRadius: 10, border: `1px solid ${COLORS.line}`, fontSize: 12.5, boxShadow: SHADOWS.card }}
                labelFormatter={(n) => t("history.day", { n })}
                formatter={(v) => [`${v}%`, t("history.stress")]}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="url(#stress-line)"
                strokeWidth={3}
                fill="url(#stress-fill)"
                dot={({ cx, cy, index, payload }) => (
                  <circle key={index} cx={cx} cy={cy} r={4.5} fill={statusForProb(payload.value).color} stroke={COLORS.surface} strokeWidth={2} />
                )}
                activeDot={{ r: 6, stroke: COLORS.surface, strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div style={{ display: "flex", gap: 6, padding: "10px 0 16px" }}>
          {HISTORY.map((h) => {
            const s = statusForProb(h.value);
            return (
              <span key={h.day} style={{
                flex: 1, textAlign: "center", fontSize: 11.5, fontWeight: 650, color: s.color, background: s.soft,
                borderRadius: 999, padding: "5px 0", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums",
              }}>
                {h.emoji ?? s.emoji} {h.value}%
              </span>
            );
          })}
        </div>
      </div>

      <div style={{ ...cardStyle, borderRadius: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <IconBadge icon={Cpu} size={30} />
          <h3 style={{ fontSize: 14, fontWeight: 680, color: COLORS.ink, margin: 0 }}>{t("history.metrics")}</h3>
        </div>
        <MetricRow label={t("history.architecture")} value="Multimodal ensemble" />
        <MetricRow label={t("history.imageFeatures")} value="CNN embedding extractor" />
        <MetricRow label={t("history.fusion")} value="LightGBM + Random Forest" />
        <MetricRow label={t("history.accuracy")} value="91.4%" last highlight />
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 12, fontSize: 12, color: COLORS.inkSoft }}>
          <CheckCircle2 size={13} color={COLORS.accent} />
          {t("history.retrained")}
        </div>
      </div>
    </div>
  );
}

function MetricRow({ label, value, last, highlight }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "10px 0",
      borderBottom: last ? "none" : `1px dashed ${COLORS.line}`, fontSize: 13,
    }}>
      <span style={{ color: COLORS.inkSoft }}>{label}</span>
      <span style={highlight
        ? { color: COLORS.accentInk, background: COLORS.accentTint, fontWeight: 750, padding: "3px 10px", borderRadius: 999 }
        : { color: COLORS.ink, fontWeight: 600, textAlign: "end" }}
      >
        {value}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Profile: photo, personal and farm details, language and log out.
// A new photo applies as soon as it's picked; the details wait for Save.
// ---------------------------------------------------------------------------
const PHOTO_SIZE = 256; // px square: ~20 KB as JPEG, small enough to keep in localStorage
const PHONE_PATTERN = /^\+?\d{7,15}$/; // checked once spaces and dashes are stripped

// Centre-crops a picked image to a small square JPEG, as a data URL.
function readProfilePhoto(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const side = Math.min(img.naturalWidth, img.naturalHeight);
      if (!side) { reject(new Error("Image has no size")); return; }
      const size = Math.min(PHOTO_SIZE, side);
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#fff"; // JPEG has no transparency; keep see-through PNGs off black
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, size, size);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Unreadable image"));
    };
    img.src = url;
  });
}

// Round profile photo, or the name's first letter without one. An img or span only: this renders inside buttons.
function Avatar({ session, size, ring = "none" }) {
  const base = { width: size, height: size, borderRadius: 999, flexShrink: 0, boxShadow: ring };
  if (session.photo) {
    return <img src={session.photo} alt="" style={{ ...base, display: "block", objectFit: "cover" }} />;
  }
  return (
    <span aria-hidden style={{
      ...base, display: "flex", alignItems: "center", justifyContent: "center",
      background: GRADIENTS.warm, color: COLORS.onAccent, fontSize: Math.round(size * 0.42), fontWeight: 700,
    }}>
      {session.name.charAt(0).toUpperCase()}
    </span>
  );
}

function CardTitle({ icon, children }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
      <IconBadge icon={icon} size={30} />
      <h2 style={{ fontSize: 15, fontWeight: 680, color: COLORS.ink, margin: 0 }}>{children}</h2>
    </div>
  );
}

// Side by side where there's room, stacked on phones.
const twoColumnStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 };

const heroMetaStyle = {
  display: "flex", alignItems: "center", gap: 5, minWidth: 0, fontSize: 13, color: "rgba(255,255,255,0.86)",
};

function profileDraft(session) {
  return {
    name: session.name,
    phone: session.phone ?? "",
    farmSize: session.farmSize ?? "",
    mainCrop: session.mainCrop ?? "",
    location: { query: placeLabel(session.location), place: session.location },
  };
}

function ProfileView({ session, onSave, onLogout, language, onLanguageChange }) {
  const t = useT();
  const photoRef = useRef(null);
  const [draft, setDraft] = useState(() => profileDraft(session));
  const [error, setError] = useState(null); // { key, vars }: worded at render, so it follows the language
  const [photoError, setPhotoError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const hasPhoto = Boolean(session.photo);
  const pickPhoto = () => photoRef.current?.click();

  const edit = (changes) => {
    setDraft((d) => ({ ...d, ...changes }));
    setSaved(false);
  };

  const handlePhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // so picking the same file again still fires a change
    if (!file) return;
    try {
      onSave({ photo: await readProfilePhoto(file) });
      setPhotoError(false);
    } catch {
      setPhotoError(true);
    }
  };

  const removePhoto = () => {
    setPhotoError(false);
    onSave({ photo: null });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const name = draft.name.trim();
    const phone = draft.phone.trim();
    const typed = draft.location.query.trim();
    if (!name) { setError({ key: "login.errName" }); return; }
    if (phone && !PHONE_PATTERN.test(phone.replace(/[\s-]/g, ""))) { setError({ key: "profile.errPhone" }); return; }
    if (Number(draft.farmSize) < 0) { setError({ key: "profile.errFarmSize" }); return; }
    if (!typed) { setError({ key: "login.errLocation" }); return; }
    setError(null);

    let place = draft.location.place;
    if (!place) {
      // Typed but no suggestion picked: take the best match.
      setSaving(true);
      try {
        place = await resolvePlace(typed);
      } catch (err) {
        setError(err instanceof PlaceNotFoundError
          ? { key: "loc.notFound", vars: { query: err.query } }
          : { key: "loc.serviceDown" });
        return;
      } finally {
        setSaving(false);
      }
    }
    onSave({ name, phone, farmSize: draft.farmSize, mainCrop: draft.mainCrop, location: place });
    setDraft((d) => ({ ...d, name, phone, location: { query: placeLabel(place), place } }));
    setSaved(true);
  };

  return (
    <div style={pageStyle}>
      <PageHeader icon={UserRound} title={t("profile.title")} intro={t("profile.intro")} />

      {/* Who's signed in, and their photo */}
      <section style={{
        position: "relative", overflow: "hidden", background: GRADIENTS.hero, borderRadius: 20,
        padding: 20, marginBottom: 16, color: "#fff", boxShadow: SHADOWS.raised,
      }}>
        <Sprout aria-hidden size={170} strokeWidth={1.1} color="#fff" style={{
          position: "absolute", insetInlineEnd: -30, bottom: -50, opacity: 0.12, transform: "rotate(-12deg)", pointerEvents: "none",
        }} />
        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 16 }}>
          {/* The photo is a big tap target; the labelled buttons below do the same for keyboards and screen readers */}
          <button
            type="button"
            onClick={pickPhoto}
            tabIndex={-1}
            aria-hidden
            className="lift"
            style={{ position: "relative", flexShrink: 0, padding: 0, border: "none", background: "none", borderRadius: 999, cursor: "pointer" }}
          >
            <Avatar session={session} size={84} ring="0 0 0 3px rgba(255,255,255,0.3)" />
            <span style={{
              position: "absolute", insetInlineEnd: -2, bottom: -2, width: 30, height: 30, borderRadius: 999,
              border: "2px solid #fff", background: GRADIENTS.warm, color: COLORS.onAccent,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Camera size={14} />
            </span>
          </button>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ fontSize: 19, fontWeight: 720, color: "#fff", margin: 0, letterSpacing: "-0.015em", overflowWrap: "anywhere" }}>
              {session.name}
            </h2>
            <div style={{ ...heroMetaStyle, marginTop: 5 }}>
              <MapPin size={13} style={{ flexShrink: 0 }} />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{placeLabel(session.location)}</span>
            </div>
            {session.phone && (
              <div style={{ ...heroMetaStyle, marginTop: 3 }}>
                <Phone size={13} style={{ flexShrink: 0 }} />
                <span dir="ltr">{session.phone}</span>
              </div>
            )}
          </div>
        </div>

        <div style={{ position: "relative", display: "flex", flexWrap: "wrap", gap: 8, marginTop: 16 }}>
          <button type="button" onClick={pickPhoto} style={heroChipStyle}>
            <Camera size={13} /> {t(hasPhoto ? "profile.changePhoto" : "profile.addPhoto")}
          </button>
          {hasPhoto && (
            <button type="button" onClick={removePhoto} style={heroChipStyle}>
              <Trash2 size={13} /> {t("profile.removePhoto")}
            </button>
          )}
        </div>
        {photoError && (
          <div style={{ position: "relative", marginTop: 12 }}>
            <FormAlert style={{ marginBottom: 0 }}>{t("profile.photoError")}</FormAlert>
          </div>
        )}
        {/* No capture attribute: phones then offer both the camera and the gallery */}
        <input ref={photoRef} type="file" accept="image/*" hidden onChange={handlePhoto} />
      </section>

      <form onSubmit={handleSubmit} noValidate>
        <div style={{ ...cardStyle, padding: 20, marginBottom: 14 }}>
          <CardTitle icon={User}>{t("profile.details")}</CardTitle>
          <div style={twoColumnStyle}>
            <div>
              <FieldLabel icon={User} htmlFor="profile-name">{t("login.name")}</FieldLabel>
              <input
                id="profile-name"
                autoComplete="name"
                style={inputStyle}
                placeholder={t("login.namePlaceholder")}
                value={draft.name}
                onChange={(e) => edit({ name: e.target.value })}
              />
            </div>
            <div>
              <FieldLabel icon={Phone} htmlFor="profile-phone">{t("profile.phone")}</FieldLabel>
              <input
                id="profile-phone"
                type="tel"
                autoComplete="tel"
                /* Browsers force phone fields left to right; let the empty placeholder follow the page instead */
                style={{ ...inputStyle, direction: draft.phone ? "ltr" : "inherit" }}
                placeholder={t("profile.optional")}
                value={draft.phone}
                onChange={(e) => edit({ phone: e.target.value })}
              />
            </div>
          </div>
        </div>

        <div style={{ ...cardStyle, padding: 20, marginBottom: 16 }}>
          <CardTitle icon={Tractor}>{t("profile.farm")}</CardTitle>
          <div style={{ marginBottom: 14 }}>
            <FieldLabel icon={MapPin} htmlFor="profile-location">{t("login.location")}</FieldLabel>
            <LocationPicker inputId="profile-location" value={draft.location} onChange={(location) => edit({ location })} />
          </div>
          <div style={twoColumnStyle}>
            <div>
              <FieldLabel icon={Ruler} htmlFor="profile-farm-size">{t("profile.farmSize")}</FieldLabel>
              <input
                id="profile-farm-size"
                type="number"
                min="0"
                step="any"
                inputMode="decimal"
                style={inputStyle}
                placeholder={t("profile.optional")}
                value={draft.farmSize}
                onChange={(e) => edit({ farmSize: e.target.value })}
              />
            </div>
            <div>
              <FieldLabel icon={Sprout} htmlFor="profile-crop">{t("profile.mainCrop")}</FieldLabel>
              <select
                id="profile-crop"
                style={{ ...inputStyle, appearance: "auto" }}
                value={draft.mainCrop}
                onChange={(e) => edit({ mainCrop: e.target.value })}
              >
                <option value="">{t("profile.noCrop")}</option>
                <CropOptions />
              </select>
              <p style={{ fontSize: 12, color: COLORS.inkSoft, margin: "6px 0 0", lineHeight: 1.45 }}>{t("profile.mainCropHint")}</p>
            </div>
          </div>
        </div>

        {error && <FormAlert>{t(error.key, error.vars)}</FormAlert>}
        <div role="status">
          {saved && (
            <div style={{
              display: "flex", alignItems: "center", gap: 8, background: COLORS.accentTint, color: COLORS.accentInk,
              borderRadius: 8, padding: "9px 12px", fontSize: 13, fontWeight: 600, marginBottom: 14,
            }}>
              <CheckCircle2 size={15} style={{ flexShrink: 0 }} />
              {t("profile.saved")}
            </div>
          )}
        </div>

        <PrimaryButton type="submit" disabled={saving}>
          {saving ? (
            <>
              <LoaderCircle size={17} className="spin" />
              {t("loc.finding")}
            </>
          ) : (
            <><Check size={17} />{t("profile.save")}</>
          )}
        </PrimaryButton>
      </form>

      <div style={{ ...cardStyle, padding: 20, marginTop: 20 }}>
        <CardTitle icon={Settings}>{t("profile.settings")}</CardTitle>
        <FieldLabel icon={Languages} htmlFor="profile-language">{t("common.language")}</FieldLabel>
        <LanguageSelect
          id="profile-language"
          style={{ ...inputStyle, appearance: "auto" }}
          value={language}
          onChange={onLanguageChange}
        />
        <button
          type="button"
          onClick={onLogout}
          className="lift"
          style={{
            width: "100%", marginTop: 16, padding: "12px 0", borderRadius: 12, border: `1px solid ${COLORS.danger}33`,
            background: COLORS.dangerTint, color: COLORS.danger, fontSize: 14, fontWeight: 650, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}
        >
          <LogOut size={16} /> {t("common.logout")}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Nav
// ---------------------------------------------------------------------------
const NAV_ITEMS = [
  { key: "home", icon: Home },
  { key: "climate", icon: CloudSun },
  { key: "results", icon: ImageIcon },
  { key: "history", icon: History },
];

function BottomNav({ view, setView }) {
  const t = useT();
  // No inline `display` here — the show-mobile class hides it on desktop.
  return (
    <nav style={{
      position: "fixed", bottom: 0, left: 0, right: 0, background: "rgba(255,250,243,0.9)",
      backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
      borderTop: `1px solid ${COLORS.line}`, boxShadow: "0 -10px 28px -20px rgba(44,42,38,0.4)", zIndex: 20,
      paddingBottom: "env(safe-area-inset-bottom, 0)",
    }} className="show-mobile">
      {NAV_ITEMS.map(({ key, icon: Icon }) => {
        const active = view === key;
        return (
          <button
            key={key}
            onClick={() => setView(key)}
            aria-current={active ? "page" : undefined}
            style={{
              flex: 1, background: "none", border: "none", padding: "8px 0 7px",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 3, cursor: "pointer",
            }}
          >
            {/* Pill behind the active icon */}
            <span style={{
              width: 52, height: 28, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center",
              background: active ? GRADIENTS.accent : "transparent",
              boxShadow: active ? "0 6px 14px -8px rgba(96,116,86,0.85)" : "none",
            }}>
              <Icon size={18} color={active ? COLORS.onAccent : COLORS.inkSoft} strokeWidth={active ? 2.3 : 2} />
            </span>
            <span style={{ fontSize: 10.5, fontWeight: active ? 700 : 500, color: active ? COLORS.accentInk : COLORS.inkSoft }}>
              {t(`nav.${key}`)}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

// Desktop icon rail, as on the weather dashboard: pages up top, profile and log out at the bottom.
function Sidebar({ view, setView, onOpenProfile, onLogout }) {
  const t = useT();
  const railButton = (key, Icon, label, onClick, active) => (
    <button
      key={key}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      aria-label={label}
      title={label}
      className="rail-item"
      style={{
        width: 46, height: 46, borderRadius: 14, border: "none", cursor: "pointer", flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: active ? COLORS.surface : "transparent",
        color: active ? COLORS.accentDeep : "rgba(243,236,225,0.78)",
        boxShadow: active ? "0 8px 18px -10px rgba(0,0,0,0.6)" : "none",
      }}
    >
      <Icon size={20} strokeWidth={active ? 2.3 : 2} />
    </button>
  );
  return (
    <aside className="show-desktop" style={{
      width: 78, flexShrink: 0, height: "100vh", position: "sticky", top: 0, overflowY: "auto",
      padding: "22px 0", background: GRADIENTS.rail,
    }}>
      <nav style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, minHeight: "100%" }}>
        <div title={t("app.name")} style={{
          width: 44, height: 44, borderRadius: 14, marginBottom: 20, flexShrink: 0, background: COLORS.page,
          display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 6px 14px -8px rgba(0,0,0,0.5)",
        }}>
          <Leaf size={21} color={COLORS.accentDeep} strokeWidth={2.3} />
        </div>
        {NAV_ITEMS.map(({ key, icon }) => railButton(key, icon, t(`nav.${key}`), () => setView(key), view === key))}
        <div style={{ flex: 1 }} />
        {railButton("profile", Settings, t("profile.open"), onOpenProfile, view === "profile")}
        {railButton("logout", LogOut, t("common.logout"), onLogout, false)}
      </nav>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Top bar on every page: search to switch the farm's location, language, and
// the signed-in farmer (opens Profile). Names and chevrons hide on phones.
// ---------------------------------------------------------------------------
const topPillStyle = {
  display: "flex", alignItems: "center", gap: 8, height: 46, padding: "0 14px", borderRadius: 999, flexShrink: 0,
  background: COLORS.surface, border: `1px solid ${COLORS.line}`, color: COLORS.ink, fontSize: 14, cursor: "pointer",
};

function TopBar({ session, profileOpen, onOpenProfile, onSearchLocation, language, onLanguageChange }) {
  const t = useT();
  const [draft, setDraft] = useState({ query: "", place: null });
  const [error, setError] = useState(null); // { key, vars }: worded at render, so it follows the language
  const [resolving, setResolving] = useState(false);
  const currentLanguage = LANGUAGES.find((l) => l.code === language) ?? LANGUAGES[0];

  const choose = (place) => {
    setDraft({ query: "", place: null });
    onSearchLocation(place);
  };

  // Picking a suggestion (or GPS) switches straight away; typed text resolves on Enter.
  const handleDraft = (next) => {
    setError(null);
    if (next.place) choose(next.place);
    else setDraft(next);
  };

  const submit = async (e) => {
    e.preventDefault();
    const typed = draft.query.trim();
    if (!typed || resolving) return;
    document.activeElement?.blur(); // closes the suggestions so the outcome shows in their place
    setResolving(true);
    try {
      choose(await resolvePlace(typed));
    } catch (err) {
      setError(err instanceof PlaceNotFoundError
        ? { key: "loc.notFound", vars: { query: err.query } }
        : { key: "loc.serviceDown" });
    } finally {
      setResolving(false);
    }
  };

  return (
    <header style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
      <form
        role="search"
        onSubmit={submit}
        onFocus={() => setError(null)}
        style={{ position: "relative", flex: 1, minWidth: 0, maxWidth: 460 }}
      >
        <LocationPicker variant="search" inputId="top-search" label={t("climate.changeLabel")} value={draft} onChange={handleDraft} />
        {(error || resolving) && (
          <div role={error ? "alert" : "status"} style={{
            ...placePanelStyle, padding: "10px 12px", fontSize: 13, color: error ? COLORS.danger : COLORS.inkSoft,
          }}>
            {error ? t(error.key, error.vars) : t("climate.finding")}
          </div>
        )}
      </form>

      {/* Invisible select over the pill, so the browser's own language list opens.
          16px font stops iOS zooming in on focus. */}
      <div className="icon-select top-pill" title={t("common.changeLanguage")} style={{
        ...topPillStyle, position: "relative", marginInlineStart: "auto",
      }}>
        <Languages size={17} style={{ flexShrink: 0 }} />
        <span className="show-wide" style={{ alignItems: "center", gap: 6 }}>
          {currentLanguage.native}
          <ChevronDown size={14} style={{ opacity: 0.7 }} />
        </span>
        <LanguageSelect
          aria-label={t("common.changeLanguage")}
          value={language}
          onChange={onLanguageChange}
          style={{ position: "absolute", inset: 0, width: "100%", opacity: 0, fontSize: 16, cursor: "pointer" }}
        />
      </div>

      <button
        onClick={onOpenProfile}
        aria-current={profileOpen ? "page" : undefined}
        aria-label={t("profile.open")}
        title={t("profile.open")}
        className="top-pill avatar-button"
        style={{ ...topPillStyle, padding: "0 6px" }}
      >
        <Avatar session={session} size={34} />
        <span className="show-wide" style={{ alignItems: "center", gap: 6, paddingInlineEnd: 8, maxWidth: 170 }}>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{session.name}</span>
          <ChevronDown size={14} style={{ flexShrink: 0, opacity: 0.7 }} />
        </span>
      </button>
    </header>
  );
}

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------
export default function CropStressTranslator() {
  const [session, setSession] = useState(loadSession);
  const [language, setLanguage] = useState(loadLanguage);
  const [messages, setMessages] = useState(en);
  const [view, setView] = useState("home");
  const [loading, setLoading] = useState(false);
  const [image, setImage] = useState(null);
  const [video, setVideo] = useState(null); // { url, duration, poster }
  const [result, setResult] = useState(null);
  const [form, setForm] = useState(() => formFor(session));
  const [climate, setClimate] = useState({ status: "idle" });
  const [climateRequest, setClimateRequest] = useState(0);

  const location = session?.location;

  // Release a video's memory once it's replaced or removed.
  useEffect(() => {
    if (!video) return;
    return () => URL.revokeObjectURL(video.url);
  }, [video]);

  // Load the chosen language's text, then mark the page with it
  // (screen-reader voice, and right-to-left layout for Urdu, Sindhi, Kashmiri).
  useEffect(() => {
    let cancelled = false;
    loadMessages(language).then((m) => {
      if (cancelled) return;
      setMessages(m);
      document.documentElement.lang = language;
      document.documentElement.dir = textDirection(language);
    });
    return () => { cancelled = true; };
  }, [language]);

  const t = useMemo(() => (key, vars) => translate(messages, key, vars), [messages]);

  // Fetch live climate on sign-in, location change or refresh, and fill today's
  // temperature and humidity straight into the Home form.
  useEffect(() => {
    if (!location) return;
    const controller = new AbortController();
    loadClimate(location, controller.signal)
      .then(({ place, reading, hours, days }) => {
        setClimate({ status: "ready", place, reading, hours, days });
        setForm((f) => withClimate(f, reading));
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setClimate({
          status: "error",
          message: err instanceof PlaceNotFoundError
            ? { key: "loc.notFound", vars: { query: err.query } }
            : { key: "climate.weatherDown" },
        });
      });
    return () => controller.abort();
  }, [location, climateRequest]);

  const refreshClimate = () => {
    setClimate((c) => ({ ...c, status: "loading" })); // keeps the last reading on screen meanwhile
    setClimateRequest((n) => n + 1);
  };

  const updateSession = (next) => {
    saveSession(next);
    setSession(next);
  };

  const handleLanguageChange = (code) => {
    saveLanguage(code);
    setLanguage(code);
  };

  const handleLogin = (next) => {
    updateSession(next);
    setView("home");
  };

  const handleLogout = () => {
    updateSession(null);
    setClimate({ status: "idle" });
    setForm(EMPTY_FORM);
    setImage(null);
    setVideo(null);
    setResult(null);
    setView("home");
  };

  // Profile edits land here, as does the Climate page's location switch.
  const handleProfileChange = (changes) => {
    const next = { ...session, ...changes };
    if (next.location !== session.location) setClimate({ status: "idle" }); // don't show the old place's reading while the new one loads
    if (next.mainCrop && next.mainCrop !== session.mainCrop) setForm((f) => ({ ...f, cropType: next.mainCrop }));
    updateSession(next);
  };

  const handleChangeLocation = (location) => handleProfileChange({ location });

  // The top bar's search switches the farm's location and shows its weather.
  const handleSearchLocation = (place) => {
    handleChangeLocation(place);
    setView("climate");
  };

  const openProfile = () => setView("profile");

  const handleAnalyze = () => {
    setLoading(true);
    setTimeout(() => {
      const r = runModel(form);
      setResult(r);
      setLoading(false);
      setView("results");
    }, 1400);
  };

  const page = (
    <div style={{
      fontFamily: "'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      minHeight: "100vh", color: COLORS.ink,
      textAlign: "start", // index.css centers #root text (Vite template leftover); start follows right-to-left
    }}>
      <style>{`
        * { box-sizing: border-box; }
        body { background: ${GRADIENTS.page}; background-attachment: fixed; }
        :root { color-scheme: light; } /* index.css also allows dark native controls; this design is light */
        #root { width: 100%; border-inline: none; } /* index.css boxes it at 1126px (Vite template leftover) */
        h1, h2, h3 { font-family: inherit; }
        button { font-family: inherit; }
        input, select { transition: border-color 150ms ease, box-shadow 150ms ease; }
        input:focus, select:focus { border-color: ${COLORS.accent} !important; box-shadow: 0 0 0 3px rgba(96,116,86,0.16); }
        select { cursor: pointer; }
        .place-option { background: transparent; }
        .place-option:hover, .place-option:focus-visible { background: ${COLORS.accentTint}; }
        .icon-select:focus-within { box-shadow: 0 0 0 3px rgba(96,116,86,0.2); }
        .lift { transition: transform 160ms ease, filter 160ms ease; }
        .lift:hover:not(:disabled) { transform: translateY(-1px); filter: brightness(1.05); }
        .lift:active:not(:disabled) { transform: translateY(0); filter: brightness(0.97); }
        .tile { transition: transform 180ms ease, box-shadow 180ms ease, border-color 150ms ease, background 150ms ease; }
        .tile:hover { transform: translateY(-2px); box-shadow: ${SHADOWS.card}; border-color: ${COLORS.accent} !important; }
        .rail-item, .top-pill, .search-gps { transition: background 150ms ease, color 150ms ease, border-color 150ms ease; }
        .rail-item:not([aria-current]):hover { background: rgba(255,250,243,0.1) !important; color: #fff !important; }
        .top-pill:hover, .top-pill:focus-within, .top-pill[aria-current] { border-color: ${COLORS.accent}73 !important; }
        .search-gps:hover:not(:disabled) { background: ${COLORS.accentTint} !important; color: ${COLORS.accent} !important; }
        .rail-item:focus-visible { outline: 2px solid rgba(255,255,255,0.7); outline-offset: 2px; }
        .avatar-button:focus-visible, .search-gps:focus-visible { outline: 2px solid ${COLORS.accent}; outline-offset: 2px; }
        .page-frame { max-width: 1240px; margin: 0 auto; padding: 16px 16px 100px; }
        .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
        .dash-card { padding: 18px; }
        .climate-grid { display: grid; gap: 20px; grid-template-columns: minmax(0, 1fr); align-items: start; }
        .climate-col { display: grid; gap: 20px; min-width: 0; }
        .week-grid { display: grid; gap: 14px; grid-template-columns: minmax(0, 1fr); }
        .highlight-grid { display: grid; gap: 14px; grid-template-columns: minmax(0, 1fr); }
        .crops-grid { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); }
        .forecast-pills { display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; }
        .now-art svg { width: 132px; height: auto; }
        .range-btn:focus-visible { outline: 2px solid ${COLORS.accent}; outline-offset: 3px; border-radius: 6px; }
        .bar-rise { transform-origin: bottom; animation: bar-up 800ms cubic-bezier(0.22, 1, 0.36, 1) backwards; }
        @keyframes bar-up { from { transform: scaleY(0); } }
        .float { animation: float 6s ease-in-out infinite; }
        @keyframes float { 50% { transform: translateY(-6px); } }
        @media (min-width: 560px) {
          .dash-card { padding: 24px; }
          .week-grid { grid-template-columns: minmax(0, 1fr) 180px; }
          .highlight-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .now-art svg { width: 190px; }
        }
        @media (min-width: 1100px) {
          .climate-grid { grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); }
        }
        .show-wide { display: none; }
        @media (min-width: 640px) { .show-wide { display: inline-flex; } }
        /* "backwards" fill: once finished, no transform lingers to trap the fixed-position recorder dialog */
        .view-enter { animation: view-in 420ms cubic-bezier(0.22, 1, 0.36, 1) backwards; }
        @keyframes view-in { from { opacity: 0; transform: translateY(10px); } }
        .bar-fill { transform-origin: left; animation: bar-grow 900ms cubic-bezier(0.22, 1, 0.36, 1) backwards; }
        [dir="rtl"] .bar-fill { transform-origin: right; }
        @keyframes bar-grow { from { transform: scaleX(0); } }
        .gauge-arc { animation: gauge-fill 1s cubic-bezier(0.22, 1, 0.36, 1) backwards; }
        @keyframes gauge-fill { from { stroke-dashoffset: var(--gauge-empty); } }
        .live-dot { animation: live-pulse 2s ease-in-out infinite; }
        @keyframes live-pulse { 50% { box-shadow: 0 0 0 4px rgba(96,116,86,0.18); } }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .rec-dot { animation: rec-pulse 1.2s ease-in-out infinite; }
        @keyframes rec-pulse { 50% { opacity: 0.3; } }
        .recorder-frame { aspect-ratio: 4 / 3; max-height: 62vh; }
        @media (max-width: 520px) { .recorder-frame { aspect-ratio: 3 / 4; } }
        .show-desktop { display: none; }
        .show-mobile { display: flex; }
        @media (min-width: 860px) {
          .show-desktop { display: block; }
          .show-mobile { display: none; }
          .page-frame { padding: 22px 28px 48px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .spin, .rec-dot, .live-dot, .view-enter, .bar-fill, .gauge-arc, .bar-rise, .float { animation: none; }
          .lift:hover:not(:disabled), .tile:hover { transform: none; }
          * { transition: none !important; }
        }
      `}</style>

      {!session ? (
        <LoginView onLogin={handleLogin} language={language} onLanguageChange={handleLanguageChange} />
      ) : (
        <>
          <div style={{ display: "flex" }}>
            <Sidebar view={view} setView={setView} onOpenProfile={openProfile} onLogout={handleLogout} />
            <main style={{ flex: 1, minWidth: 0 }}>
              <div className="page-frame">
                <TopBar
                  session={session} profileOpen={view === "profile"} onOpenProfile={openProfile}
                  onSearchLocation={handleSearchLocation}
                  language={language} onLanguageChange={handleLanguageChange}
                />
                {/* Keyed so each page fades in when switched to */}
                <div key={view} className="view-enter">
                  {view === "home" && (
                    <HomeView
                      form={form} setForm={setForm}
                      image={image} setImage={setImage}
                      video={video} setVideo={setVideo}
                      climate={climate} location={location}
                      loading={loading}
                      onAnalyze={handleAnalyze}
                      onOpenClimate={() => setView("climate")}
                      onRetryClimate={refreshClimate}
                    />
                  )}
                  {view === "climate" && (
                    <ClimateView
                      location={location} climate={climate} language={language}
                      onRefresh={refreshClimate}
                      onOpenHome={() => setView("home")}
                    />
                  )}
                  {view === "results" && (
                    <ResultsView result={result} image={image} video={video} onBack={() => setView("home")} />
                  )}
                  {view === "history" && <HistoryView />}
                  {view === "profile" && (
                    <ProfileView
                      session={session}
                      onSave={handleProfileChange}
                      onLogout={handleLogout}
                      language={language} onLanguageChange={handleLanguageChange}
                    />
                  )}
                </div>
              </div>
            </main>
          </div>

          <BottomNav view={view} setView={setView} />
        </>
      )}
    </div>
  );

  return <TProvider value={t}>{page}</TProvider>;
}
