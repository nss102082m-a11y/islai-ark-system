interface LighthouseLogoProps {
  className?: string;
}

export function LighthouseLogo({ className = 'w-10 h-10' }: LighthouseLogoProps) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      fill="currentColor"
    >
      <path d="M45 10 L50 5 L55 10 L52 15 L48 15 Z" />
      <rect x="42" y="15" width="16" height="5" rx="1" />
      <rect x="40" y="20" width="20" height="8" />
      <rect x="42" y="28" width="16" height="8" />
      <rect x="40" y="36" width="20" height="8" />
      <rect x="42" y="44" width="16" height="8" />
      <rect x="40" y="52" width="20" height="8" />
      <rect x="42" y="60" width="16" height="8" />
      <polygon points="35,68 65,68 70,85 30,85" />
      <rect x="25" y="85" width="50" height="5" />
      <circle cx="50" cy="24" r="2" fill="white" opacity="0.8" />
      <circle cx="50" cy="40" r="2" fill="white" opacity="0.8" />
      <circle cx="50" cy="56" r="2" fill="white" opacity="0.8" />
      <path d="M48 5 L52 5 L54 0 L46 0 Z" opacity="0.6" />
    </svg>
  );
}
