"use client";

import { useRef } from "react";
import { usePlacesAutocomplete } from "@/hooks/usePlacesAutocomplete";

interface Props {
  placeholder?: string;
  onSelect: (address: string) => void;
}

export function AddressInput({ placeholder, onSelect }: Props) {
  const { query, setQuery, suggestions, open, select, clear } = usePlacesAutocomplete();
  const containerRef = useRef<HTMLDivElement>(null);

  function handleSelect(text: string) {
    select({ text, placeId: "" });
    onSelect(text);
  }

  function handleBlur() {
    setTimeout(clear, 150);
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <input
        type="text"
        value={query}
        placeholder={placeholder}
        onChange={(e) => { setQuery(e.target.value); onSelect(""); }}
        onBlur={handleBlur}
        className="stella-input w-full px-0 py-1 text-sm focus:outline-none"
        style={{
          background: "transparent",
          color: "#ffffff",
          border: "none",
        }}
      />
      {open && suggestions.length > 0 && (
        <ul
          className="absolute z-50 mt-1 w-full rounded-xl overflow-hidden shadow-2xl"
          style={{
            background: "#0D1347",
            border: "1px solid rgba(255,255,255,0.12)",
          }}
        >
          {suggestions.map((s) => (
            <li
              key={s.placeId || s.text}
              onMouseDown={() => handleSelect(s.text)}
              className="px-4 py-2.5 text-sm cursor-pointer transition-colors"
              style={{ color: "rgba(255,255,255,0.85)" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLLIElement).style.background = "rgba(255,229,0,0.08)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLLIElement).style.background = "transparent"; }}
            >
              {s.text}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
