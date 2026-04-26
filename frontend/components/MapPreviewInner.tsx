"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import "leaflet/dist/leaflet.css";

function decodePolyline(encoded: string): [number, number][] {
  const points: [number, number][] = [];
  let index = 0, lat = 0, lng = 0;
  while (index < encoded.length) {
    let b, shift = 0, result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;
    shift = 0; result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;
    points.push([lat / 1e5, lng / 1e5]);
  }
  return points;
}

interface GridCell { lat: number; lng: number; overview_score: number; hotspot_penalty: number; }

function cellIntensity(cell: GridCell): number | null {
  if (cell.hotspot_penalty > 0)   return 1.0;
  if (cell.overview_score < 0.45) return 0.7;
  return null;
}

// Great-circle distance in metres (fast approximation for short distances)
function distM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Keep cells in a donut band: close enough to be relevant but not on the route itself.
// This makes danger zones appear as "nearby but avoided" rather than "on your path".
function filterAvoidedZones(cells: GridCell[], route: [number, number][], minM = 80, maxM = 420): GridCell[] {
  const sample = route.filter((_, i) => i % 5 === 0);
  if (sample.length === 0) return cells;
  return cells.filter(cell => {
    let closest = Infinity;
    for (const [lat, lng] of sample) {
      const d = distM(cell.lat, cell.lng, lat, lng);
      if (d < closest) closest = d;
      if (closest < minM) break;
    }
    return closest >= minM && closest <= maxM;
  });
}

interface Props {
  polyline?: string;
  alternativePolyline?: string;
  startLocation?: { lat: number; lng: number };
  endLocation?: { lat: number; lng: number };
  showRoute?: boolean;
  mapCenter?: [number, number];
  mapZoom?: number;
}

let counter = 0;

type LeafletType = typeof import("leaflet");
type LeafletCircle = ReturnType<LeafletType["circle"]>;

