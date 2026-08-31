import React, { useState, useRef } from "react";
import {
  Leaf, Upload, Thermometer, Droplets, CloudRain, Sprout,
  Home, History, ChevronRight, TrendingUp, TrendingDown,
  AlertTriangle, Lightbulb, Image as ImageIcon, X, Cpu, CheckCircle2,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine,
} from "recharts";

// ---------------------------------------------------------------------------
// Design tokens
// ---------------------------------------------------------------------------
const COLORS = {
  forest: "#4a7c59",
  forestDark: "#3a6247",
  sage: "#8fbc8f",
  sand: "#d4a574",
  terracotta: "#c0392b",
  amber: "#c98a2c",
  bg: "#fcfcfc",
  ink: "#2c2a26",
  inkSoft: "#6b6459",
  line: "#e7e2d9",
};

const CROP_TYPES = ["Grape", "Tomato", "Corn", "Rice", "Wheat"];
const GROWTH_STAGES = ["Seedling", "Vegetative", "Flowering", "Fruiting", "Maturity"];

const HISTORY = [
  { day: "Day 1", value: 12 },
  { day: "Day 2", value: 19 },
  { day: "Day 3", value: 31 },
  { day: "Day 4", value: 48 },
  { day: "Day 5", value: 72 },
];

function statusForProb(p) {
  if (p < 25) return { key: "normal", label: "Normal", emoji: "🟢", color: COLORS.forest, soft: "#e9f2ea" };
  if (p < 50) return { key: "mild", label: "Mild stress", emoji: "🟡", color: COLORS.amber, soft: "#faf1e0" };
  if (p < 75) return { key: "moderate", label: "Moderate stress", emoji: "🟠", color: COLORS.sand, soft: "#f8ecdd" };
  return { key: "severe", label: "Severe stress", emoji: "🔴", color: COLORS.terracotta, soft: "#f7e7e4" };
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
    { key: "water", label: "water stress", value: water },
    { key: "nutrient", label: "nutrient stress", value: nutrient },
    { key: "disease", label: "disease pressure", value: disease },
  ].sort((a, b) => b.value - a.value)[0];

  const status = statusForProb(overall);

  const headline = `${capitalize(status.label === "Normal" ? "No significant stress" : `${headlineWord(status.key)} ${dominant.label}`)} detected`;

  const translation = buildTranslation(status.key, dominant, t, r, h);
  const recommendation = buildRecommendation(dominant.key, status.key);

  return { water, nutrient, disease, overall, status, headline, translation, recommendation, dominant };
}

function headlineWord(k) {
  if (k === "mild") return "Mild";
  if (k === "moderate") return "Moderate";
  if (k === "severe") return "Severe";
  return "";
}

function buildTranslation(statusKey, dominant, t, r, h) {
  if (statusKey === "normal") {
    return "Readings fall within a healthy range for this crop stage. No corrective action needed right now — keep to your regular monitoring schedule.";
  }
  const windowText = statusKey === "severe" ? "within the next 12–24 hours" : "over the next 24–48 hours";
  const cause =
    dominant.key === "water"
      ? `soil moisture and irrigation levels`
      : dominant.key === "nutrient"
      ? `leaf color and feeding schedule`
      : `leaf surfaces for spotting, wilting, or discoloration`;
  return `Early signs of ${dominant.label} detected, consistent with the current temperature (${t}°C) and rainfall (${r}mm) readings. Monitor ${cause} ${windowText}.`;
}

function buildRecommendation(key, statusKey) {
  const urgency = statusKey === "severe" ? "immediately" : statusKey === "moderate" ? "within the next day" : "when convenient";
  if (key === "water") {
    return `Check soil moisture and irrigation conditions ${urgency}. Consider increasing watering frequency, and inspect for signs of root stress if soil is already saturated.`;
  }
  if (key === "nutrient") {
    return `Test soil nutrient levels ${urgency}. A light nitrogen or micronutrient feed may help — compare against your last fertilization date before applying.`;
  }
  return `Inspect affected leaves closely ${urgency} and isolate any visibly diseased foliage. Consider a preventive fungicide if humidity remains elevated over the coming days.`;
}

function clamp(n) { return Math.max(2, Math.min(98, n)); }
function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

