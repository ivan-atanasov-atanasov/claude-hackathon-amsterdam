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

        if (coords.length > 1) {
          map.fitBounds(L.latLngBounds(coords), { padding: [32, 32] });

          // Glow underneath signals a chosen, protected corridor
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
        }

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

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div ref={divRef} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}
