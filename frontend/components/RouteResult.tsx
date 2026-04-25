"use client";

import { useState } from "react";
import { MapPreview } from "@/components/MapPreview";
import type { RouteAvoids, RouteResponse } from "@/lib/api";

const Y  = "#ffff05";
const BD = "#000099";

function googleMapsUrl(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  mode: string,
  fromAddress?: string,
  toAddress?: string,
): string {
  const tm = mode === "bicycling" ? "bicycling" : "walking";
  const o = fromAddress ? encodeURIComponent(fromAddress) : `${origin.lat},${origin.lng}`;
  const d = toAddress   ? encodeURIComponent(toAddress)   : `${destination.lat},${destination.lng}`;
  return `https://www.google.com/maps/dir/?api=1&origin=${o}&destination=${d}&travelmode=${tm}`;
}

function EtaSheet({ onClose, route, toAddress }: { onClose: () => void; route: { duration_text: string; summary: string }; toAddress?: string }) {
  const [copied, setCopied] = useState(false);
  const [signalCopied, setSignalCopied] = useState(false);

  const eta = new Date();
  const durationMin = parseInt(route.duration_text) || 15;
  eta.setMinutes(eta.getMinutes() + durationMin);
  const etaStr = eta.toLocaleTimeString("en-NL", { hour: "2-digit", minute: "2-digit", hour12: true });

  const destination = toAddress || route.summary || "home";
  const message = `stella. I'm on my way to ${destination} ✦\nETA: ${etaStr} — ${route.duration_text} from now.\nRoute: ${route.summary || "safest path"}.`;

  function handleCopy() {
    navigator.clipboard.writeText(message).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  function handleSignal() {
    navigator.clipboard.writeText(message).catch(() => {});
    setSignalCopied(true);
    setTimeout(() => { setSignalCopied(false); }, 2000);
    // Signal has no pre-fill URL — copy message then open the app
    window.location.href = "sgnl://";
  }

  return (
    <div
      style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 900, display: "flex", alignItems: "flex-end" }}
      onClick={onClose}
    >
      <div
        className="eta-sheet"
        style={{ width: "100%", background: "#001080", borderRadius: "22px 22px 0 0", padding: "0 18px 36px" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ width: "36px", height: "4px", background: "rgba(255,255,255,0.2)", borderRadius: "2px", margin: "14px auto 18px" }} />

        {/* Message preview */}
        <div style={{ background: "rgba(255,255,255,0.07)", borderRadius: "13px", padding: "14px 15px", marginBottom: "16px", border: "1px solid rgba(255,255,255,0.1)", lineHeight: 1.65, fontSize: "15px" }}>
          <span style={{ color: Y, fontWeight: 700 }}>stella.</span>
          <span style={{ color: "#fff" }}> I'm on my way to {destination} ✦</span><br />
          <span style={{ color: "#fff", fontWeight: 700 }}>ETA: {etaStr}</span>
          <span style={{ color: "#fff" }}> — {route.duration_text} from now.</span><br />
          <span style={{ color: "rgba(255,255,255,0.65)", fontSize: "14px" }}>Route: {route.summary || "safest path"}.</span>
        </div>

        {[
          { label: "WhatsApp",                                     bg: "#25D366",             icon: "💬", href: `https://wa.me/?text=${encodeURIComponent(message)}` },
          { label: signalCopied ? "Copied — paste in Signal!" : "Signal", bg: "#2C6BED",     icon: "🔒", onClick: handleSignal },
          { label: copied ? "Copied!" : "Copy message",            bg: "rgba(255,255,255,0.1)", icon: "📋", onClick: handleCopy },
        ].map((btn) => (
          btn.href ? (
            <a key={btn.label} href={btn.href} target="_blank" rel="noopener noreferrer" style={{
              display: "flex", alignItems: "center", gap: "11px",
              width: "100%", padding: "15px 18px", borderRadius: "13px",
              background: btn.bg, marginBottom: "8px",
              color: "#fff", fontFamily: "inherit", fontWeight: 700, fontSize: "16px",
              textDecoration: "none",
            }}>
              <span style={{ fontSize: "18px" }}>{btn.icon}</span>{btn.label}
            </a>
          ) : (
            <button key={btn.label} onClick={btn.onClick} style={{
              width: "100%", padding: "15px 18px", borderRadius: "13px",
              background: btn.bg, border: "none", marginBottom: "8px",
              color: "#fff", fontFamily: "inherit", fontWeight: 700, fontSize: "16px",
              cursor: "pointer", display: "flex", alignItems: "center", gap: "11px",
            }}>
              <span style={{ fontSize: "18px" }}>{btn.icon}</span>{btn.label}
            </button>
          )
        ))}

        <button onClick={onClose} style={{
          width: "100%", padding: "14px", borderRadius: "12px",
          background: "transparent", border: "none",
          color: "rgba(255,255,255,0.38)", fontFamily: "inherit", fontSize: "16px", cursor: "pointer",
        }}>Cancel</button>
      </div>
    </div>
  );
}

