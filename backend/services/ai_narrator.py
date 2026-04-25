"""
Claude AI integration for route avoidance summaries and safety tips.

Uses claude-sonnet-4-6 with prompt caching on the system prompt.
Hard timeout of 2s; on failure returns ai_status='fallback' with static tips.

Output schema:
  avoids:   { areas: [str], summary: str }
  tips:     [str]
  ai_status: 'ok' | 'fallback'
"""

import asyncio
import os
from datetime import datetime

import anthropic

_SYSTEM_PROMPT = """You are Stella, a women's safety cycling assistant for Amsterdam.
Your job is to explain — in plain, reassuring language — what a recommended cycling route avoids and provide actionable safety tips.

Guidelines:
- Address the user directly ("Your route…", "We've routed you…")
- Be concise: avoidance summary in 1–2 sentences, 3–5 short tips
- Focus on what is avoided (dark areas, incident hotspots, isolated paths) rather than what was chosen
- Tips should be specific to the time of day and areas passed
- Never be alarmist; keep a calm, empowering tone
- Output valid JSON only — no prose outside the JSON object"""

_FALLBACK_TIPS = [
    "Stay on well-lit streets, especially after dark.",
    "Share your ETA with a friend before heading out.",
    "Trust your instincts — take a detour if something feels off.",
    "Keep your phone charged and within reach.",
    "Cycle at a confident pace; hesitation invites unwanted attention.",
]

_client: anthropic.AsyncAnthropic | None = None


def _get_client() -> anthropic.AsyncAnthropic:
    global _client
    if _client is None:
        _client = anthropic.AsyncAnthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    return _client


def _build_user_prompt(
    hotspots_passed: list[str],
    route_score: float,
    departure_time: datetime,
    mode: str,
    grid_summary: dict,
) -> str:
    hour = departure_time.hour
    if 6 <= hour < 20:
        time_label = "daytime"
    elif 20 <= hour < 23:
        time_label = "evening"
    else:
        time_label = "night"

    avoidance_hints = []
    if "unsafe_area" in hotspots_passed:
        avoidance_hints.append("hotspot areas with higher incident rates")
    if "camera_zone" in hotspots_passed:
        avoidance_hints.append("areas without camera coverage")

    avg_lighting = grid_summary.get("avg_lighting", 0.5)
    avg_incidents = grid_summary.get("avg_incident_score", 0.8)

    if avg_lighting < 0.4:
        avoidance_hints.append("poorly lit streets")
    if avg_incidents < 0.6:
        avoidance_hints.append("areas with frequent incident reports")

    return f"""Route details:
- Safety score: {route_score:.1f}/10
- Departure time: {departure_time.strftime('%H:%M')} ({time_label})
- Travel mode: {mode}
- Route avoids: {', '.join(avoidance_hints) if avoidance_hints else 'no specific hazards identified'}
- Average lighting score: {avg_lighting:.2f}
- Average incident safety: {avg_incidents:.2f}

Respond with a JSON object exactly like this:
{{
  "avoids": {{
    "areas": ["<area type 1>", "<area type 2>"],
    "summary": "<1–2 sentence plain-language summary of what the route avoids>"
  }},
  "tips": ["<tip 1>", "<tip 2>", "<tip 3>"]
}}"""


async def generate_route_narrative(
    hotspots_passed: list[str],
    route_score: float,
    departure_time: datetime,
    mode: str = "cycling",
    grid_summary: dict | None = None,
) -> dict:
    """
    Generate avoidance summary and tips for a route.

    Returns:
        {
            "avoids": {"areas": [...], "summary": "..."},
            "tips": [...],
            "ai_status": "ok" | "fallback"
        }
    """
    if grid_summary is None:
        grid_summary = {}

    try:
        client = _get_client()
        user_prompt = _build_user_prompt(
            hotspots_passed, route_score, departure_time, mode, grid_summary
        )

        response = await asyncio.wait_for(
            client.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=512,
                system=[
                    {
                        "type": "text",
                        "text": _SYSTEM_PROMPT,
                        "cache_control": {"type": "ephemeral"},
                    }
                ],
                messages=[{"role": "user", "content": user_prompt}],
            ),
            timeout=2.0,
        )

        import json
        raw = response.content[0].text.strip()
        # Strip markdown code fences if present
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        parsed = json.loads(raw)

        return {
            "avoids": parsed.get("avoids", {"areas": [], "summary": ""}),
            "tips": parsed.get("tips", _FALLBACK_TIPS[:3]),
            "ai_status": "ok",
        }

    except Exception:
        return _fallback_response(hotspots_passed, departure_time)


def _fallback_response(hotspots_passed: list[str], departure_time: datetime) -> dict:
    hour = departure_time.hour
    areas = []
    if "unsafe_area" in hotspots_passed:
        areas.append("incident hotspots")
    if "camera_zone" in hotspots_passed:
        areas.append("areas without camera coverage")
    if not areas:
        areas = ["isolated paths"]

    if hour >= 20 or hour < 6:
        summary = f"Your route avoids {' and '.join(areas)}, keeping you on well-lit, active streets."
        tips = _FALLBACK_TIPS
    else:
        summary = f"Your route avoids {' and '.join(areas)} for a safer journey."
        tips = _FALLBACK_TIPS[:3]

    return {
        "avoids": {"areas": areas, "summary": summary},
        "tips": tips,
        "ai_status": "fallback",
    }
