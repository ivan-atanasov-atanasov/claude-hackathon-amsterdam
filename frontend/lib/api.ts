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
}

export interface RouteAvoids {
  areas: string[];
  summary: string;
}

export interface RouteResponse {
  route: RouteResult;
  all_routes: RouteResult[];
  safety_score: number;
  avoids: RouteAvoids;
  tips: string[];
  ai_status: "ok" | "fallback";
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
