"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { AddressInput } from "@/components/AddressInput";
import { MapPreview } from "@/components/MapPreview";

interface RouteResult {
  summary: string;
  distance_text: string;
  duration_text: string;
  polyline: string;
  start_location: { lat: number; lng: number };
  end_location: { lat: number; lng: number };
}

interface RoutesResponse {
  routes: RouteResult[];
  mode: string;
}

export default function Home() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [mode, setMode] = useState<"bicycling" | "walking">("bicycling");
  const [results, setResults] = useState<RouteResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResults(null);
    setLoading(true);
    try {
      const data = await apiFetch<RoutesResponse>(
        `/routes?origin=${encodeURIComponent(from)}&destination=${encodeURIComponent(to)}&mode=${mode}`
      );
      setResults(data.routes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-white dark:bg-black flex flex-col items-center justify-center px-6">
      <main className="max-w-xl w-full flex flex-col gap-10">
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
            Anthropic × Claude × Amsterdam × 2026
          </p>
          <h1 className="text-4xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50 leading-tight">
            Stella.app
          </h1>
          <p className="text-base text-zinc-500 dark:text-zinc-400">
            Find the safest route through Amsterdam.
          </p>
        </div>

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

          <div className="flex gap-3">
            {(["bicycling", "walking"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  mode === m
                    ? "bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 border-zinc-900 dark:border-zinc-50"
                    : "bg-transparent text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600"
                }`}
              >
                {m === "bicycling" ? "Cycling" : "Walking"}
              </button>
            ))}
          </div>

          <button
            type="submit"
            disabled={loading || !from || !to}
            className="w-full py-3 rounded-lg bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
          >
            {loading ? "Finding route…" : "Find safest route"}
          </button>
        </form>

        {error && (
          <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
        )}

        {results && results.length > 0 && (
          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
              {results.length} route{results.length > 1 ? "s" : ""} found
            </p>
            {results.map((r, i) => (
              <div
                key={i}
                className="rounded-lg border border-zinc-200 dark:border-zinc-800 px-4 py-3 flex flex-col gap-1"
              >
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {r.summary || `Route ${i + 1}`}
                </p>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  {r.distance_text} · {r.duration_text}
                </p>
              </div>
            ))}
            <MapPreview
              polyline={results[0].polyline}
              startLocation={results[0].start_location}
              endLocation={results[0].end_location}
            />
          </div>
        )}
      </main>
    </div>
  );
}
