"use client";

import { useState, useCallback } from "react";
import { fetchRoute, fetchTips } from "@/lib/api";
import type { RouteResponse, TipsResponse } from "@/lib/api";
import { AddressInput } from "@/components/AddressInput";
import { RouteResult } from "@/components/RouteResult";
import { PostRouteCheckin } from "@/components/PostRouteCheckin";

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

function formatDisplayTime(localDatetime: string): string {
  const d = new Date(localDatetime);
  return d.toLocaleTimeString("en-NL", { hour: "2-digit", minute: "2-digit", hour12: false });
}

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!key) return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  const res = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${key}&language=en`
  );
  const data = await res.json();
  const result = data.results?.[0];
  if (!result) return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  // Prefer a short neighbourhood-level name
  const short = result.address_components?.find(
    (c: { types: string[] }) => c.types.includes("neighborhood") || c.types.includes("sublocality")
  )?.long_name;
  return short ? `${short}, Amsterdam` : result.formatted_address;
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>("input");
  const [from, setFrom] = useState("");
  const [fromLabel, setFromLabel] = useState(""); // display label (may differ for "Current location")
  const [to, setTo] = useState("");
  const [mode, setMode] = useState<"bicycling" | "walking">("bicycling");
  const [departureTime, setDepartureTime] = useState(defaultDepartureTime);
  const [useNow, setUseNow] = useState(true);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [result, setResult] = useState<RouteResponse | null>(null);
  const [tipsOverride, setTipsOverride] = useState<TipsResponse | null>(null);
  const [routeTime, setRouteTime] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [tipsLoading, setTipsLoading] = useState(false);
  const [locating, setLocating] = useState(false);

  const timeChanged = result !== null && departureTime !== routeTime;

  const handleUseLocation = useCallback(async () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      return;
    }
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const coordStr = `${latitude},${longitude}`;
        const label = await reverseGeocode(latitude, longitude).catch(() => "Current location");
        setFrom(coordStr);
        setFromLabel(label);
        setLocating(false);
      },
      () => {
        setError("Could not get your location. Please type your starting address.");
        setLocating(false);
      },
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
        .catch(() => { /* keep fallback */ })
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
    } catch {
      /* silently keep existing */
    } finally {
      setTipsLoading(false);
    }
  }

  if (screen === "checkin" && result) {
    return <PostRouteCheckin result={result} onBack={() => setScreen("results")} />;
  }

  if (screen === "results" && result) {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: "var(--stella-navy)" }}>
        {timeChanged && (
          <div
            className="flex items-center justify-between gap-3 px-4 py-3"
            style={{ background: "rgba(255,229,0,0.10)", borderBottom: "1px solid rgba(255,229,0,0.2)" }}
          >
            <p className="text-sm" style={{ color: "var(--stella-yellow)" }}>
              Time changed — update tips?
            </p>
            <button
              onClick={handleUpdateTips}
              disabled={tipsLoading}
              className="text-xs font-bold px-3 py-1.5 rounded-xl disabled:opacity-50"
              style={{ background: "var(--stella-yellow)", color: "var(--stella-navy)" }}
            >
              {tipsLoading ? "Updating…" : "Update"}
            </button>
          </div>
        )}
        <RouteResult
          result={result}
          tipsOverride={tipsOverride}
          tipsLoading={tipsLoading}
          onBack={() => setScreen("input")}
          onArrived={() => setScreen("checkin")}
        />
      </div>
    );
  }

  return (
    <div
      className="flex flex-col"
      style={{ minHeight: "100dvh", background: "var(--stella-navy)" }}
    >
      <main className="flex flex-col flex-1 px-5 pt-10 pb-6 max-w-md mx-auto w-full">

        {/* Logo */}
        <div className="mb-6">
          <h1
            className="text-5xl font-black tracking-tight leading-none"
            style={{ color: "var(--stella-yellow)" }}
          >
            stella.
          </h1>
          <p className="text-xs mt-1.5" style={{ color: "rgba(255,255,255,0.45)" }}>
            Safer routes for women in Amsterdam
          </p>
        </div>

        {/* Hero stat */}
        <div
          className="rounded-2xl px-4 py-3 mb-5"
          style={{ background: "var(--stella-navy-card)", border: "1px solid var(--stella-border)" }}
        >
          <span className="text-2xl font-black" style={{ color: "var(--stella-yellow)" }}>78%</span>
          <span className="text-sm ml-2" style={{ color: "rgba(255,255,255,0.7)" }}>
            of young Amsterdam women feel unsafe cycling at night.
          </span>
        </div>

        {/* Route form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3 flex-1">

          {/* FROM / TO card */}
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: "var(--stella-navy-card)", border: "1px solid var(--stella-border)" }}
          >
            {/* FROM row */}
            <div className="px-4 pt-4 pb-3 flex items-center gap-3">
              <div className="flex flex-col items-center gap-0.5 self-stretch justify-start pt-0.5 shrink-0">
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ background: "var(--stella-yellow)" }}
                />
                <span
                  className="w-px flex-1 mt-1"
                  style={{ background: "rgba(255,229,0,0.25)", minHeight: "24px" }}
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "rgba(255,255,255,0.35)" }}>From</p>
                {fromLabel ? (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-white truncate">{fromLabel}</span>
                    <button
                      type="button"
                      onClick={() => { setFrom(""); setFromLabel(""); }}
                      className="text-xs shrink-0"
                      style={{ color: "rgba(255,255,255,0.4)" }}
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <AddressInput
                    placeholder="Start address…"
                    onSelect={(addr) => { setFrom(addr); setFromLabel(""); }}
                  />
                )}
              </div>
            </div>

            {/* Use my location row */}
            {!fromLabel && (
              <div
                className="px-4 pb-3 flex items-center gap-3"
                style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
              >
                <div className="w-3 shrink-0" />
                <button
                  type="button"
                  onClick={handleUseLocation}
                  disabled={locating}
                  className="text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
                  style={{ color: "var(--stella-yellow)" }}
                >
                  {locating ? (
                    <>⏳ Locating…</>
                  ) : (
                    <>📍 Use my current location</>
                  )}
                </button>
              </div>
            )}

            {/* Divider */}
            <div style={{ height: "1px", background: "rgba(255,255,255,0.07)", marginLeft: "52px" }} />

            {/* TO row */}
            <div className="px-4 pt-3 pb-4 flex items-center gap-3">
              <span
                className="h-3 w-3 rounded-full shrink-0 self-start mt-0.5"
                style={{ border: "2px solid var(--stella-yellow)", background: "transparent" }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "rgba(255,255,255,0.35)" }}>To</p>
                <AddressInput
                  placeholder="Destination…"
                  onSelect={setTo}
                />
              </div>
            </div>
          </div>

          {/* Mode + Time row */}
          <div className="flex gap-2">
            {/* Mode pills */}
            <div
              className="flex rounded-xl overflow-hidden"
              style={{ border: "1px solid var(--stella-border)" }}
            >
              {(["bicycling", "walking"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className="px-3 py-2.5 text-xs font-bold transition-colors whitespace-nowrap"
                  style={
                    mode === m
                      ? { background: "var(--stella-yellow)", color: "var(--stella-navy)" }
                      : { background: "var(--stella-navy-card)", color: "rgba(255,255,255,0.5)" }
                  }
                >
                  {m === "bicycling" ? "🚲  Cycle" : "🚶  Walk"}
                </button>
              ))}
            </div>

            {/* Time pill */}
            <button
              type="button"
              onClick={() => { setShowTimePicker((v) => !v); setUseNow(false); }}
              className="flex-1 flex items-center justify-between rounded-xl px-3 py-2.5 text-sm"
              style={{ background: "var(--stella-navy-card)", border: "1px solid var(--stella-border)" }}
            >
              <span className="font-medium text-white text-xs">
                {useNow ? "Now" : formatDisplayTime(departureTime)}
              </span>
              <span className="text-xs font-bold" style={{ color: "var(--stella-yellow)" }}>
                {showTimePicker ? "Done" : "Change"}
              </span>
            </button>
          </div>

          {/* Time picker */}
          {showTimePicker && (
            <div
              className="rounded-2xl px-4 py-3 flex flex-col gap-2"
              style={{ background: "var(--stella-navy-card)", border: "1px solid var(--stella-border)" }}
            >
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.4)" }}>Departure time</p>
                <button
                  type="button"
                  onClick={() => { setDepartureTime(defaultDepartureTime()); setUseNow(true); setShowTimePicker(false); }}
                  className="text-xs font-bold"
                  style={{ color: "var(--stella-yellow)" }}
                >
                  Use Now
                </button>
              </div>
              <input
                type="datetime-local"
                value={departureTime}
                onChange={(e) => { setDepartureTime(e.target.value); setUseNow(false); }}
                className="w-full rounded-xl px-3 py-2 text-sm focus:outline-none"
                style={{
                  background: "rgba(255,255,255,0.07)",
                  border: "1px solid var(--stella-border)",
                  color: "#fff",
                  colorScheme: "dark",
                }}
              />
              {!useNow && isPast(departureTime) && (
                <p className="text-xs" style={{ color: "rgba(251,191,36,0.85)" }}>
                  Past time — scores reflect those conditions.
                </p>
              )}
            </div>
          )}

          {error && (
            <p className="text-sm rounded-xl px-4 py-2" style={{ color: "#fca5a5", background: "rgba(239,68,68,0.1)" }}>
              {error}
            </p>
          )}

          <div className="flex-1" />

          {/* CTA */}
          <button
            type="submit"
            disabled={loading || !from || !to}
            className="w-full py-4 rounded-2xl font-black text-base tracking-tight disabled:opacity-40 disabled:cursor-not-allowed transition-opacity active:scale-95"
            style={{ background: "var(--stella-yellow)", color: "var(--stella-navy)" }}
          >
            {loading ? "Finding safest route…" : "Find safest route →"}
          </button>

          <p className="text-center text-[10px]" style={{ color: "rgba(255,255,255,0.2)" }}>
            Anthropic × Claude × Amsterdam 2026
          </p>
        </form>
      </main>
    </div>
  );
}
