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
    // Delay so click on suggestion registers first
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
        className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 px-4 py-3 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-600 text-sm"
      />
      {open && suggestions.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-lg overflow-hidden">
          {suggestions.map((s) => (
            <li
              key={s.placeId || s.text}
              onMouseDown={() => handleSelect(s.text)}
              className="px-4 py-2.5 text-sm text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
            >
              {s.text}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
