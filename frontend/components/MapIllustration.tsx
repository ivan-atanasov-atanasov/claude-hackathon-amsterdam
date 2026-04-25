// Static CSS/SVG map illustration — used on the input screen so no map
// library is loaded until a route is actually calculated.
export function MapIllustration() {
  return (
    <svg
      viewBox="0 0 390 295"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: "100%", height: "100%", display: "block" }}
      preserveAspectRatio="xMidYMid slice"
    >
      {/* Background — light map colour */}
      <rect width="390" height="295" fill="#e8e0d0" />

      {/* Water body — IJ river */}
      <ellipse cx="195" cy="60" rx="230" ry="52" fill="#a8cce0" />
      <ellipse cx="320" cy="40" rx="100" ry="38" fill="#a8cce0" />

      {/* Major road grid — light beige/white */}
      {/* Horizontal roads */}
      <line x1="0" y1="115" x2="390" y2="115" stroke="#fff" strokeWidth="7" />
      <line x1="0" y1="155" x2="390" y2="155" stroke="#fff" strokeWidth="5" />
      <line x1="0" y1="200" x2="390" y2="200" stroke="#fff" strokeWidth="5" />
      <line x1="0" y1="240" x2="390" y2="240" stroke="#fff" strokeWidth="4" />
      {/* Vertical roads */}
      <line x1="80"  y1="100" x2="80"  y2="295" stroke="#fff" strokeWidth="5" />
      <line x1="160" y1="100" x2="160" y2="295" stroke="#fff" strokeWidth="7" />
      <line x1="240" y1="100" x2="240" y2="295" stroke="#fff" strokeWidth="5" />
      <line x1="310" y1="100" x2="310" y2="295" stroke="#fff" strokeWidth="4" />

      {/* Diagonal road — Singel/Prinsengracht style */}
      <line x1="30" y1="130" x2="200" y2="295" stroke="#fff" strokeWidth="5" />
      <line x1="100" y1="110" x2="390" y2="260" stroke="#fff" strokeWidth="4" />

      {/* Parks — green ovals */}
      <ellipse cx="120" cy="210" rx="48" ry="32" fill="#b5d5a0" opacity="0.85" />
      <ellipse cx="290" cy="250" rx="38" ry="22" fill="#b5d5a0" opacity="0.75" />
      <ellipse cx="60"  cy="270" rx="28" ry="16" fill="#b5d5a0" opacity="0.7" />

      {/* Canal ring arcs */}
      <ellipse cx="195" cy="185" rx="130" ry="80" fill="none" stroke="#a8cce0" strokeWidth="10" opacity="0.5" />
      <ellipse cx="195" cy="185" rx="100" ry="60" fill="none" stroke="#a8cce0" strokeWidth="8"  opacity="0.45" />
      <ellipse cx="195" cy="185" rx="70"  ry="42" fill="none" stroke="#a8cce0" strokeWidth="6"  opacity="0.4" />

      {/* Route hint — subtle blue path */}
      <path
        d="M 160 120 Q 200 160 180 200 Q 160 240 195 270"
        fill="none" stroke="#3B5BDB" strokeWidth="4" strokeDasharray="8 5" opacity="0.4"
        strokeLinecap="round"
      />
    </svg>
  );
}