// ---------------------------------------------------------------------------
// Small building blocks
// ---------------------------------------------------------------------------
function ProgressBar({ label, value, color }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontSize: 13.5, color: COLORS.ink, fontWeight: 500 }}>{label}</span>
        <span style={{ fontSize: 13.5, color: COLORS.inkSoft, fontVariantNumeric: "tabular-nums" }}>{value}%</span>
      </div>
      <div style={{ height: 8, borderRadius: 5, background: "#eef0ea", overflow: "hidden" }}>
        <div
          style={{
            height: "100%",
            width: `${value}%`,
            background: color,
            borderRadius: 5,
            transition: "width 700ms cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        />
      </div>
    </div>
  );
}

function FieldLabel({ icon: Icon, children }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13.5, color: COLORS.inkSoft, marginBottom: 6, fontWeight: 500 }}>
      <Icon size={14} strokeWidth={2} color={COLORS.forest} />
      {children}
    </label>
  );
}

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "10px 12px",
  borderRadius: 8,
  border: `1px solid ${COLORS.line}`,
  fontSize: 15,
  color: COLORS.ink,
  background: "#fff",
  outline: "none",
  fontFamily: "inherit",
};

// ---------------------------------------------------------------------------
// Home / Input Dashboard
// ---------------------------------------------------------------------------
function HomeView({ form, setForm, image, setImage, onAnalyze, loading }) {
  const fileRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFiles = (files) => {
    const file = files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (e) => setImage(e.target.result);
    reader.readAsDataURL(file);
  };

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "20px 18px 100px" }}>
      <header style={{ marginBottom: 22 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 9, background: COLORS.forest,
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <Leaf size={18} color="#fff" strokeWidth={2.2} />
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 650, color: COLORS.ink, margin: 0, letterSpacing: "-0.01em" }}>
            Crop Stress Translator
          </h1>
        </div>
        <p style={{ fontSize: 13.5, color: COLORS.inkSoft, margin: "8px 0 0 43px" }}>
          Upload a photo and today's conditions — we'll tell you what's happening to your plant, in plain language.
        </p>
      </header>

      {/* Upload area */}
      <div
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
        style={{
          border: `1.5px dashed ${dragOver ? COLORS.forest : COLORS.line}`,
          borderRadius: 12,
          background: dragOver ? "#f2f7f3" : "#fff",
          padding: image ? 12 : "34px 20px",
          textAlign: "center",
          cursor: "pointer",
          transition: "border-color 150ms ease, background 150ms ease",
          marginBottom: 20,
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
          <div style={{ position: "relative" }}>
            <img
              src={image}
              alt="Uploaded plant"
              style={{ width: "100%", maxHeight: 220, objectFit: "cover", borderRadius: 8, display: "block" }}
            />
            <button
              onClick={(e) => { e.stopPropagation(); setImage(null); }}
              style={{
                position: "absolute", top: 8, right: 8, background: "rgba(44,42,38,0.7)",
                border: "none", borderRadius: 7, width: 28, height: 28, display: "flex",
                alignItems: "center", justifyContent: "center", cursor: "pointer",
              }}
              aria-label="Remove image"
            >
              <X size={15} color="#fff" />
            </button>
          </div>
        ) : (
          <>
            <div style={{
              width: 46, height: 46, borderRadius: 11, background: "#eef2ea", margin: "0 auto 12px",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Upload size={20} color={COLORS.forest} strokeWidth={2} />
            </div>
            <div style={{ fontSize: 14.5, fontWeight: 550, color: COLORS.ink, marginBottom: 3 }}>
              Upload plant image
            </div>
            <div style={{ fontSize: 12.5, color: COLORS.inkSoft }}>
              Drag and drop, or tap to choose a photo (JPG, PNG)
            </div>
          </>
        )}
      </div>

      {/* Environmental context */}
      <div style={{
        background: "#fff", border: `1px solid ${COLORS.line}`, borderRadius: 12, padding: 18, marginBottom: 20,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 16 }}>
          <CloudRain size={16} color={COLORS.forest} />
          <h2 style={{ fontSize: 14.5, fontWeight: 620, color: COLORS.ink, margin: 0 }}>Environmental context</h2>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
          <div>
            <FieldLabel icon={Thermometer}>Temperature (°C)</FieldLabel>
            <input
              type="number"
              style={inputStyle}
              placeholder="24"
              value={form.temperature}
              onChange={(e) => setForm({ ...form, temperature: e.target.value })}
            />
          </div>
          <div>
            <FieldLabel icon={Droplets}>Humidity (%)</FieldLabel>
            <input
              type="number"
              style={inputStyle}
              placeholder="55"
              value={form.humidity}
              onChange={(e) => setForm({ ...form, humidity: e.target.value })}
            />
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <FieldLabel icon={CloudRain}>Rainfall (mm)</FieldLabel>
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
            <FieldLabel icon={Sprout}>Crop type</FieldLabel>
            <select
              style={{ ...inputStyle, appearance: "auto" }}
              value={form.cropType}
              onChange={(e) => setForm({ ...form, cropType: e.target.value })}
            >
              {CROP_TYPES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <FieldLabel icon={Leaf}>Growth stage</FieldLabel>
            <select
              style={{ ...inputStyle, appearance: "auto" }}
              value={form.growthStage}
              onChange={(e) => setForm({ ...form, growthStage: e.target.value })}
            >
              {GROWTH_STAGES.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
        </div>
      </div>

      <button
        onClick={onAnalyze}
        disabled={loading}
        style={{
          width: "100%",
          padding: "14px 0",
          borderRadius: 11,
          border: "none",
          background: loading ? COLORS.forestDark : COLORS.forest,
          color: "#fff",
          fontSize: 15.5,
          fontWeight: 620,
          cursor: loading ? "default" : "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 9,
          boxShadow: "0 6px 16px -6px rgba(74,124,89,0.55)",
          transition: "background 150ms ease, transform 100ms ease",
        }}
      >
        {loading ? (
          <>
            <Cpu size={17} className="spin" />
            Analyzing ML models…
          </>
        ) : (
          <>Analyze plant<ChevronRight size={17} /></>
        )}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Results / Translator view
// ---------------------------------------------------------------------------
function ResultsView({ result, image, onBack }) {
  if (!result) {
    return (
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "60px 20px", textAlign: "center" }}>
        <p style={{ color: COLORS.inkSoft, fontSize: 14.5 }}>
          No analysis yet. Head to Home and analyze a plant first.
        </p>
      </div>
    );
  }

  const { water, nutrient, disease, overall, status, headline, translation, recommendation } = result;

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "20px 18px 100px" }}>
      <h1 style={{ fontSize: 18, fontWeight: 650, color: COLORS.ink, margin: "0 0 16px" }}>Analysis result</h1>

      <div style={{
        background: "#fff", border: `1px solid ${COLORS.line}`, borderRadius: 14, overflow: "hidden",
        boxShadow: "0 10px 30px -18px rgba(44,42,38,0.25)",
      }}>
        {/* status strip */}
        <div style={{ background: status.soft, padding: "16px 20px", borderBottom: `1px solid ${COLORS.line}` }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 650,
            color: status.color, background: "#fff", padding: "5px 11px", borderRadius: 999,
            border: `1px solid ${status.color}33`, marginBottom: 10,
          }}>
            <span>{status.emoji}</span> {status.label.toUpperCase() === status.label ? status.label : status.label}
          </div>
          <h2 style={{ fontSize: 19, fontWeight: 650, color: COLORS.ink, margin: "0 0 4px", letterSpacing: "-0.01em" }}>
            {headline}
          </h2>
          <p style={{ fontSize: 13, color: COLORS.inkSoft, margin: 0 }}>
            Stress probability: <strong style={{ color: COLORS.ink }}>{overall}%</strong>
          </p>
        </div>

        {image && (
          <img src={image} alt="Analyzed plant" style={{ width: "100%", maxHeight: 180, objectFit: "cover", display: "block" }} />
        )}

        <div style={{ padding: "20px" }}>
          <h3 style={{ fontSize: 13, fontWeight: 620, color: COLORS.ink, margin: "0 0 14px" }}>Stress breakdown</h3>
          <ProgressBar label="Water stress" value={water} color={COLORS.forest} />
          <ProgressBar label="Nutrient stress" value={nutrient} color={COLORS.sand} />
          <ProgressBar label="Disease stress" value={disease} color={COLORS.terracotta} />

          <div style={{ height: 1, background: COLORS.line, margin: "18px 0" }} />

          <h3 style={{ fontSize: 13, fontWeight: 620, color: COLORS.ink, margin: "0 0 8px" }}>What this means</h3>
          <p style={{ fontSize: 14, color: COLORS.ink, lineHeight: 1.6, margin: "0 0 18px" }}>
            {translation}
          </p>

          <div style={{
            background: "#fdf6ea", border: `1px solid #ecdcb8`, borderRadius: 10, padding: "14px 16px",
            display: "flex", gap: 11,
          }}>
            <Lightbulb size={18} color={COLORS.amber} style={{ flexShrink: 0, marginTop: 1 }} />
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 650, color: COLORS.amber, marginBottom: 3 }}>Recommendation</div>
              <p style={{ fontSize: 13.5, color: "#5c4a26", lineHeight: 1.55, margin: 0 }}>{recommendation}</p>
            </div>
          </div>
        </div>
      </div>

      <button
        onClick={onBack}
        style={{
          marginTop: 18, width: "100%", padding: "12px 0", borderRadius: 10,
          border: `1px solid ${COLORS.line}`, background: "#fff", color: COLORS.ink,
          fontSize: 14, fontWeight: 550, cursor: "pointer",
        }}
      >
        Analyze another
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// History / Research dashboard
// ---------------------------------------------------------------------------
function HistoryView() {
  const trend = HISTORY[HISTORY.length - 1].value - HISTORY[0].value;
  const increasing = trend > 0;

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "20px 18px 100px" }}>
      <h1 style={{ fontSize: 18, fontWeight: 650, color: COLORS.ink, margin: "0 0 4px" }}>History &amp; research</h1>
      <p style={{ fontSize: 13, color: COLORS.inkSoft, margin: "0 0 20px" }}>
        Tracking one plant's stress signal across the last five days.
      </p>

      <div style={{
        background: "#fff", border: `1px solid ${COLORS.line}`, borderRadius: 14, padding: "18px 18px 6px", marginBottom: 18,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
          <div>
            <h3 style={{ fontSize: 13.5, fontWeight: 620, color: COLORS.ink, margin: "0 0 2px" }}>Stress history timeline</h3>
            <span style={{ fontSize: 12, color: COLORS.inkSoft }}>Overall stress probability, %</span>
          </div>
          <div style={{
            display: "flex", alignItems: "center", gap: 4, fontSize: 12.5, fontWeight: 650,
            color: increasing ? COLORS.terracotta : COLORS.forest,
          }}>
            {increasing ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            {increasing ? "Increasing" : "Decreasing"}
          </div>
        </div>

        <div style={{ height: 190, marginTop: 8 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={HISTORY} margin={{ top: 10, right: 12, left: -18, bottom: 0 }}>
              <CartesianGrid stroke={COLORS.line} vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: COLORS.inkSoft }} axisLine={{ stroke: COLORS.line }} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: COLORS.inkSoft }} axisLine={false} tickLine={false} domain={[0, 100]} />
              <ReferenceLine y={50} stroke={COLORS.sand} strokeDasharray="4 4" />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: `1px solid ${COLORS.line}`, fontSize: 12.5 }}
                formatter={(v) => [`${v}%`, "Stress"]}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke={COLORS.forest}
                strokeWidth={2.5}
                dot={{ r: 4, fill: COLORS.forest, strokeWidth: 0 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 2px 14px", fontSize: 11.5, color: COLORS.inkSoft }}>
          {HISTORY.map((h) => {
            const s = statusForProb(h.value);
            return <span key={h.day}>{h.emoji ?? s.emoji} {h.value}%</span>;
          })}
        </div>
      </div>

      <div style={{ background: "#fff", border: `1px solid ${COLORS.line}`, borderRadius: 14, padding: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 14 }}>
          <Cpu size={16} color={COLORS.forest} />
          <h3 style={{ fontSize: 13.5, fontWeight: 620, color: COLORS.ink, margin: 0 }}>Model metrics</h3>
        </div>
        <MetricRow label="Architecture" value="Multimodal ensemble" />
        <MetricRow label="Image features" value="CNN embedding extractor" />
        <MetricRow label="Environmental fusion" value="LightGBM + Random Forest" />
        <MetricRow label="Validation accuracy" value="91.4%" last />
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 12, fontSize: 12, color: COLORS.inkSoft }}>
          <CheckCircle2 size={13} color={COLORS.forest} />
          Retrained weekly on field-verified labels
        </div>
      </div>
    </div>
  );
}

