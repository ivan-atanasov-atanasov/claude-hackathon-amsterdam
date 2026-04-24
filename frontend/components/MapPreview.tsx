"use client";

import { useEffect, useRef } from "react";

interface Props {
  polyline: string;
  startLocation: { lat: number; lng: number };
  endLocation: { lat: number; lng: number };
}

// Shared promise so the script only loads once
let mapsReady: Promise<void> | null = null;

function loadMapsApi(apiKey: string): Promise<void> {
  if (mapsReady) return mapsReady;
  mapsReady = new Promise((resolve) => {
    if ((window as Window & { google?: { maps?: unknown } }).google?.maps) {
      resolve();
      return;
    }
    const cb = "__mapsApiReady";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any)[cb] = resolve;
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=geometry&callback=${cb}`;
    script.async = true;
    document.head.appendChild(script);
  });
  return mapsReady;
}

export function MapPreview({ polyline, startLocation, endLocation }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey || !mapRef.current) return;

    loadMapsApi(apiKey).then(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const g = (window as any).google.maps;

      const map = new g.Map(mapRef.current, {
        zoom: 14,
        center: startLocation,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      });

      const path = g.geometry.encoding.decodePath(polyline);

      new g.Polyline({
        path,
        geodesic: true,
        strokeColor: "#18181b",
        strokeOpacity: 0.9,
        strokeWeight: 4,
        map,
      });

      new g.Marker({ position: startLocation, map, title: "Start" });
      new g.Marker({ position: endLocation, map, title: "End" });

      const bounds = new g.LatLngBounds();
      path.forEach((p: { lat: () => number; lng: () => number }) => bounds.extend(p));
      map.fitBounds(bounds, 40);
    });
  }, [polyline, startLocation, endLocation]);

  return (
    <div
      ref={mapRef}
      className="w-full h-64 rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-800"
    />
  );
}
