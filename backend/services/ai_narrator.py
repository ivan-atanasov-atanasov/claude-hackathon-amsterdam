"""
Claude AI integration for route avoidance summaries and safety tips.

Uses claude-sonnet-4-6 with prompt caching on the system prompt.
Hard timeout of 20s; on failure returns ai_status='fallback' with static tips.

Output schema:
  avoids:   { areas: [str], summary: str }
  tips:     [str]
  ai_status: 'ok' | 'fallback'
"""

import asyncio
import logging
import os
from datetime import datetime

import anthropic

logger = logging.getLogger(__name__)

_SYSTEM_PROMPT = """You are Stella, a safety companion for women cycling in Amsterdam at night.
Your job is to give ONE focused, practical safety tip tailored to this specific journey — time of day, route conditions, and the user's context as a woman cycling alone.

Guidelines:
- Write exactly ONE tip, 1–2 sentences max
- Make it concrete and actionable for a woman cycling alone in Amsterdam
- Address real women's safety concerns: street harassment, isolated stretches, poor lighting, staying visible, trusting instincts, having an exit plan
- Tailor to the time of day (daytime / evening / night) and the specific hazards on this route
- Be empowering and direct, not patronising or generic
- Examples of good tips:
  * "If anyone follows you on Nieuwmarkt, cycle straight to the nearest café or Albert Heijn — don't head home."
  * "At this hour the Westerpark underpass is quiet — keep your speed up and stay visible."
  * "Pin your ETA now and share it before you leave; if you're more than 10 min late, someone will check."
- Avoid generic advice like "stay safe" or "be aware of your surroundings"
- Output valid JSON only — no prose outside the JSON object"""

_FALLBACK_TIPS = [
    "If anyone makes you feel uncomfortable, cycle straight to a busy spot — a bar, supermarket, or tram stop — rather than heading home.",
    "Pin your ETA and share it before you leave. If you're 10 min late, someone will know.",
    "Keep your speed up through quiet underpasses — confidence and pace deter unwanted attention.",
    "Trust the instinct that says 'this doesn't feel right' — a longer detour through a busier street is always worth it.",
    "Have your phone unlocked with a contact ready. You shouldn't need it, but it helps to know it's there.",
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
- Departure: {departure_time.strftime('%H:%M')} ({time_label})
- Mode: {mode}
- Hazards on route: {', '.join(avoidance_hints) if avoidance_hints else 'no specific hazards identified'}
- Lighting quality: {avg_lighting:.2f} (0=very dark, 1=well-lit)
- Incident safety: {avg_incidents:.2f} (0=many incidents, 1=very safe)

The user is a woman cycling alone in Amsterdam. Give her ONE focused, situation-specific safety tip for this journey.
Avoid generic advice. Reference the time of day and hazards. Be concrete about what to do, not just what to avoid.

Respond with a JSON object exactly like this:
{{
  "avoids": {{
    "areas": ["<area type 1>", "<area type 2>"],
    "summary": "<1–2 sentence summary of what the route avoids>"
  }},
  "tips": ["<one focused, women-safety-specific tip for this exact journey>"]
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
            timeout=20.0,
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

    except Exception as exc:
        logger.warning("AI narrator failed (%s: %s); using fallback", type(exc).__name__, exc)
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
