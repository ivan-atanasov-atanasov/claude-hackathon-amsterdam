"use client";

import { useRef, useState } from "react";
import { usePlacesAutocomplete } from "@/hooks/usePlacesAutocomplete";

interface Props {
  placeholder?: string;
  value?: string;
  onSelect: (address: string) => void;
  prefix?: React.ReactNode;
}

export function AddressInput({ placeholder, value: externalValue, onSelect, prefix }: Props) {
  const { query, setQuery, suggestions, open, select, clear } = usePlacesAutocomplete();
  const [focused, setFocused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync external value override (e.g. "Current location") into the input
  const displayValue = externalValue !== undefined && !focused ? externalValue : query;

  function handleSelect(text: string) {
    select({ text, placeId: "" });
    onSelect(text);
    setFocused(false);
  }

  function handleFocus() {
    setFocused(true);
    if (query.length >= 2) {
      // re-open if there are cached suggestions
    }
  }

  function handleBlur() {
    // Delay so mousedown on a suggestion fires first
    setTimeout(() => {
      clear();
      setFocused(false);
    }, 200);
  }

  return (
    <div ref={containerRef} className="relative w-full flex items-center gap-2">
      {prefix}
      <input
        type="text"
        value={focused ? query : (externalValue ?? query)}
        placeholder={placeholder}
        onChange={(e) => { setQuery(e.target.value); onSelect(""); }}
        onFocus={handleFocus}
        onBlur={handleBlur}
        className="stella-input flex-1 py-1 text-sm focus:outline-none min-w-0"
        style={{ background: "transparent", color: "#ffffff", border: "none" }}
      />
      {open && suggestions.length > 0 && (
        <ul
          className="absolute left-0 right-0 top-full z-50 mt-2 rounded-2xl overflow-hidden shadow-2xl"
          style={{
            background: "#0D1347",
            border: "1px solid rgba(255,255,255,0.12)",
          }}
        >
          {suggestions.map((s) => (
            <li
              key={s.placeId || s.text}
              // preventDefault stops the input blur from firing before selection
              onMouseDown={(e) => { e.preventDefault(); handleSelect(s.text); }}
              className="px-4 py-3 text-sm cursor-pointer flex items-center gap-2"
              style={{ color: "rgba(255,255,255,0.85)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,229,0,0.08)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <span style={{ color: "var(--stella-yellow)", fontSize: "0.7rem" }}>📍</span>
              {s.text}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
