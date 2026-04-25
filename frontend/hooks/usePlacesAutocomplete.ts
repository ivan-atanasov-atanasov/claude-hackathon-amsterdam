"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface Suggestion {
  text: string;
  placeId: string;
}

const PLACES_URL = "https://places.googleapis.com/v1/places:autocomplete";

export function usePlacesAutocomplete() {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const justSelectedRef = useRef(false);

  const fetchSuggestions = useCallback(async (input: string) => {
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!key || input.length < 2) { setSuggestions([]); return; }

    try {
      const res = await fetch(`${PLACES_URL}?key=${key}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input, includedRegionCodes: ["nl"] }),
      });
      const data = await res.json();
      const items: Suggestion[] = (data.suggestions ?? [])
        .filter((s: { placePrediction?: unknown }) => s.placePrediction)
        .map((s: { placePrediction: { text: { text: string }; placeId: string } }) => ({
          text: s.placePrediction.text.text,
          placeId: s.placePrediction.placeId,
        }));
      setSuggestions(items);
      setOpen(items.length > 0);
    } catch {
      setSuggestions([]);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (justSelectedRef.current) { justSelectedRef.current = false; return; }
      fetchSuggestions(query);
    }, 250);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, fetchSuggestions]);

  function select(suggestion: Suggestion) {
    justSelectedRef.current = true;
    setQuery(suggestion.text);
    setSuggestions([]);
    setOpen(false);
    return suggestion.text;
  }

  function clear() {
    setSuggestions([]);
    setOpen(false);
  }

  return { query, setQuery, suggestions, open, select, clear };
}
