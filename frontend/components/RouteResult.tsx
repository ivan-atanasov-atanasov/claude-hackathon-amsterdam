"use client";

import { MapPreview } from "@/components/MapPreview";
import type { RouteResponse } from "@/lib/api";

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 8
      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
      : score >= 5
        ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
        : "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300";

  const label = score >= 8 ? "Safe" : score >= 5 ? "Moderate" : "Use caution";

  return (
    <div className="flex items-center gap-2">
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${color}`}
      >
        <span className="text-base font-bold">{score.toFixed(1)}</span>
        <span>/10 · {label}</span>
      </span>
    </div>
  );
}

function googleMapsUrl(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  mode: string
): string {
  const travelmode = mode === "bicycling" ? "bicycling" : "walking";
  return `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}&travelmode=${travelmode}`;
}

interface Props {
  result: RouteResponse;
}

export function RouteResult({ result }: Props) {
  const { route, safety_score, avoids, tips, ai_status, mode } = result;

  return (
    <div className="flex flex-col gap-5">
      {/* Score + meta */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
            Safest route
          </p>
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {route.distance_text} · {route.duration_text}
          </p>
        </div>
        <ScoreBadge score={safety_score} />
      </div>

      {/* Map */}
      <MapPreview
        polyline={route.polyline}
        startLocation={route.start_location}
        endLocation={route.end_location}
      />

      {/* Avoidance summary */}
      {avoids.summary && (
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 px-4 py-3 flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
            Route avoids
          </p>
          <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
            {avoids.summary}
          </p>
          {avoids.areas.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {avoids.areas.map((area) => (
                <span
                  key={area}
                  className="rounded-full bg-zinc-200 dark:bg-zinc-800 px-2.5 py-0.5 text-xs text-zinc-600 dark:text-zinc-400"
                >
                  {area}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Safety tips */}
      {tips.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
            Safety tips{ai_status === "fallback" && " (general)"}
          </p>
          <ul className="flex flex-col gap-2">
            {tips.map((tip, i) => (
              <li key={i} className="flex gap-2.5 text-sm text-zinc-700 dark:text-zinc-300">
                <span className="mt-0.5 h-4 w-4 shrink-0 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-[10px] font-bold text-zinc-500 dark:text-zinc-400">
                  {i + 1}
                </span>
                {tip}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Open in Google Maps */}
      <a
        href={googleMapsUrl(route.start_location, route.end_location, mode)}
        target="_blank"
        rel="noopener noreferrer"
        className="w-full py-3 rounded-lg border border-zinc-200 dark:border-zinc-800 text-center text-sm font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
      >
        Open in Google Maps →
      </a>
    </div>
  );
}
