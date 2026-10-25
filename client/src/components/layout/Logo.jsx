export function Logo({ inverted = false }) {
  return (
    <div className="flex items-center gap-2.5">
      <svg viewBox="0 0 64 64" className="h-9 w-9" aria-hidden="true">
        <rect width="64" height="64" rx="14" fill={inverted ? '#FF6A13' : '#1C2430'} />
        <path
          d="M14 46V20h9l9 14 9-14h9v26h-8V32L32 47 22 32v14z"
          fill={inverted ? '#1C2430' : '#FF6A13'}
        />
      </svg>
      <span className={`text-xl font-bold tracking-tight ${inverted ? 'text-white' : 'text-ink'}`}>
        MazdoorPay
      </span>
    </div>
  );
}
