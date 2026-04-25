"use client";

import { useState } from "react";
import { MapPreview } from "@/components/MapPreview";
import type { RouteResponse } from "@/lib/api";

interface Props {
  result: RouteResponse;
  onBack: () => void;
}

export function PostRouteCheckin({ result, onBack }: Props) {
  const [rating, setRating] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const { route } = result;

  function handleRate(n: number) {
    setRating(n);
    setTimeout(() => setSubmitted(true), 300);
  }

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "var(--stella-navy)" }}>
      {/* Map */}
      <div className="w-full relative" style={{ height: "240px" }}>
        <MapPreview
          polyline={route.polyline}
          startLocation={route.start_location}
          endLocation={route.end_location}
          dark
        />
        <button
          onClick={onBack}
          className="absolute top-3 left-3 z-10 flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl"
          style={{ background: "rgba(7,11,53,0.85)", color: "rgba(255,255,255,0.9)", backdropFilter: "blur(4px)" }}
        >
          ← Route
        </button>
      </div>

      <div className="flex-1 flex flex-col px-5 py-8 gap-6 max-w-md mx-auto w-full">
        {/* Arrived message */}
        <div className="flex flex-col gap-1">
          <p className="text-2xl font-black" style={{ color: "var(--stella-yellow)" }}>
            ✦ You arrived safely.
          </p>
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>
            {route.distance_text} · {route.duration_text}
          </p>
        </div>

        {!submitted ? (
          <div
            className="rounded-2xl px-4 py-5 flex flex-col gap-4"
            style={{ background: "var(--stella-navy-card)", border: "1px solid var(--stella-border)" }}
          >
            <p className="text-sm font-semibold text-white">How safe did you feel?</p>
            <div className="flex gap-3">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => handleRate(n)}
                  className="flex-1 aspect-square rounded-full flex items-center justify-center font-bold text-base transition-all"
                  style={
                    rating === n
                      ? { background: "var(--stella-yellow)", color: "var(--stella-navy)", transform: "scale(1.1)" }
                      : { background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)", border: "1px solid var(--stella-border)" }
                  }
                >
                  {n}
                </button>
              ))}
            </div>
            <p className="text-xs text-center" style={{ color: "var(--stella-muted)" }}>
              1 = unsafe · 5 = very safe
            </p>
          </div>
        ) : (
          <div
            className="rounded-2xl px-4 py-5 flex flex-col items-center gap-2"
            style={{ background: "rgba(255,229,0,0.06)", border: "1px solid rgba(255,229,0,0.2)" }}
          >
            <p className="text-2xl">{rating && rating >= 4 ? "🌟" : rating === 3 ? "💛" : "💪"}</p>
            <p className="font-bold text-white text-center">Thank you for your feedback!</p>
            <p className="text-sm text-center" style={{ color: "rgba(255,255,255,0.6)" }}>
              Your rating helps improve routes for all women in Amsterdam.
            </p>
          </div>
        )}

        <button
          onClick={onBack}
          className="w-full py-3.5 rounded-2xl font-semibold text-sm transition-opacity hover:opacity-80"
          style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px solid var(--stella-border)",
            color: "rgba(255,255,255,0.85)",
          }}
        >
          Plan another route
        </button>
      </div>
    </div>
  );
}