interface Props {
  result: RouteResponse;
  fromAddress?: string;
  toAddress?: string;
  tipsOverride?: { avoids: RouteAvoids; tips: string[]; ai_status: "ok" | "fallback" } | null;
  tipsLoading?: boolean;
  timeChanged?: boolean;
  onUpdateTips?: () => void;
  onBack: () => void;
  onArrived: () => void;
}

export function RouteResult({ result, fromAddress, toAddress, tipsOverride, tipsLoading, timeChanged, onUpdateTips, onBack, onArrived }: Props) {
  const [etaOpen, setEtaOpen] = useState(false);
  const { route, safety_score, mode } = result;

  // Always use the deterministic scorer's areas — they come from hotspot data
  // and are reliable. Only take the AI's narrative summary when available.
  const avoidAreas   = result.avoids.areas;
  const avoidSummary = tipsOverride?.avoids?.summary || result.avoids.summary;
  const tips         = tipsOverride?.tips ?? result.tips;
  const ai_status    = tipsOverride?.ai_status ?? result.ai_status;

  const routeLabel = route.duration_text;

  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", background: BD, position: "relative", overflow: "hidden", fontFamily: "var(--font-space-grotesk), 'Space Grotesk', sans-serif" }}>

      {/* Time-changed banner */}
      {timeChanged && (
        <div style={{ background: "rgba(255,255,5,0.12)", borderBottom: "1px solid rgba(255,255,5,0.25)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", padding: "10px 18px" }}>
          <span style={{ color: Y, fontSize: "13px", fontWeight: 500 }}>Time changed — update tips?</span>
          <button onClick={onUpdateTips} disabled={tipsLoading}
            style={{ background: Y, border: "none", color: "#000", fontWeight: 700, fontSize: "12px", padding: "6px 14px", borderRadius: "10px", cursor: "pointer", fontFamily: "inherit", opacity: tipsLoading ? 0.6 : 1 }}>
            {tipsLoading ? "Updating…" : "Update"}
          </button>
        </div>
      )}

      {/* Map — capped at 38% of viewport so the panel always has room on small phones */}
      <div style={{ position: "relative", height: "min(260px, 38dvh)", flexShrink: 0 }}>
        <MapPreview
          polyline={route.polyline}
          startLocation={route.start_location}
          endLocation={route.end_location}
          showRoute
        />

        {/* Back button */}
        <button onClick={onBack} style={{
          position: "absolute", top: 12, left: 12, zIndex: 600,
          background: BD, borderRadius: "20px", padding: "7px 14px",
          color: "rgba(255,255,255,0.8)", fontWeight: 700, fontSize: "13px",
          border: "1px solid rgba(255,255,255,0.14)", cursor: "pointer",
          boxShadow: "0 2px 12px rgba(0,0,0,0.5)", fontFamily: "inherit",
        }}>← Back</button>

        {/* Route pill */}
        <div style={{
          position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)",
          background: BD, borderRadius: "20px", padding: "7px 15px",
          color: Y, fontWeight: 700, fontSize: "13px",
          zIndex: 600, whiteSpace: "nowrap",
          border: "1px solid rgba(255,255,255,0.14)",
          boxShadow: "0 2px 12px rgba(0,0,0,0.5)",
        }}>{routeLabel}</div>

        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "56px", background: `linear-gradient(transparent, ${BD})`, pointerEvents: "none", zIndex: 500 }} />
      </div>

      {/* Panel — minHeight:0 is required so the flex child can shrink and overflow-y:auto works */}
      <div className="panel-scroll" style={{ flex: 1, minHeight: 0, padding: "14px 18px 24px", display: "flex", flexDirection: "column", gap: "11px", overflowAnchor: "none" }}>

        {/* From / To bar */}
        <button onClick={onBack} style={{
          display: "flex", alignItems: "center", gap: "10px",
          background: "rgba(255,255,255,0.06)", borderRadius: "12px",
          padding: "11px 14px", border: "1px solid rgba(255,255,255,0.08)",
          cursor: "pointer", textAlign: "left", width: "100%", fontFamily: "inherit",
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "7px", marginBottom: "5px" }}>
              <div style={{ width: 8, height: 8, background: Y, borderRadius: "50%", flexShrink: 0 }} />
              <span style={{ color: "rgba(255,255,255,0.6)", fontSize: "12px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {fromAddress || "Start"}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
              <div style={{ width: 8, height: 8, border: `2px solid ${Y}`, borderRadius: "50%", flexShrink: 0 }} />
              <span style={{ color: "#fff", fontSize: "12px", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {toAddress || "Destination"}
              </span>
            </div>
          </div>
          <span style={{ color: Y, fontSize: "12px", fontWeight: 700, flexShrink: 0 }}>Edit ✎</span>
        </button>

        <div style={{ color: "rgba(255,255,255,0.38)", fontSize: "11px", fontWeight: 700, letterSpacing: "0.13em", textTransform: "uppercase" }}>
          Route avoids
        </div>

        {/* Avoidance cards */}
        {avoidAreas.length > 0 ? (
          <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: "14px", overflow: "hidden", border: "1px solid rgba(255,255,255,0.07)" }}>
            <div style={{ height: "3px", background: Y }} />
            <div style={{ padding: "13px 15px" }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: avoidSummary ? "10px" : 0 }}>
                {avoidAreas.map((area) => {
                  const kindMap: Record<string, string> = {
                    "incident hotspots": "INCIDENTS", "areas without camera coverage": "NO CCTV",
                    "poorly lit streets": "DARK", "isolated paths": "ISOLATED",
                    "areas with frequent incident reports": "INCIDENTS",
                  };
                  const kind = kindMap[area] ?? "AVOIDED";
                  return (
                    <div key={area} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span style={{ color: Y, fontWeight: 700, fontSize: "17px" }}>
                        {area.charAt(0).toUpperCase() + area.slice(1)}
                      </span>
                      <span style={{ background: "rgba(255,255,255,0.1)", borderRadius: "6px", padding: "2px 7px", color: "rgba(255,255,255,0.5)", fontSize: "10px", fontWeight: 700 }}>{kind}</span>
                    </div>
                  );
                })}
              </div>
              {avoidSummary && (
                <div style={{ color: "rgba(255,255,255,0.55)", fontSize: "13px", lineHeight: 1.5 }}>{avoidSummary}</div>
              )}
            </div>
          </div>
        ) : (
          <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: "14px", overflow: "hidden", border: "1px solid rgba(255,255,255,0.07)" }}>
            <div style={{ height: "3px", background: Y }} />
            <div style={{ padding: "13px 15px" }}>
              <div style={{ color: Y, fontWeight: 700, fontSize: "17px", marginBottom: "5px" }}>Safest available route</div>
              <div style={{ color: "rgba(255,255,255,0.55)", fontSize: "13px", lineHeight: 1.5 }}>{avoidSummary || "No specific hazards identified on this route."}</div>
            </div>
          </div>
        )}

        {/* AI TIP */}
        {tips.length > 0 && (
          <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: "14px", padding: "13px 15px", border: "1px solid rgba(255,255,255,0.07)", opacity: tipsLoading ? 0.55 : 1, transition: "opacity 0.2s" }}>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: "5px",
              background: "linear-gradient(125deg, rgba(110,70,210,0.85) 0%, rgba(190,80,210,0.85) 100%)",
              borderRadius: "20px", padding: "3px 11px", marginBottom: "9px",
            }}>
              <span style={{ color: "#fff", fontSize: "10px", fontWeight: 700, letterSpacing: "0.05em" }}>
                ✦ AI TIP{ai_status === "fallback" ? " (general)" : ""}{tipsLoading ? " — updating…" : ""}
              </span>
            </div>
            <p style={{ color: "rgba(255,255,255,0.82)", fontSize: "14px", lineHeight: 1.55 }}>
              {tips[0]}
            </p>
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: "flex", gap: "10px", paddingTop: "6px" }}>
          <button onClick={() => setEtaOpen(true)} style={{
            flex: "0 0 auto", padding: "14px 16px", borderRadius: "12px",
            background: "transparent", border: "1.5px solid rgba(255,255,255,0.3)",
            color: "#fff", fontFamily: "inherit", fontWeight: 700, fontSize: "14px",
            cursor: "pointer", display: "flex", alignItems: "center", gap: "7px", whiteSpace: "nowrap",
          }}>📍 Send ETA</button>
          <a
            href={googleMapsUrl(route.start_location, route.end_location, mode, fromAddress, toAddress)}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              flex: 1, padding: "14px", borderRadius: "12px",
              background: Y, border: "none",
              color: "#000", fontFamily: "inherit", fontWeight: 700, fontSize: "14px",
              cursor: "pointer", whiteSpace: "nowrap", textAlign: "center",
              textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >Open in Google Maps →</a>
        </div>

        {/* Arrived check-in */}
        <button onClick={onArrived} style={{
          width: "100%", padding: "12px", borderRadius: "11px",
          background: "transparent", border: "1px solid rgba(255,255,255,0.15)",
          color: "rgba(255,255,255,0.45)", fontFamily: "inherit", fontSize: "14px", cursor: "pointer",
        }}>✦ I've arrived — check in</button>
      </div>

      {/* ETA bottom sheet */}
      {etaOpen && <EtaSheet onClose={() => setEtaOpen(false)} route={route} toAddress={toAddress} />}
    </div>
  );
}
