"use client";

import { useRef, useState } from "react";
import { usePlacesAutocomplete } from "@/hooks/usePlacesAutocomplete";

interface Props {
  placeholder?: string;
  onSelect: (address: string) => void;
}

export function AddressInput({ placeholder, onSelect }: Props) {
  const { query, setQuery, suggestions, open, select, clear } = usePlacesAutocomplete();
  const [focused, setFocused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  function handleSelect(text: string) {
    select({ text, placeId: "" });
    onSelect(text);
    setFocused(false);
  }

  function handleBlur() {
    // Long enough delay for mousedown/touchend to fire first
    setTimeout(() => { clear(); setFocused(false); }, 250);
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <input
        type="text"
        value={query}
        placeholder={placeholder}
        onChange={(e) => { setQuery(e.target.value); onSelect(""); }}
        onFocus={() => setFocused(true)}
        onBlur={handleBlur}
        className="stella-input w-full py-1 text-sm focus:outline-none"
        style={{ background: "transparent", color: "#ffffff", border: "none", width: "100%" }}
      />
      {open && suggestions.length > 0 && (
        <ul
          className="absolute left-0 right-0 top-full z-50 mt-2 rounded-xl overflow-hidden shadow-2xl"
          style={{ background: "#001080", border: "1px solid rgba(255,255,255,0.12)", minWidth: "100%" }}
        >
          {suggestions.map((s) => (
            <li
              key={s.placeId || s.text}
              // preventDefault stops blur from firing before the selection registers
              onMouseDown={(e) => { e.preventDefault(); handleSelect(s.text); }}
              onTouchEnd={(e) => { e.preventDefault(); handleSelect(s.text); }}
              style={{
                padding: "12px 15px",
                fontSize: "14px",
                color: "rgba(255,255,255,0.85)",
                cursor: "pointer",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
                display: "flex", alignItems: "center", gap: "8px",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,5,0.08)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            >
              <span style={{ fontSize: "12px", opacity: 0.6 }}>📍</span>
              {s.text}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
