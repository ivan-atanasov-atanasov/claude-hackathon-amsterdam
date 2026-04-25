"use client";

import { useState } from "react";
import { MapPreview } from "@/components/MapPreview";
import type { RouteResponse } from "@/lib/api";

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
  onBack: () => void;
  onArrived: () => void;
}

const KIND_LABEL: Record<string, string> = {
  park: "PARK · DARK",
  square: "SQUARE",
  station: "STATION",
  corridor: "ISOLATED",
};

export function RouteResult({ result, fromAddress, toAddress, onBack, onArrived }: Props) {
  const [etaOpen, setEtaOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const { route, mode, alternative_route, alternative_safety_score, safety_score, avoidance_diff, chose_safer_than_google } = result;

  const routeLabel = route.duration_text;

  // Build a deduplicated list of specific reasons from the avoidance diff.
  // avoided_named is what the alternative passes through but Stella's route doesn't.
  const avoidedNamed = avoidance_diff?.avoided_named ?? [];
  const avoidedPointerCount = avoidance_diff?.avoided_pointer_count ?? 0;

  // Time/distance trade-off vs the alternative
  let comparison: { extraSec: number; extraM: number; scoreGain: number } | null = null;
  if (chose_safer_than_google && alternative_route) {
    comparison = {
      extraSec: route.duration_s - alternative_route.duration_s,
      extraM: route.distance_m - alternative_route.distance_m,
      scoreGain: alternative_safety_score != null ? safety_score - alternative_safety_score : 0,
    };
  }

  function fmtMin(seconds: number): string {
    const m = Math.round(Math.abs(seconds) / 60);
    if (m === 0) return "<1 min";
    return `${m} min`;
  }

  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", background: BD, position: "relative", overflow: "hidden", fontFamily: "var(--font-space-grotesk), 'Space Grotesk', sans-serif" }}>

      {/* Map — capped at 38% of viewport so the panel always has room on small phones */}
      <div style={{ position: "relative", height: "min(260px, 38dvh)", flexShrink: 0 }}>
        <MapPreview
          polyline={route.polyline}
          alternativePolyline={alternative_route?.polyline}
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

        {/* Comparison summary: how does Stella's route differ from Google's default? */}
        {comparison && (
          <div style={{ display: "flex", alignItems: "center", gap: "10px", background: "rgba(255,255,5,0.08)", border: "1px solid rgba(255,255,5,0.22)", borderRadius: "12px", padding: "10px 13px" }}>
            <div style={{ width: 14, height: 4, background: "#3B5BDB", borderRadius: 2, flexShrink: 0 }} />
            <span style={{ color: "#fff", fontSize: "13px", fontWeight: 600, flex: 1, lineHeight: 1.35 }}>
              {comparison.extraSec > 30
                ? <>+{fmtMin(comparison.extraSec)} longer than the fastest route — but safer.</>
                : comparison.extraSec < -30
                  ? <>{fmtMin(comparison.extraSec)} faster <span style={{ color: "rgba(255,255,255,0.7)" }}>and</span> safer.</>
                  : <>Same time as the fastest route — and safer.</>
              }
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
              <div style={{ width: 14, height: 0, borderTop: "2px dashed #ff3322" }} />
              <span style={{ color: "rgba(255,255,255,0.55)", fontSize: "11px" }}>fastest</span>
            </div>
          </div>
        )}

        <div style={{ color: "rgba(255,255,255,0.38)", fontSize: "11px", fontWeight: 700, letterSpacing: "0.13em", textTransform: "uppercase" }}>
          About Stella
        </div>

        {/* Why is this a safer route? — specific avoidances from Pointer + named hotspots */}
        <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: "14px", border: "1px solid rgba(255,255,255,0.07)" }}>
          <div style={{ height: "3px", background: Y, borderRadius: "14px 14px 0 0" }} />
          <div style={{ padding: "13px 15px" }}>
            <div style={{ color: Y, fontWeight: 700, fontSize: "16px", marginBottom: "9px" }}>
              Why is this a safer route?
            </div>

            {(avoidedNamed.length > 0 || avoidedPointerCount > 0) ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {avoidedNamed.map((a) => (
                  <div key={a.name} style={{ display: "flex", alignItems: "flex-start", gap: "9px" }}>
                    <span style={{ color: Y, fontSize: "14px", lineHeight: "20px", flexShrink: 0 }}>✦</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "7px", flexWrap: "wrap" }}>
                        <span style={{ color: "#fff", fontWeight: 700, fontSize: "14px" }}>{a.name}</span>
                        <span style={{ background: "rgba(255,255,255,0.1)", borderRadius: "5px", padding: "1px 6px", color: "rgba(255,255,255,0.55)", fontSize: "9px", fontWeight: 700, letterSpacing: "0.05em" }}>
                          {KIND_LABEL[a.kind] ?? a.kind.toUpperCase()}
                        </span>
                      </div>
                      <div style={{ color: "rgba(255,255,255,0.55)", fontSize: "12.5px", lineHeight: 1.45, marginTop: "1px" }}>
                        {a.reason}
                      </div>
                    </div>
                  </div>
                ))}
                {avoidedPointerCount > 0 && (
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "9px" }}>
                    <span style={{ color: Y, fontSize: "14px", lineHeight: "20px", flexShrink: 0 }}>✦</span>
                    <div>
                      <div style={{ color: "#fff", fontWeight: 700, fontSize: "14px" }}>
                        {avoidedPointerCount} user-reported unsafe spot{avoidedPointerCount === 1 ? "" : "s"}
                      </div>
                      <div style={{ color: "rgba(255,255,255,0.55)", fontSize: "12.5px", lineHeight: 1.45, marginTop: "1px" }}>
                        Locations where women told us they felt unsafe (Pointer crowdsourced data).
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ color: "rgba(255,255,255,0.62)", fontSize: "13.5px", lineHeight: 1.5 }}>
                This route stays clear of dark stretches and unsafe spots reported by women. No specific hotspots flagged on the way.
              </div>
            )}
          </div>
        </div>

        {/* Collapsible "About Stella" — data sources + mission */}
        <button onClick={() => setAboutOpen((v) => !v)} style={{
          background: "transparent", border: "none", padding: "2px 0",
          color: "rgba(255,255,255,0.55)", fontSize: "12px", fontWeight: 600,
          cursor: "pointer", fontFamily: "inherit", textAlign: "left",
        }}>
          {aboutOpen ? "▾ Hide data sources & mission" : "▸ How we know · what Stella stands for"}
        </button>
        {aboutOpen && (
          <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: "12px", padding: "12px 14px", border: "1px solid rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.72)", fontSize: "12.5px", lineHeight: 1.55 }}>
            <div style={{ color: Y, fontWeight: 700, fontSize: "12px", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "6px" }}>
              Data sources
            </div>
            <div style={{ marginBottom: "10px" }}>
              Stella combines crowdsourced reports from <strong>Pointer</strong> (where women told researchers they felt unsafe), the <strong>Amsterdam Veiligheidsindex</strong> (perceived neighborhood safety per buurt, 1–10), and <strong>BBGA</strong> indicators on harassment, drunken nuisance and registered crime. Routing also weighs lighting, building density and time of day.
            </div>
            <div style={{ color: Y, fontWeight: 700, fontSize: "12px", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "6px" }}>
              Why we built this
            </div>
            <div>
              Built for <em>Wij eisen de nacht op</em> (We are taking back the night). The fastest route isn&apos;t always the one a woman wants to take alone after dark. Stella picks routes that respect that — without making you walk an hour out of your way.
            </div>
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
