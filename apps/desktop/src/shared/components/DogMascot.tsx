interface DogMascotProps {
  size?: number;
  className?: string;
}

export function DogMascot({ size = 16, className }: DogMascotProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      {/* floppy ears */}
      <path d="M 5.5 4 Q 3.5 4.5 4 8 Q 4.5 10 6 9.5" />
      <path d="M 18.5 4 Q 20.5 4.5 20 8 Q 19.5 10 18 9.5" />
      {/* head */}
      <path d="M 6 9 Q 5 12 6 15 Q 7 19 12 19 Q 17 19 18 15 Q 19 12 18 9 Q 17 6 12 6 Q 7 6 6 9 Z" />
      {/* eyes */}
      <circle cx="9.5" cy="11.5" r="0.7" fill="currentColor" stroke="none" />
      <circle cx="14.5" cy="11.5" r="0.7" fill="currentColor" stroke="none" />
      {/* nose */}
      <path d="M 11 14 Q 12 15 13 14 Q 12 13.5 11 14 Z" fill="currentColor" stroke="none" />
      {/* moustache — the baffi */}
      <path d="M 7 16 Q 9.5 15.3 12 15.8" />
      <path d="M 12 15.8 Q 14.5 15.3 17 16" />
      <path d="M 8 17 Q 10 16.5 12 16.8" />
      <path d="M 12 16.8 Q 14 16.5 16 17" />
    </svg>
  );
}
