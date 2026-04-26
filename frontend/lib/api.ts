const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function apiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${await res.text()}`);
  }

  return res.json() as Promise<T>;
}

export interface RouteResult {
  summary: string;
  distance_m: number;
  distance_text: string;
  duration_s: number;
  duration_text: string;
  polyline: string;
  start_location: { lat: number; lng: number };
  end_location: { lat: number; lng: number };
  map_waypoints?: { lat: number; lng: number }[];
}

export interface NamedUnsafeArea {
  name: string;
  kind: string;
  reason: string;
}

export interface AvoidanceDiff {
  avoided_named: NamedUnsafeArea[];
  avoided_pointer_count: number;
  safe_still_passes: string[];
}

export interface PassedAreas {
  named: NamedUnsafeArea[];
  pointer_count: number;
}

export interface RouteResponse {
  route: RouteResult;
  alternative_route: RouteResult | null;
  alternative_safety_score: number | null;
  all_routes: RouteResult[];
  safety_score: number;
  avoidance_diff: AvoidanceDiff;
  passed_areas: PassedAreas;
  chose_safer_than_google: boolean;
  hotspots: string[];
  mode: string;
  departure_time: string;
}

export async function fetchRoute(
  origin: string,
  destination: string,
  mode: string,
  departure_time: string
): Promise<RouteResponse> {
  return apiFetch<RouteResponse>(
    `/routes?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&mode=${mode}&departure_time=${encodeURIComponent(departure_time)}`
  );
}

