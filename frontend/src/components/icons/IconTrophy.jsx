// src/components/icons/IconTrophy.jsx

export default function IconTrophy({ className = "w-6 h-6 text-amber-400" }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={className}
      aria-hidden="true"
    >
      {/* Taça */}
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="
          M7 4h10
          M17 4v3a5 5 0 1 1-10 0V4
          M9 20h6
          M12 16v4
        "
      />
      {/* Alças e base */}
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="
          M5 7H4a2 2 0 0 1-2-2V4h3
          M19 7h1a2 2 0 0 0 2-2V4h-3
        "
      />
    </svg>
  );
}
