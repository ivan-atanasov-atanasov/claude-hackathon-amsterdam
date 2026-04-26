"use client";

import { useEffect, useRef } from "react";
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

function distM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Return up to `cap` confirmed hotspots within `maxM` of the given route
function hotspotNearRoute(cells: GridCell[], route: [number, number][], maxM = 120, cap = 3): GridCell[] {
  const sample = route.filter((_, i) => i % 4 === 0);
  const result: GridCell[] = [];
  for (const cell of cells) {
    if (cell.hotspot_penalty <= 0) continue;
    if (result.length >= cap) break;
    if (sample.some(([lat, lng]) => distM(cell.lat, cell.lng, lat, lng) < maxM)) {
      result.push(cell);
    }
  }
  return result;
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

  useEffect(() => {
    if (!divRef.current || mapRef.current) return;

    import("leaflet").then((L) => {
      if (!divRef.current || mapRef.current) return;
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
        const altCoords = alternativePolyline ? decodePolyline(alternativePolyline) : null;

        if (coords.length > 1) {
          const bounds = L.latLngBounds(coords);
          map.fitBounds(bounds, { padding: [32, 32] });

          // Fetch hotspots and draw up to 3 red dots on the avoided (alternative) route
          if (altCoords) {
            const sw = bounds.getSouthWest();
            const ne = bounds.getNorthEast();
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
            fetch(`${apiUrl}/safety-grid?sw_lat=${sw.lat}&sw_lng=${sw.lng}&ne_lat=${ne.lat}&ne_lng=${ne.lng}`)
              .then(r => r.json())
              .then(({ cells }: { cells: GridCell[] }) => {
                if (!mapRef.current) return;
                hotspotNearRoute(cells, altCoords).forEach(cell => {
                  const rings = [
                    { r: 90,  opacity: 0.08 },
                    { r: 45,  opacity: 0.18 },
                    { r: 20,  opacity: 0.35 },
                    { r: 10,  opacity: 0.60 },
                  ];
                  rings.forEach(({ r, opacity }) => {
                    L.circle([cell.lat, cell.lng], {
                      radius: r, stroke: false,
                      fillColor: "#cc2200", fillOpacity: opacity, interactive: false,
                    }).addTo(map);
                  });
                });
              })
              .catch(() => {});
          }

          // Glow underneath signals a chosen, protected corridor
          L.polyline(coords, {
            color: "#5B8DEF", weight: 18, opacity: 0.18,
            lineJoin: "round", lineCap: "round",
          }).addTo(map);
          L.polyline(coords, {
            color: "#3B5BDB", weight: 5, opacity: 1,
            lineJoin: "round", lineCap: "round",
          }).addTo(map);
        }

        const startIcon = L.divIcon({
          className: "",
          html: '<div style="width:14px;height:14px;background:#ffff05;border:2.5px solid #000099;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,0.4)"></div>',
          iconSize: [14, 14], iconAnchor: [7, 7],
        });
        const endIcon = L.divIcon({
          className: "",
          html: '<div style="width:18px;height:18px;background:#000099;border:3px solid #ffff05;border-radius:50%;box-shadow:0 1px 6px rgba(0,0,0,0.5)"></div>',
          iconSize: [18, 18], iconAnchor: [9, 9],
        });

        if (startLocation) L.marker([startLocation.lat, startLocation.lng], { icon: startIcon }).addTo(map);
        if (endLocation)   L.marker([endLocation.lat,   endLocation.lng],   { icon: endIcon   }).addTo(map);
      }
    });

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div ref={divRef} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}
