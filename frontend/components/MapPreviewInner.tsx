"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

// Simple Google encoded-polyline decoder
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

      // CartoDB Voyager — clean, modern, colorful (matches design)
      L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
        maxZoom: 19,
        subdomains: "abcd",
      }).addTo(map);

      if (showRoute && polyline) {
        const coords = decodePolyline(polyline);

        L.polyline(coords, {
          color: "#3B5BDB",
          weight: 5,
          opacity: 1,
          lineJoin: "round",
          lineCap: "round",
        }).addTo(map);

        const mkIcon = () =>
          L.divIcon({
            className: "",
            html: '<div class="route-marker"></div>',
            iconSize: [16, 16],
            iconAnchor: [8, 8],
          });

        if (startLocation) L.marker([startLocation.lat, startLocation.lng], { icon: mkIcon() }).addTo(map);
        if (endLocation) L.marker([endLocation.lat, endLocation.lng], { icon: mkIcon() }).addTo(map);

        if (coords.length > 1) {
          const bounds = L.latLngBounds(coords);
          map.fitBounds(bounds, { padding: [32, 32] });
        }
      }
    });

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  return <div ref={divRef} style={{ width: "100%", height: "100%" }} />;
}
