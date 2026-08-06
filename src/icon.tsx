/**
 * Lantern logo: a chat-bubble silhouette with a single horizontal "flame
 * thread" — minimal, single-color, scales from 16px favicon to 512px maskable.
 */
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label="Lantern"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="l" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f7c97a" />
          <stop offset="100%" stopColor="#e69237" />
        </linearGradient>
      </defs>
      {/* Chat-bubble silhouette */}
      <path
        d="M14 18a12 12 0 0 1 12-12h12a12 12 0 0 1 12 12v14a12 12 0 0 1-12 12H30l-10 8a2 2 0 0 1-3-1.7V44A12 12 0 0 1 14 30z"
        fill="url(#l)"
      />
      {/* The thread: a single horizontal stroke inside the bubble */}
      <line
        x1="22" y1="32" x2="42" y2="32"
        stroke="#1c1407"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
