"use client";

import { useState, useCallback } from "react";
import { fetchRoute, fetchTips } from "@/lib/api";
import type { RouteResponse, TipsResponse } from "@/lib/api";
import { AddressInput } from "@/components/AddressInput";
import { MapPreview } from "@/components/MapPreview";
import { RouteResult } from "@/components/RouteResult";
import { PostRouteCheckin } from "@/components/PostRouteCheckin";

const Y = "#ffff05";
const BD = "#000099";

type Screen = "input" | "results" | "checkin";

function defaultDepartureTime(): string {
  const d = new Date();
  d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function isPast(localDatetime: string): boolean {
  return new Date(localDatetime) < new Date();
}

function formatTime(localDatetime: string): string {
  return new Date(localDatetime).toLocaleTimeString("en-NL", {
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
}

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!key) return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${key}&language=en`
    );
    const data = await res.json();
    const comp = data.results?.[0]?.address_components?.find(
      (c: { types: string[] }) => c.types.includes("neighborhood") || c.types.includes("sublocality")
    );
    return comp ? `${comp.long_name}, Amsterdam` : (data.results?.[0]?.formatted_address ?? "My location");
  } catch {
    return "My location";
  }
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>("input");
  const [from, setFrom] = useState("");
  const [fromLabel, setFromLabel] = useState("");
  const [to, setTo] = useState("");
  const [mode, setMode] = useState<"bicycling" | "walking">("cycling" as "bicycling");
  const [useNow, setUseNow] = useState(true);
  const [departureTime, setDepartureTime] = useState(defaultDepartureTime);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [result, setResult] = useState<RouteResponse | null>(null);
  const [tipsOverride, setTipsOverride] = useState<TipsResponse | null>(null);
  const [routeTime, setRouteTime] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [tipsLoading, setTipsLoading] = useState(false);
  const [locating, setLocating] = useState(false);

  const timeChanged = result !== null && departureTime !== routeTime;

  const handleUseLocation = useCallback(async () => {
    if (!navigator.geolocation) { setError("Geolocation not supported."); return; }
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setFrom(`${latitude},${longitude}`);
        const label = await reverseGeocode(latitude, longitude);
        setFromLabel(label);
        setLocating(false);
      },
      () => { setError("Could not get location. Please type your start address."); setLocating(false); },
      { timeout: 8000 }
    );
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setTipsOverride(null);
    setLoading(true);
    try {
      const iso = useNow ? new Date().toISOString() : new Date(departureTime).toISOString();
      const data = await fetchRoute(from, to, mode, iso);
      setResult(data);
      setRouteTime(departureTime);
      setScreen("results");
      setTipsLoading(true);
      fetchTips(data.safety_score, data.hotspots, iso, mode)
        .then((tips) => { setTipsOverride(tips); setRouteTime(departureTime); })
        .catch(() => {})
        .finally(() => setTipsLoading(false));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateTips() {
    if (!result) return;
    setTipsLoading(true);
    try {
      const iso = useNow ? new Date().toISOString() : new Date(departureTime).toISOString();
      const data = await fetchTips(result.safety_score, result.avoids.areas, iso, mode);
      setTipsOverride(data);
      setRouteTime(departureTime);
    } catch { /* keep existing */ }
    finally { setTipsLoading(false); }
  }

  if (screen === "checkin" && result) {
    return <PostRouteCheckin result={result} onBack={() => setScreen("results")} onReset={() => setScreen("input")} />;
  }

  if (screen === "results" && result) {
    return (
      <RouteResult
        result={result}
        tipsOverride={tipsOverride}
        tipsLoading={tipsLoading}
        timeChanged={timeChanged}
        onUpdateTips={handleUpdateTips}
        onBack={() => setScreen("input")}
        onArrived={() => setScreen("checkin")}
      />
    );
  }

  // Screen 1 — Input
  const timeLabel = useNow ? `Now — ${formatTime(defaultDepartureTime())}` : formatTime(departureTime);

  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", background: BD, fontFamily: "var(--font-space-grotesk), 'Space Grotesk', sans-serif" }}>
      {/* Map top section */}
      <div style={{ position: "relative", height: "295px", flexShrink: 0 }}>
        <MapPreview showRoute={false} />
        {/* Gradient fade into blue */}
        <div style={{
          position: "absolute", inset: 0,
          background: `linear-gradient(to bottom, transparent 40%, ${BD} 100%)`,
          pointerEvents: "none", zIndex: 400,
        }} />
        {/* Logo pill */}
        <div style={{
          position: "absolute", top: 18, left: 18, zIndex: 500,
          background: Y, borderRadius: "22px",
          padding: "6px 15px 7px",
          fontWeight: 700, fontSize: "19px", color: "#000",
          letterSpacing: "-0.3px", lineHeight: 1,
        }}>stella.</div>
      </div>

      {/* Panel */}
      <div className="panel-scroll" style={{ flex: 1, padding: "20px 18px 24px", display: "flex", flexDirection: "column", gap: "12px" }}>
        <h1 style={{ color: Y, fontWeight: 700, fontSize: "22px", marginBottom: "2px" }}>
          Where are you going?
        </h1>

        {/* FROM */}
        <div style={{ background: "rgba(255,255,255,0.07)", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.1)" }}>
          <div style={{ padding: "11px 15px" }}>
            <div style={{ color: "rgba(255,255,255,0.45)", fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em", marginBottom: "5px" }}>FROM</div>
            {fromLabel ? (
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ width: 9, height: 9, background: Y, borderRadius: "50%", flexShrink: 0 }} />
                <span style={{ color: "#fff", fontSize: "15px", flex: 1 }}>{fromLabel}</span>
                <button type="button" onClick={() => { setFrom(""); setFromLabel(""); }}
                  style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", fontSize: "14px", padding: 0 }}>✕</button>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ width: 9, height: 9, background: Y, borderRadius: "50%", flexShrink: 0 }} />
                <AddressInput placeholder="My location" onSelect={(addr) => { setFrom(addr); setFromLabel(""); }} />
              </div>
            )}
          </div>
          {/* Use my location row */}
          {!fromLabel && (
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "8px 15px" }}>
              <button type="button" onClick={handleUseLocation} disabled={locating}
                style={{ background: "none", border: "none", color: Y, fontSize: "12px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", padding: 0, opacity: locating ? 0.6 : 1 }}>
                {locating ? "⏳ Locating…" : "📍 Use my current location"}
              </button>
            </div>
          )}
        </div>

        {/* TO */}
        <div style={{ background: "rgba(255,255,255,0.07)", borderRadius: "12px", padding: "11px 15px", border: `1.5px solid ${Y}` }}>
          <div style={{ color: "rgba(255,255,255,0.45)", fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em", marginBottom: "5px" }}>TO</div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: 9, height: 9, border: `2px solid ${Y}`, borderRadius: "50%", flexShrink: 0 }} />
            <AddressInput placeholder="Enter destination…" onSelect={setTo} />
          </div>
        </div>

        {/* Mode toggle */}
        <div style={{ display: "flex", gap: "8px" }}>
          {([["bicycling", "🚲", "Cycling"], ["walking", "🚶", "Walking"]] as const).map(([id, icon, label]) => (
            <button key={id} type="button" onClick={() => setMode(id)} style={{
              flex: 1, padding: "12px 0", borderRadius: "12px",
              background: mode === id ? Y : "transparent",
              border: mode === id ? "none" : "1.5px solid rgba(255,255,255,0.18)",
              color: mode === id ? "#000" : "rgba(255,255,255,0.45)",
              fontFamily: "inherit", fontWeight: 700, fontSize: "15px",
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "7px",
            }}>{icon} {label}</button>
          ))}
        </div>

        {/* Time row */}
        <div
          style={{ background: "rgba(255,255,255,0.07)", borderRadius: "12px", padding: "13px 15px", border: "1px solid rgba(255,255,255,0.08)", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
          onClick={() => setShowTimePicker((v) => !v)}
        >
          <span style={{ color: "#fff", fontSize: "15px" }}>{timeLabel}</span>
          <span style={{ color: Y, fontSize: "15px", fontWeight: 700 }}>Change time</span>
        </div>

        {/* Time picker */}
        {showTimePicker && (
          <div style={{ background: "rgba(255,255,255,0.07)", borderRadius: "12px", padding: "14px 15px", border: "1px solid rgba(255,255,255,0.1)", display: "flex", flexDirection: "column", gap: "8px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em" }}>DEPARTURE TIME</span>
              <button type="button" onClick={() => { setDepartureTime(defaultDepartureTime()); setUseNow(true); setShowTimePicker(false); }}
                style={{ background: "none", border: "none", color: Y, fontWeight: 700, fontSize: "13px", cursor: "pointer", fontFamily: "inherit" }}>
                Use Now
              </button>
            </div>
            <input
              type="datetime-local"
              value={departureTime}
              onChange={(e) => { setDepartureTime(e.target.value); setUseNow(false); }}
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "8px", color: "#fff", padding: "10px 12px", fontSize: "14px", fontFamily: "inherit", colorScheme: "dark", width: "100%" }}
            />
            {!useNow && isPast(departureTime) && (
              <p style={{ color: "rgba(251,191,36,0.85)", fontSize: "12px" }}>Past time — scores reflect those conditions.</p>
            )}
          </div>
        )}

        {error && (
          <p style={{ color: "#fca5a5", background: "rgba(239,68,68,0.1)", padding: "10px 14px", borderRadius: "10px", fontSize: "14px" }}>{error}</p>
        )}

        {/* CTA */}
        <button type="button" onClick={handleSubmit as unknown as React.MouseEventHandler} disabled={loading || !from || !to} style={{
          width: "100%", padding: "16px", borderRadius: "14px",
          background: Y, border: "none",
          color: "#000", fontFamily: "inherit", fontWeight: 700, fontSize: "17px",
          cursor: "pointer", marginTop: "2px", opacity: (loading || !from || !to) ? 0.4 : 1,
        }}>
          {loading ? "Finding safest route…" : "Find safest route"}
        </button>

        {/* Footer */}
        <p style={{ textAlign: "center", color: "rgba(255,255,255,0.28)", fontSize: "12px", lineHeight: 1.5 }}>
          Safety data from the City of Amsterdam · For Wij eisen de nacht op
        </p>
      </div>
    </div>
  );
}
