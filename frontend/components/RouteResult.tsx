"use client";

import { MapPreview } from "@/components/MapPreview";
import type { RouteAvoids, RouteResponse } from "@/lib/api";

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 8
      ? "#22c55e"
      : score >= 5
        ? "#f59e0b"
        : "#ef4444";
  const label = score >= 8 ? "Safe" : score >= 5 ? "Moderate" : "Caution";
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold"
      style={{ background: color + "22", color, border: `1px solid ${color}44` }}
    >
      <span className="text-sm font-black">{score.toFixed(1)}</span>
      <span>/10 · {label}</span>
    </span>
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

function AvoidCard({ area }: { area: string }) {
  const kindMap: Record<string, string> = {
    "incident hotspots": "incidents",
    "areas without camera coverage": "no CCTV",
    "poorly lit streets": "dark",
    "areas with frequent incident reports": "incidents",
    "isolated paths": "isolated",
  };
  const kind = kindMap[area] ?? "avoided";
  const display = area.charAt(0).toUpperCase() + area.slice(1);
  return (
    <div
      className="rounded-xl px-4 py-3 flex items-center justify-between gap-3"
      style={{ background: "rgba(255,229,0,0.06)", border: "1px solid rgba(255,229,0,0.15)" }}
    >
      <span className="font-bold text-sm" style={{ color: "var(--stella-yellow)" }}>{display}</span>
      <span
        className="text-[10px] font-semibold uppercase tracking-wider rounded-full px-2 py-0.5"
        style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)" }}
      >
        {kind}
      </span>
    </div>
  );
}

interface Props {
  result: RouteResponse;
  tipsOverride?: { avoids: RouteAvoids; tips: string[]; ai_status: "ok" | "fallback" } | null;
  tipsLoading?: boolean;
  onBack: () => void;
  onArrived: () => void;
}

export function RouteResult({ result, tipsOverride, tipsLoading, onBack, onArrived }: Props) {
  const { route, safety_score, mode } = result;

  const avoids = tipsOverride?.avoids ?? result.avoids;
  const tips = tipsOverride?.tips ?? result.tips;
  const ai_status = tipsOverride?.ai_status ?? result.ai_status;

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "var(--stella-navy)" }}>
      {/* Map — full width, fixed height */}
      <div className="w-full relative" style={{ height: "240px" }}>
        <MapPreview
          polyline={route.polyline}
          startLocation={route.start_location}
          endLocation={route.end_location}
          dark
        />
        {/* Back button */}
        <button
          onClick={onBack}
          className="absolute top-3 left-3 z-10 flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl"
          style={{ background: "rgba(7,11,53,0.85)", color: "rgba(255,255,255,0.9)", backdropFilter: "blur(4px)" }}
        >
          ← Back
        </button>
      </div>

      {/* Content card */}
      <div className="flex-1 flex flex-col px-5 py-5 gap-5 max-w-md mx-auto w-full">
        {/* Route meta */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--stella-muted)" }}>
              Safest route
            </p>
            <p className="text-sm font-medium text-white">
              {route.distance_text} · {route.duration_text}
            </p>
          </div>
          <ScoreBadge score={safety_score} />
        </div>

        {/* Route avoids */}
        {avoids.areas.length > 0 && (
          <div className={`flex flex-col gap-2 transition-opacity ${tipsLoading ? "opacity-50" : ""}`}>
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--stella-muted)" }}>
              Route avoids
            </p>
            {avoids.areas.map((area) => (
              <AvoidCard key={area} area={area} />
            ))}
            {avoids.summary && (
              <p className="text-sm mt-1 leading-relaxed" style={{ color: "rgba(255,255,255,0.65)" }}>
                {avoids.summary}
              </p>
            )}
          </div>
        )}

        {/* AI Tip */}
        {tips.length > 0 && (
          <div
            className={`rounded-2xl px-4 py-4 flex flex-col gap-3 transition-opacity ${tipsLoading ? "opacity-50" : ""}`}
            style={{ background: "var(--stella-navy-card)", border: "1px solid var(--stella-border)" }}
          >
            <div className="flex items-center gap-2">
              <span
                className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
                style={{ background: "var(--stella-yellow)", color: "var(--stella-navy)" }}
              >
                ✦ AI tip{ai_status === "fallback" ? " (general)" : ""}
              </span>
              {tipsLoading && (
                <span className="text-xs" style={{ color: "var(--stella-muted)" }}>updating…</span>
              )}
            </div>
            <ul className="flex flex-col gap-2.5">
              {tips.map((tip, i) => (
                <li key={i} className="flex gap-2.5 text-sm" style={{ color: "rgba(255,255,255,0.8)" }}>
                  <span
                    className="mt-0.5 h-4 w-4 shrink-0 rounded-full flex items-center justify-center text-[9px] font-black"
                    style={{ background: "rgba(255,229,0,0.15)", color: "var(--stella-yellow)" }}
                  >
                    {i + 1}
                  </span>
                  {tip}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-col gap-2 mt-auto pt-2">
          <button
            onClick={onArrived}
            className="w-full py-3.5 rounded-2xl font-bold text-sm transition-opacity hover:opacity-90"
            style={{ background: "var(--stella-yellow)", color: "var(--stella-navy)" }}
          >
            📍 I&apos;ve arrived — check in
          </button>
          <a
            href={googleMapsUrl(route.start_location, route.end_location, mode)}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-3.5 rounded-2xl font-semibold text-sm text-center transition-colors hover:opacity-80"
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid var(--stella-border)",
              color: "rgba(255,255,255,0.85)",
            }}
          >
            Open in Google Maps →
          </a>
        </div>
      </div>
    </div>
  );
}
