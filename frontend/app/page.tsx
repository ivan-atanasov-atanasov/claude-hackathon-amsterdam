"use client";

import { useState } from "react";
import { fetchRoute } from "@/lib/api";
import type { RouteResponse } from "@/lib/api";
import { AddressInput } from "@/components/AddressInput";
import { RouteResult } from "@/components/RouteResult";

function defaultDepartureTime(): string {
  const d = new Date();
  d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
  // datetime-local expects "YYYY-MM-DDTHH:mm"
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function Home() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [mode, setMode] = useState<"bicycling" | "walking">("bicycling");
  const [departureTime, setDepartureTime] = useState(defaultDepartureTime);
  const [result, setResult] = useState<RouteResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      // Convert datetime-local value to ISO 8601 with offset
      const iso = new Date(departureTime).toISOString();
      const data = await fetchRoute(from, to, mode, iso);
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-white dark:bg-black flex flex-col items-center justify-start px-6 py-12">
      <main className="max-w-xl w-full flex flex-col gap-10">
        {/* Header */}
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
            Anthropic × Claude × Amsterdam × 2026
          </p>
          <h1 className="text-4xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50 leading-tight">
            Stella.app
          </h1>
          <p className="text-base text-zinc-500 dark:text-zinc-400">
            Find the safest cycling route through Amsterdam.
          </p>
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

          {/* Mode + Time row */}
          <div className="flex gap-3">
            <div className="flex flex-col gap-1 flex-1">
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

        {result && <RouteResult result={result} />}
      </main>
    </div>
  );
}
