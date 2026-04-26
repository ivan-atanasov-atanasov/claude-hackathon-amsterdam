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
): string {
  const tm = mode === "bicycling" ? "bicycling" : "walking";
  const o = `${origin.lat},${origin.lng}`;
  const d = `${destination.lat},${destination.lng}`;
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

const KIND_COLOR: Record<string, string> = {
  park: "#dd2200",
  square: "#ff6600",
  station: "#ff6600",
  corridor: "#ff6600",
};

export function RouteResult({ result, fromAddress, toAddress, onBack, onArrived }: Props) {
  const [etaOpen, setEtaOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const { route, mode, avoidance_diff } = result;

  const routeLabel = route.duration_text;

  const avoidedNamed = avoidance_diff?.avoided_named ?? [];
  const avoidedPointerCount = avoidance_diff?.avoided_pointer_count ?? 0;

  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", background: BD, position: "relative", overflow: "hidden", fontFamily: "var(--font-space-grotesk), 'Space Grotesk', sans-serif" }}>

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

        {/* Reported incidents legend */}
        <div style={{
          position: "absolute", bottom: 52, left: 12, zIndex: 600,
          background: "rgba(10,10,40,0.78)", borderRadius: "10px", padding: "6px 10px",
          backdropFilter: "blur(6px)", border: "1px solid rgba(255,255,255,0.1)",
          display: "flex", alignItems: "center", gap: "8px",
        }}>
          <div style={{ display: "flex", gap: "3px", alignItems: "center" }}>
            {[0.2, 0.5, 0.8, 1].map((o, i) => (
              <div key={i} style={{ width: 10, height: 10, borderRadius: "50%", background: `rgba(220,34,0,${o})` }} />
            ))}
          </div>
          <span style={{ color: "rgba(255,255,255,0.65)", fontSize: "10px", fontWeight: 700, letterSpacing: "0.04em" }}>REPORTED INCIDENTS</span>
        </div>

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

        {/* Avoidance cards — horizontal scrollable row */}
        {(avoidedNamed.length > 0 || avoidedPointerCount > 0) ? (
          <div style={{ display: "flex", gap: "8px", overflowX: "auto", WebkitOverflowScrolling: "touch" as "touch" }}>
            {avoidedNamed.map((a) => {
              const color = KIND_COLOR[a.kind] ?? "#ff6600";
              return (
                <div key={a.name} style={{ flex: "0 0 calc(50% - 4px)", minWidth: "140px", background: "rgba(255,255,255,0.05)", borderRadius: "13px", overflow: "hidden", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <div style={{ height: "3px", background: color }} />
                  <div style={{ padding: "10px 11px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "5px" }}>
                      <span style={{ color: "#fff", fontWeight: 700, fontSize: "13px" }}>{a.name}</span>
                      <span style={{ background: "rgba(255,255,255,0.1)", borderRadius: "5px", padding: "2px 6px", color: "rgba(255,255,255,0.5)", fontSize: "9px", fontWeight: 700, whiteSpace: "nowrap", marginLeft: "4px", marginTop: "1px" }}>
                        {KIND_LABEL[a.kind] ?? a.kind.toUpperCase()}
                      </span>
                    </div>
                    <div style={{ color: "rgba(255,255,255,0.45)", fontSize: "11px", lineHeight: 1.45 }}>{a.reason}</div>
                  </div>
                </div>
              );
            })}
            {avoidedPointerCount > 0 && (
              <div style={{ flex: "0 0 calc(50% - 4px)", minWidth: "140px", background: "rgba(255,255,255,0.05)", borderRadius: "13px", overflow: "hidden", border: "1px solid rgba(255,255,255,0.07)" }}>
                <div style={{ height: "3px", background: "#ff6600" }} />
                <div style={{ padding: "10px 11px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "5px" }}>
                    <span style={{ color: "#fff", fontWeight: 700, fontSize: "13px" }}>{avoidedPointerCount} unsafe spot{avoidedPointerCount === 1 ? "" : "s"}</span>
                    <span style={{ background: "rgba(255,255,255,0.1)", borderRadius: "5px", padding: "2px 6px", color: "rgba(255,255,255,0.5)", fontSize: "9px", fontWeight: 700, whiteSpace: "nowrap", marginLeft: "4px", marginTop: "1px" }}>REPORTED</span>
                  </div>
                  <div style={{ color: "rgba(255,255,255,0.45)", fontSize: "11px", lineHeight: 1.45 }}>Women-reported unsafe locations (Pointer data)</div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: "13px", overflow: "hidden", border: "1px solid rgba(255,255,255,0.07)" }}>
            <div style={{ height: "3px", background: "#3B5BDB" }} />
            <div style={{ padding: "10px 13px", color: "rgba(255,255,255,0.55)", fontSize: "12px", lineHeight: 1.5 }}>
              No specific hotspots on this route — clear of dark stretches and unsafe spots reported by women.
            </div>
          </div>
        )}

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
            href={googleMapsUrl(route.start_location, route.end_location, mode)}
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
