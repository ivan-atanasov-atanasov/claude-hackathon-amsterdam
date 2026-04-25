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

function scoreToColor(score: number, hotspotPenalty: number): string {
  if (hotspotPenalty > 0) return "#ff2222";   // known hotspot — always red
  if (score >= 0.72) return "#22c55e";         // safe — green
  if (score >= 0.50) return "#facc15";         // moderate — yellow
  return "#ef4444";                            // risky — red
}

interface GridCell { lat: number; lng: number; overview_score: number; hotspot_penalty: number; }

interface Props {
  polyline?: string;
  startLocation?: { lat: number; lng: number };
  endLocation?: { lat: number; lng: number };
  showRoute?: boolean;
  mapCenter?: [number, number];
  mapZoom?: number;
}

let counter = 0;

export default function MapPreviewInner({
  polyline,
  startLocation,
  endLocation,
  showRoute = true,
  mapCenter,
  mapZoom,
}: Props) {
  const divRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<ReturnType<typeof import("leaflet")["map"]> | null>(null);
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

        if (coords.length > 1) {
          const bounds = L.latLngBounds(coords);
          map.fitBounds(bounds, { padding: [32, 32] });

          // Fetch and render safety heatmap for the route bounding box
          const sw = bounds.getSouthWest();
          const ne = bounds.getNorthEast();
          const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
          fetch(`${apiUrl}/safety-grid?sw_lat=${sw.lat}&sw_lng=${sw.lng}&ne_lat=${ne.lat}&ne_lng=${ne.lng}`)
            .then((r) => r.json())
            .then(({ cells }: { cells: GridCell[] }) => {
              if (!mapRef.current) return;
              cells.forEach((cell) => {
                L.circle([cell.lat, cell.lng], {
                  radius: 60,
                  color: "transparent",
                  fillColor: scoreToColor(cell.overview_score, cell.hotspot_penalty),
                  fillOpacity: 0.28,
                  interactive: false,
                }).addTo(map);
              });
            })
            .catch(() => {});
        }

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
    };
  }, []);

  return <div ref={divRef} style={{ width: "100%", height: "100%" }} />;
}