export default function MapPreviewInner({
  polyline,
  alternativePolyline,
  startLocation,
  endLocation,
  showRoute = true,
  mapCenter,
  mapZoom,
}: Props) {
  const divRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<ReturnType<LeafletType["map"]> | null>(null);
  const idRef = useRef(`_stella_map_${++counter}`);
  const zonesRef = useRef<LeafletCircle[]>([]);
  const cellsRef = useRef<GridCell[]>([]);
  const routeCoordsRef = useRef<[number, number][]>([]);
  const leafletRef = useRef<LeafletType | null>(null);
  const [showZones, setShowZones] = useState(true);
  const showZonesRef = useRef(true);

  const applyZones = useCallback((L: LeafletType, map: ReturnType<LeafletType["map"]>, on: boolean) => {
    zonesRef.current.forEach(c => c.remove());
    zonesRef.current = [];
    if (!on) return;
    const avoided = filterAvoidedZones(cellsRef.current, routeCoordsRef.current);
    avoided.forEach((cell) => {
      const intensity = cellIntensity(cell);
      if (!intensity) return;
      // Muted halos — background context, not the hero element
      const rings = [
        { r: 110, opacity: 0.03 * intensity },
        { r: 60,  opacity: 0.07 * intensity },
        { r: 30,  opacity: 0.14 * intensity },
        { r: 14,  opacity: 0.22 * intensity },
      ];
      rings.forEach(({ r, opacity }) => {
        const c = L.circle([cell.lat, cell.lng], {
          radius: r,
          stroke: false,
          fillColor: "#cc2200",
          fillOpacity: opacity,
          interactive: false,
        }).addTo(map);
        zonesRef.current.push(c);
      });
    });
  }, []);

  useEffect(() => {
    if (!divRef.current || mapRef.current) return;

    import("leaflet").then((L) => {
      if (!divRef.current || mapRef.current) return;
      leafletRef.current = L;
      divRef.current.id = idRef.current;

      const center: [number, number] = mapCenter ?? (
        showRoute && startLocation
          ? [startLocation.lat, startLocation.lng]
          : [52.374, 4.895]
      );

      const map = L.map(idRef.current, {
        center,
        zoom: mapZoom ?? (showRoute ? 13 : 14),
        zoomControl: false,
        attributionControl: false,
        dragging: true,
        touchZoom: true,
        scrollWheelZoom: false,
      });
      mapRef.current = map;

      L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
        maxZoom: 19,
        subdomains: "abcd",
      }).addTo(map);

      if (showRoute && polyline) {
        const coords = decodePolyline(polyline);
        routeCoordsRef.current = coords;

        if (coords.length > 1) {
          const bounds = L.latLngBounds(coords);
          map.fitBounds(bounds, { padding: [32, 32] });

          // Fetch safety grid and render zones clipped to route proximity
          const sw = bounds.getSouthWest();
          const ne = bounds.getNorthEast();
          const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
          fetch(`${apiUrl}/safety-grid?sw_lat=${sw.lat}&sw_lng=${sw.lng}&ne_lat=${ne.lat}&ne_lng=${ne.lng}`)
            .then((r) => r.json())
            .then(({ cells }: { cells: GridCell[] }) => {
              if (!mapRef.current) return;
              cellsRef.current = cells;
              applyZones(L, map, showZonesRef.current);
            })
            .catch(() => {});
        }

        // Glow layer underneath — signals a chosen, protected corridor
        L.polyline(coords, {
          color: "#5B8DEF",
          weight: 18,
          opacity: 0.18,
          lineJoin: "round",
          lineCap: "round",
        }).addTo(map);
        L.polyline(coords, {
          color: "#3B5BDB",
          weight: 5,
          opacity: 1,
          lineJoin: "round",
          lineCap: "round",
        }).addTo(map);

        const startIcon = L.divIcon({
          className: "",
          html: '<div style="width:14px;height:14px;background:#ffff05;border:2.5px solid #000099;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,0.4)"></div>',
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        });
        const endIcon = L.divIcon({
          className: "",
          html: '<div style="width:18px;height:18px;background:#000099;border:3px solid #ffff05;border-radius:50%;box-shadow:0 1px 6px rgba(0,0,0,0.5)"></div>',
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        });

        if (startLocation) L.marker([startLocation.lat, startLocation.lng], { icon: startIcon }).addTo(map);
        if (endLocation) L.marker([endLocation.lat, endLocation.lng], { icon: endIcon }).addTo(map);
      }
    });

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
      zonesRef.current = [];
    };
  }, []);

  // Toggle zones on/off without remounting the map
  useEffect(() => {
    showZonesRef.current = showZones;
    if (!mapRef.current || !leafletRef.current) return;
    applyZones(leafletRef.current, mapRef.current, showZones);
  }, [showZones, applyZones]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div ref={divRef} style={{ width: "100%", height: "100%" }} />
      {showRoute && (
        <button
          onClick={() => setShowZones(v => !v)}
          style={{
            position: "absolute", bottom: 14, right: 12, zIndex: 600,
            display: "flex", alignItems: "center", gap: "7px",
            background: showZones ? "rgba(10,10,40,0.88)" : "rgba(10,10,40,0.78)",
            border: showZones
              ? "1.5px solid rgba(255,255,255,0.28)"
              : "1.5px solid rgba(255,255,255,0.18)",
            borderRadius: "20px", padding: "7px 13px",
            color: "#fff",
            fontFamily: "var(--font-space-grotesk), 'Space Grotesk', sans-serif",
            fontWeight: 700, fontSize: "12px", cursor: "pointer",
            backdropFilter: "blur(6px)",
            boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
            transition: "background 0.2s, box-shadow 0.2s, border-color 0.2s",
            letterSpacing: "0.02em",
          }}
        >
          <span style={{
            width: 9, height: 9, borderRadius: "50%",
            background: showZones ? "#cc3300" : "rgba(255,255,255,0.3)",
            display: "inline-block", flexShrink: 0,
            transition: "background 0.2s",
          }} />
          {showZones ? "Avoided zones" : "Show avoided zones"}
        </button>
      )}
    </div>
  );
}
