"use client";

import { useState } from "react";
import { fetchRoute, fetchTips } from "@/lib/api";
import type { RouteResponse, TipsResponse } from "@/lib/api";
import { AddressInput } from "@/components/AddressInput";
import { RouteResult } from "@/components/RouteResult";

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
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [mode, setMode] = useState<"bicycling" | "walking">("bicycling");
  const [departureTime, setDepartureTime] = useState(defaultDepartureTime);
  const [result, setResult] = useState<RouteResponse | null>(null);
  const [tipsOverride, setTipsOverride] = useState<TipsResponse | null>(null);
  const [routeTime, setRouteTime] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [tipsLoading, setTipsLoading] = useState(false);

  const timeChanged = result !== null && departureTime !== routeTime;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setTipsOverride(null);
    setLoading(true);
    try {
      const iso = new Date(departureTime).toISOString();
      const data = await fetchRoute(from, to, mode, iso);
      setResult(data);
      setRouteTime(departureTime);
      // Auto-fetch AI tips in the background without blocking route display
      setTipsLoading(true);
      fetchTips(data.safety_score, data.hotspots, iso, mode)
        .then((tips) => { setTipsOverride(tips); setRouteTime(departureTime); })
        .catch(() => { /* keep fallback tips on failure */ })
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
      const iso = new Date(departureTime).toISOString();
      const data = await fetchTips(
        result.safety_score,
        result.avoids.areas,
        iso,
        mode
      );
      setTipsOverride(data);
      setRouteTime(departureTime);
    } catch {
      // silently keep existing tips on failure
    } finally {
      setTipsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-white dark:bg-black flex flex-col items-center justify-start px-6 py-12">
      <main className="max-w-xl w-full flex flex-col gap-10">
        {/* Header */}
        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
            Anthropic × Claude × Amsterdam × 2026
          </p>
          <h1 className="text-4xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50 leading-tight">
            Stella.app
          </h1>
          {/* Hero stat */}
          <div className="rounded-lg bg-zinc-950 dark:bg-zinc-900 px-4 py-3 flex flex-col gap-1">
            <p className="text-2xl font-bold text-white leading-tight">78%</p>
            <p className="text-sm text-zinc-300 leading-snug">
              of young Amsterdam women feel unsafe cycling at night.
            </p>
            <p className="text-xs text-zinc-400 mt-0.5 italic">
              We&apos;re changing that — and giving women back the night.
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
              From
            </label>
            <AddressInput
              placeholder="e.g. Centraal Station, Amsterdam"
              onSelect={setFrom}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
              To
            </label>
            <AddressInput
              placeholder="e.g. Vondelpark, Amsterdam"
              onSelect={setTo}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
              Mode
            </label>
            <div className="flex gap-2">
              {(["bicycling", "walking"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                    mode === m
                      ? "bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 border-zinc-900 dark:border-zinc-50"
                      : "bg-transparent text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600"
                  }`}
                >
                  {m === "bicycling" ? "Cycling" : "Walking"}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label
              htmlFor="departure-time"
              className="text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500"
            >
              Departure time
            </label>
            <input
              id="departure-time"
              type="datetime-local"
              value={departureTime}
              onChange={(e) => setDepartureTime(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 px-4 py-3 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-600 text-sm"
            />
            {isPast(departureTime) && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                This time is in the past — safety scores will reflect those conditions.
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || !from || !to}
            className="w-full py-3 rounded-lg bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
          >
            {loading ? "Finding safest route…" : "Find safest route"}
          </button>
        </form>

        {error && (
          <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
        )}

        {/* Update tips banner — shown when time changed after route loaded */}
        {timeChanged && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-4 py-3">
            <p className="text-sm text-amber-800 dark:text-amber-300">
              Departure time changed — update tips for the new time?
            </p>
            <button
              onClick={handleUpdateTips}
              disabled={tipsLoading}
              className="shrink-0 rounded-lg bg-amber-800 dark:bg-amber-600 text-white text-xs font-semibold px-3 py-1.5 hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {tipsLoading ? "Updating…" : "Update tips"}
            </button>
          </div>
        )}

        {result && (
          <RouteResult
            result={result}
            tipsOverride={tipsOverride}
            tipsLoading={tipsLoading}
          />
        )}
      </main>
    </div>
  );
}
