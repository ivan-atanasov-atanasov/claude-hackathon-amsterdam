"use client";

import { useState } from "react";
import { fetchRoute, fetchTips } from "@/lib/api";
import type { RouteResponse, TipsResponse } from "@/lib/api";
import { AddressInput } from "@/components/AddressInput";
import { RouteResult } from "@/components/RouteResult";
import { PostRouteCheckin } from "@/components/PostRouteCheckin";

type Screen = "input" | "results" | "checkin";

function formatTimeLabel(localDatetime: string, isNow: boolean): string {
  if (isNow) return "Now";
  const d = new Date(localDatetime);
  return d.toLocaleTimeString("en-NL", { hour: "2-digit", minute: "2-digit", hour12: true });
}

function defaultDepartureTime(): string {
  const d = new Date();
  d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function isPast(localDatetime: string): boolean {
  return new Date(localDatetime) < new Date();
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>("input");
  const [from, setFrom] = useState("");
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

  const timeChanged = result !== null && departureTime !== routeTime;
  const timeLabel = useNow
    ? "Now"
    : formatTimeLabel(departureTime, false);

  function handleChangeTime() {
    setShowTimePicker(true);
    setUseNow(false);
  }

  function handleTimeChange(val: string) {
    setDepartureTime(val);
    setUseNow(false);
  }

  function handleUseNow() {
    setDepartureTime(defaultDepartureTime());
    setUseNow(true);
    setShowTimePicker(false);
  }

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
    return (
      <PostRouteCheckin
        result={result}
        onBack={() => setScreen("results")}
      />
    );
  }

  if (screen === "results" && result) {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: "var(--stella-navy)" }}>
        {/* Time-changed banner */}
        {timeChanged && (
          <div className="flex items-center justify-between gap-3 px-4 py-3"
            style={{ background: "rgba(255,229,0,0.12)", borderBottom: "1px solid rgba(255,229,0,0.25)" }}>
            <p className="text-sm" style={{ color: "var(--stella-yellow)" }}>
              Departure time changed — update tips?
            </p>
            <button
              onClick={handleUpdateTips}
              disabled={tipsLoading}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-50"
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
    <div className="min-h-screen flex flex-col" style={{ background: "var(--stella-navy)" }}>
      {/* Background gradient evoking map */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse at 50% 30%, rgba(13,19,71,0.6) 0%, var(--stella-navy) 70%)",
          zIndex: 0,
        }}
      />

      <main className="relative z-10 flex flex-col min-h-screen px-5 py-10 max-w-md mx-auto w-full">
        {/* Logo + tagline */}
        <div className="flex flex-col gap-1 mb-8">
          <h1
            className="text-5xl font-black tracking-tight leading-none"
            style={{ color: "var(--stella-yellow)" }}
          >
            stella.
          </h1>
          <p className="text-sm" style={{ color: "var(--stella-muted)" }}>
            Safer cycling routes for Amsterdam women
          </p>
        </div>

        {/* Hero stat */}
        <div
          className="rounded-2xl px-4 py-3 mb-8"
          style={{ background: "var(--stella-navy-card)", border: "1px solid var(--stella-border)" }}
        >
          <p className="text-2xl font-bold" style={{ color: "var(--stella-yellow)" }}>78%</p>
          <p className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.75)" }}>
            of young Amsterdam women feel unsafe cycling at night.
          </p>
          <p className="text-xs mt-1 italic" style={{ color: "var(--stella-muted)" }}>
            We&apos;re giving women back the night.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {/* FROM */}
          <div
            className="rounded-2xl px-4 pt-3 pb-3 flex items-start gap-3"
            style={{ background: "var(--stella-navy-card)", border: "1px solid var(--stella-border)" }}
          >
            <div className="flex flex-col items-center gap-1 pt-1">
              <span
                className="h-3 w-3 rounded-full border-2 shrink-0"
                style={{ borderColor: "var(--stella-yellow)", background: "var(--stella-yellow)" }}
              />
              <span
                className="w-px flex-1"
                style={{ background: "var(--stella-border)", minHeight: "16px" }}
              />
            </div>
            <div className="flex-1 flex flex-col gap-1 min-w-0">
              <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--stella-muted)" }}>
                From
              </span>
              <AddressInput
                placeholder="e.g. Centraal Station"
                onSelect={setFrom}
              />
            </div>
          </div>

          {/* TO */}
          <div
            className="rounded-2xl px-4 pt-3 pb-3 flex items-start gap-3"
            style={{ background: "var(--stella-navy-card)", border: "1px solid var(--stella-border)" }}
          >
            <div className="flex flex-col items-center gap-1 pt-1">
              <span
                className="h-3 w-3 rounded-full shrink-0"
                style={{ border: "2px solid var(--stella-yellow)" }}
              />
            </div>
            <div className="flex-1 flex flex-col gap-1 min-w-0">
              <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--stella-muted)" }}>
                To
              </span>
              <AddressInput
                placeholder="e.g. Vondelpark"
                onSelect={setTo}
              />
            </div>
          </div>

          {/* Mode + Time row */}
          <div className="flex gap-2">
            {/* Mode toggle */}
            <div
              className="flex rounded-xl overflow-hidden shrink-0"
              style={{ border: "1px solid var(--stella-border)" }}
            >
              {(["bicycling", "walking"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className="px-3 py-2.5 text-xs font-semibold transition-colors"
                  style={
                    mode === m
                      ? { background: "var(--stella-yellow)", color: "var(--stella-navy)" }
                      : { background: "var(--stella-navy-card)", color: "var(--stella-muted)" }
                  }
                >
                  {m === "bicycling" ? "🚲 Cycle" : "🚶 Walk"}
                </button>
              ))}
            </div>

            {/* Time display */}
            <button
              type="button"
              onClick={handleChangeTime}
              className="flex-1 flex items-center justify-between rounded-xl px-4 py-2.5 text-sm font-medium"
              style={{ background: "var(--stella-navy-card)", border: "1px solid var(--stella-border)" }}
            >
              <span className="text-white">
                {timeLabel}
                {!useNow && (
                  <span className="ml-1 text-xs" style={{ color: "var(--stella-muted)" }}>
                    — {formatTimeLabel(departureTime, false)}
                  </span>
                )}
              </span>
              <span className="text-xs font-semibold" style={{ color: "var(--stella-yellow)" }}>
                {useNow ? "Change time" : "✓ Set"}
              </span>
            </button>
          </div>

          {/* Time picker (shown when "Change time" clicked) */}
          {showTimePicker && (
            <div
              className="rounded-2xl px-4 py-3 flex flex-col gap-2"
              style={{ background: "var(--stella-navy-card)", border: "1px solid var(--stella-border)" }}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--stella-muted)" }}>
                  Departure time
                </span>
                <button
                  type="button"
                  onClick={handleUseNow}
                  className="text-xs font-semibold"
                  style={{ color: "var(--stella-yellow)" }}
                >
                  Use Now
                </button>
              </div>
              <input
                type="datetime-local"
                value={departureTime}
                onChange={(e) => handleTimeChange(e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
                style={{
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid var(--stella-border)",
                  color: "#ffffff",
                  colorScheme: "dark",
                }}
              />
              {isPast(departureTime) && (
                <p className="text-xs" style={{ color: "rgba(251,191,36,0.9)" }}>
                  This time is in the past — safety scores will reflect those conditions.
                </p>
              )}
            </div>
          )}

          {error && (
            <p className="text-sm px-1" style={{ color: "#f87171" }}>{error}</p>
          )}

          {/* CTA */}
          <button
            type="submit"
            disabled={loading || !from || !to}
            className="w-full py-4 rounded-2xl font-bold text-base disabled:opacity-40 disabled:cursor-not-allowed transition-opacity hover:opacity-90 mt-1"
            style={{ background: "var(--stella-yellow)", color: "var(--stella-navy)" }}
          >
            {loading ? "Finding safest route…" : "Find safest route"}
          </button>
        </form>

        {/* Footer */}
        <p className="mt-auto pt-10 text-center text-xs" style={{ color: "var(--stella-muted)" }}>
          Anthropic × Claude × Amsterdam 2026
        </p>
      </main>
    </div>
  );
}
