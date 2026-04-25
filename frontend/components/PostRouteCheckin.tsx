"use client";

import { useState } from "react";
import { MapPreview } from "@/components/MapPreview";
import type { RouteResponse } from "@/lib/api";

const Y  = "#ffff05";
const BD = "#000099";

interface Props {
  result: RouteResponse;
  onBack: () => void;
  onReset: () => void;
}

export function PostRouteCheckin({ result, onBack, onReset }: Props) {
  const [rating, setRating] = useState<number | null>(null);
  const { route } = result;

  const isLow  = rating !== null && rating <= 3;
  const isHigh = rating !== null && rating >= 4;

  function btnStyle(n: number): React.CSSProperties {
    const base: React.CSSProperties = {
      flex: 1, padding: "14px 0", borderRadius: "12px",
      fontFamily: "inherit", fontWeight: 700, fontSize: "18px",
      cursor: "pointer", border: "none",
    };
    if (rating === null) return { ...base, background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.55)", border: "1px solid rgba(255,255,255,0.12)" };
    if (isLow) {
      if (n === rating) return { ...base, background: "#CC2200", color: "#fff", border: "2px solid #ff4422" };
      if (n < rating)  return { ...base, background: "rgba(180,40,0,0.55)", color: "rgba(255,255,255,0.7)", border: "1px solid rgba(180,40,0,0.3)" };
      return { ...base, background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.28)", border: "1px solid rgba(255,255,255,0.08)" };
    }
    // isHigh (4–5)
    if (n <= (rating ?? 0)) return { ...base, background: Y, color: "#000", border: "none" };
    return { ...base, background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.28)", border: "1px solid rgba(255,255,255,0.08)" };
  }

  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", background: BD, fontFamily: "var(--font-space-grotesk), 'Space Grotesk', sans-serif" }}>

      {/* Map */}
      <div style={{ position: "relative", height: "320px", flexShrink: 0 }}>
        <MapPreview
          polyline={route.polyline}
          startLocation={route.start_location}
          endLocation={route.end_location}
          showRoute
        />
        <button onClick={onBack} style={{
          position: "absolute", top: 12, left: 12, zIndex: 600,
          background: BD, borderRadius: "20px", padding: "7px 14px",
          color: "rgba(255,255,255,0.8)", fontWeight: 700, fontSize: "13px",
          border: "1px solid rgba(255,255,255,0.14)", cursor: "pointer",
          boxShadow: "0 2px 12px rgba(0,0,0,0.5)", fontFamily: "inherit",
        }}>← Route</button>
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "56px", background: `linear-gradient(transparent, ${BD})`, pointerEvents: "none", zIndex: 500 }} />
      </div>

      {/* Panel */}
      <div className="panel-scroll" style={{ flex: 1, padding: "14px 18px 28px", display: "flex", flexDirection: "column", gap: "13px" }}>

        {/* Arrival banner */}
        <div style={{ background: Y, borderRadius: "14px", padding: "14px 18px", display: "flex", alignItems: "center", gap: "13px" }}>
          <span style={{ fontSize: "18px", color: "#000", flexShrink: 0 }}>✦</span>
          <div>
            <div style={{ color: "#000", fontWeight: 700, fontSize: "17px" }}>You arrived safely.</div>
            <div style={{ color: "rgba(0,0,0,0.55)", fontSize: "13px", marginTop: "1px" }}>
              {route.summary || "Amsterdam"} · {route.duration_text}
            </div>
          </div>
        </div>

        {/* Drag handle hint */}
        <div style={{ width: "32px", height: "3px", background: "rgba(255,255,255,0.15)", borderRadius: "2px", margin: "0 auto -4px" }} />

        {/* Rating */}
        <div>
          <div style={{ color: Y, fontWeight: 700, fontSize: "20px", marginBottom: "4px" }}>How safe did you feel?</div>
          <div style={{ color: "rgba(255,255,255,0.38)", fontSize: "13px", marginBottom: "12px" }}>1 = unsafe · 5 = completely safe</div>
          <div style={{ display: "flex", gap: "7px" }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} className="rating-btn" onClick={() => setRating(n)} style={btnStyle(n)}>{n}</button>
            ))}
          </div>
        </div>

        {/* Low rating card */}
        {isLow && (
          <div style={{ background: "rgba(160,30,0,0.22)", borderRadius: "13px", padding: "14px 16px", border: "1px solid rgba(200,50,0,0.35)" }}>
            <div style={{ color: "#fff", fontWeight: 700, fontSize: "15px", marginBottom: "4px" }}>We're sorry — that shouldn't happen.</div>
            <div style={{ color: "rgba(255,255,255,0.65)", fontSize: "13px", lineHeight: 1.5, marginBottom: "13px" }}>
              Report this location to the City of Amsterdam. It only takes a minute.
            </div>
            <a href="https://meldingen.amsterdam.nl" target="_blank" rel="noopener noreferrer" style={{
              display: "block", padding: "12px 14px", borderRadius: "10px",
              background: "#CC2200", color: "#fff",
              fontFamily: "inherit", fontWeight: 700, fontSize: "14px",
              textDecoration: "none", textAlign: "center",
            }}>Report to Amsterdam (melding maken) →</a>
          </div>
        )}

        {/* High rating card */}
        {isHigh && (
          <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: "13px", padding: "14px 16px", border: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "flex-start", gap: "11px" }}>
            <span style={{ color: Y, fontSize: "15px", marginTop: "1px", flexShrink: 0 }}>✦</span>
            <p style={{ color: "rgba(255,255,255,0.72)", fontSize: "14px", lineHeight: 1.55 }}>
              Thank you — your rating helps improve routes for women across Amsterdam.
            </p>
          </div>
        )}

        {/* Bottom actions */}
        <div style={{ marginTop: "auto", paddingTop: "6px" }}>
          <button onClick={onReset} style={{
            width: "100%", padding: "14px", borderRadius: "11px",
            background: "transparent", border: "none",
            color: "rgba(255,255,255,0.35)", fontFamily: "inherit", fontSize: "16px", cursor: "pointer",
          }}>Done</button>
        </div>
      </div>
    </div>
  );
}
