"use client";

import dynamic from "next/dynamic";

const MapPreviewInner = dynamic(() => import("./MapPreviewInner"), { ssr: false });

interface Props {
  polyline?: string;
  alternativePolyline?: string;
  startLocation?: { lat: number; lng: number };
  endLocation?: { lat: number; lng: number };
  showRoute?: boolean;
  mapCenter?: [number, number];
  mapZoom?: number;
}

export function MapPreview(props: Props) {
  return <MapPreviewInner {...props} />;
}
