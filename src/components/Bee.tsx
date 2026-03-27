"use client";

// Animated cartoon bee mascot
export default function Bee({ size = 80, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Wings */}
      <ellipse cx="30" cy="35" rx="18" ry="12" fill="#e0f2fe" stroke="#93c5fd" strokeWidth="1.5" opacity="0.85">
        <animateTransform attributeName="transform" type="rotate" values="-10 30 40;10 30 40;-10 30 40" dur="0.3s" repeatCount="indefinite" />
      </ellipse>
      <ellipse cx="70" cy="35" rx="18" ry="12" fill="#e0f2fe" stroke="#93c5fd" strokeWidth="1.5" opacity="0.85">
        <animateTransform attributeName="transform" type="rotate" values="10 70 40;-10 70 40;10 70 40" dur="0.3s" repeatCount="indefinite" />
      </ellipse>

      {/* Body */}
      <ellipse cx="50" cy="55" rx="24" ry="28" fill="#fbbf24" />

      {/* Stripes */}
      <ellipse cx="50" cy="43" rx="22" ry="5" fill="#92400e" opacity="0.7" />
      <ellipse cx="50" cy="55" rx="24" ry="5" fill="#92400e" opacity="0.7" />
      <ellipse cx="50" cy="67" rx="22" ry="5" fill="#92400e" opacity="0.7" />

      {/* Head */}
      <circle cx="50" cy="28" r="16" fill="#fbbf24" />

      {/* Eyes */}
      <circle cx="43" cy="25" r="5" fill="white" />
      <circle cx="57" cy="25" r="5" fill="white" />
      <circle cx="44" cy="24" r="2.5" fill="#1e1b4b" />
      <circle cx="58" cy="24" r="2.5" fill="#1e1b4b" />
      {/* Eye shine */}
      <circle cx="45" cy="23" r="1" fill="white" />
      <circle cx="59" cy="23" r="1" fill="white" />

      {/* Smile */}
      <path d="M 43 31 Q 50 38 57 31" fill="none" stroke="#92400e" strokeWidth="2" strokeLinecap="round" />

      {/* Antennae */}
      <line x1="43" y1="14" x2="36" y2="4" stroke="#92400e" strokeWidth="2" strokeLinecap="round" />
      <circle cx="35" cy="3" r="3" fill="#92400e" />
      <line x1="57" y1="14" x2="64" y2="4" stroke="#92400e" strokeWidth="2" strokeLinecap="round" />
      <circle cx="65" cy="3" r="3" fill="#92400e" />

      {/* Stinger */}
      <polygon points="50,83 46,78 54,78" fill="#92400e" />

      {/* Cheeks */}
      <circle cx="38" cy="30" r="3" fill="#f97316" opacity="0.3" />
      <circle cx="62" cy="30" r="3" fill="#f97316" opacity="0.3" />
    </svg>
  );
}

// Smaller flying bee for decorations
export function MiniBee({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-block ${className}`}>
      <svg width="32" height="32" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        <ellipse cx="30" cy="38" rx="14" ry="9" fill="#dbeafe" opacity="0.8">
          <animateTransform attributeName="transform" type="rotate" values="-8 30 42;8 30 42;-8 30 42" dur="0.25s" repeatCount="indefinite" />
        </ellipse>
        <ellipse cx="70" cy="38" rx="14" ry="9" fill="#dbeafe" opacity="0.8">
          <animateTransform attributeName="transform" type="rotate" values="8 70 42;-8 70 42;8 70 42" dur="0.25s" repeatCount="indefinite" />
        </ellipse>
        <ellipse cx="50" cy="55" rx="22" ry="24" fill="#fbbf24" />
        <ellipse cx="50" cy="45" rx="20" ry="4" fill="#92400e" opacity="0.6" />
        <ellipse cx="50" cy="56" rx="22" ry="4" fill="#92400e" opacity="0.6" />
        <ellipse cx="50" cy="67" rx="20" ry="4" fill="#92400e" opacity="0.6" />
        <circle cx="50" cy="30" r="14" fill="#fbbf24" />
        <circle cx="44" cy="27" r="3.5" fill="white" />
        <circle cx="56" cy="27" r="3.5" fill="white" />
        <circle cx="45" cy="26" r="2" fill="#1e1b4b" />
        <circle cx="57" cy="26" r="2" fill="#1e1b4b" />
        <path d="M 44 33 Q 50 38 56 33" fill="none" stroke="#92400e" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </span>
  );
}