function MetricRow({ label, value, last }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", padding: "9px 0",
      borderBottom: last ? "none" : `1px solid ${COLORS.line}`, fontSize: 13,
    }}>
      <span style={{ color: COLORS.inkSoft }}>{label}</span>
      <span style={{ color: COLORS.ink, fontWeight: 550 }}>{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Nav
// ---------------------------------------------------------------------------
const NAV_ITEMS = [
  { key: "home", label: "Home", icon: Home },
  { key: "results", label: "Results", icon: ImageIcon },
  { key: "history", label: "History", icon: History },
];

function BottomNav({ view, setView }) {
  return (
    <nav style={{
      position: "fixed", bottom: 0, left: 0, right: 0, background: "#fff",
      borderTop: `1px solid ${COLORS.line}`, display: "flex", zIndex: 20,
      paddingBottom: "env(safe-area-inset-bottom, 0)",
    }} className="show-mobile">
      {NAV_ITEMS.map(({ key, label, icon: Icon }) => {
        const active = view === key;
        return (
          <button
            key={key}
            onClick={() => setView(key)}
            style={{
              flex: 1, background: "none", border: "none", padding: "10px 0 8px",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 3, cursor: "pointer",
            }}
          >
            <Icon size={19} color={active ? COLORS.forest : COLORS.inkSoft} strokeWidth={active ? 2.3 : 2} />
            <span style={{ fontSize: 10.5, fontWeight: active ? 650 : 500, color: active ? COLORS.forest : COLORS.inkSoft }}>
              {label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

function Sidebar({ view, setView }) {
  return (
    <aside style={{
      width: 210, flexShrink: 0, borderRight: `1px solid ${COLORS.line}`, padding: "24px 14px",
      minHeight: "100vh", background: "#fff",
    }} className="show-desktop">
      <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "0 8px", marginBottom: 28 }}>
        <div style={{
          width: 30, height: 30, borderRadius: 8, background: COLORS.forest,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Leaf size={16} color="#fff" strokeWidth={2.2} />
        </div>
        <span style={{ fontSize: 14.5, fontWeight: 650, color: COLORS.ink }}>Crop Stress</span>
      </div>
      {NAV_ITEMS.map(({ key, label, icon: Icon }) => {
        const active = view === key;
        return (
          <button
            key={key}
            onClick={() => setView(key)}
            style={{
              width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "9px 10px",
              borderRadius: 8, border: "none", cursor: "pointer", marginBottom: 3,
              background: active ? "#eef2ea" : "transparent",
              color: active ? COLORS.forest : COLORS.inkSoft, fontSize: 13.5, fontWeight: active ? 620 : 500,
              textAlign: "left",
            }}
          >
            <Icon size={16} strokeWidth={active ? 2.3 : 2} />
            {label}
          </button>
        );
      })}
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------
export default function CropStressTranslator() {
  const [view, setView] = useState("home");
  const [loading, setLoading] = useState(false);
  const [image, setImage] = useState(null);
  const [result, setResult] = useState(null);
  const [form, setForm] = useState({
    temperature: "",
    humidity: "",
    rainfall: "",
    cropType: CROP_TYPES[0],
    growthStage: GROWTH_STAGES[1],
  });

  const handleAnalyze = () => {
    setLoading(true);
    setTimeout(() => {
      const r = runModel(form);
      setResult(r);
      setLoading(false);
      setView("results");
    }, 1400);
  };

  return (
    <div style={{
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      background: COLORS.bg, minHeight: "100vh", color: COLORS.ink,
    }}>
      <style>{`
        * { box-sizing: border-box; }
        input:focus, select:focus { border-color: ${COLORS.forest} !important; box-shadow: 0 0 0 3px rgba(74,124,89,0.14); }
        select { cursor: pointer; }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .show-desktop { display: none; }
        .show-mobile { display: flex; }
        @media (min-width: 860px) {
          .show-desktop { display: block; }
          .show-mobile { display: none; }
        }
        @media (prefers-reduced-motion: reduce) {
          .spin { animation: none; }
          * { transition: none !important; }
        }
      `}</style>

      <div style={{ display: "flex" }}>
        <Sidebar view={view} setView={setView} />
        <main style={{ flex: 1, minWidth: 0 }}>
          {view === "home" && (
            <HomeView
              form={form} setForm={setForm}
              image={image} setImage={setImage}
              onAnalyze={handleAnalyze} loading={loading}
            />
          )}
          {view === "results" && (
            <ResultsView result={result} image={image} onBack={() => setView("home")} />
          )}
          {view === "history" && <HistoryView />}
        </main>
      </div>

      <BottomNav view={view} setView={setView} />
    </div>
  );
}
