interface DogSniffProps {
  size?: number;
  className?: string;
  'aria-hidden'?: boolean;
}

// "Debug" mascot, a dog in a head-down sniffing pose, nosing out a pile
// on the ground (the bug) set a small gap apart so the two read as distinct.
// Single-color (currentColor); the eye is knocked out (evenodd) so the
// background shows through. Same solid style as DogMascot.
export function DogSniff({
  size = 16,
  className,
  'aria-hidden': ariaHidden = true,
}: DogSniffProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden={ariaHidden}
      className={className}
    >
      <g transform="translate(0 -1.3)">
        {/* the pile being sniffed out */}
        <g transform="translate(3.43 16.6) scale(0.9)">
          <ellipse cx="0" cy="3.4" rx="2.3" ry="1.05" />
          <ellipse cx="0.4" cy="2.2" rx="1.65" ry="0.92" />
          <ellipse cx="-0.05" cy="1.15" rx="1.15" ry="0.8" />
          <path d="M0.05 0.95Q-0.55 0.5 -0.2 -0.2Q0.3 -0.8 1 -0.4Q1.45 -0.1 1.2 0.5Q1 1 0.4 1Z" />
        </g>
        {/* the dog */}
        <g transform="translate(5.13 3.64) scale(0.8)">
          {/* legs, hind pair then front pair */}
          <path d="M17.2 12.9L19.2 12.9Q19.1 17 19 20.1Q19 21.05 18.3 21.1L17.05 21.1Q16.5 21.1 16.65 20.35Q16.9 17 17.2 12.9Z" />
          <path d="M11.8 13.1L13.8 13.1Q13.7 17 13.6 20.1Q13.6 21.05 12.9 21.1L11.65 21.1Q11.1 21.1 11.25 20.35Q11.5 17 11.8 13.1Z" />
          <path d="M15 12.7L17.1 12.7Q17 17 16.9 20.2Q16.9 21.15 16.15 21.2L14.85 21.2Q14.3 21.2 14.45 20.45Q14.7 17 15 12.7Z" />
          <path d="M9.7 12.9L11.7 12.9Q11.6 17 11.5 20.2Q11.5 21.15 10.8 21.2L9.55 21.2Q9 21.2 9.15 20.45Q9.4 17 9.7 12.9Z" />
          {/* ear (behind body) */}
          <path d="M5.4 13.5Q8.6 13.3 9.3 16.6Q9.7 19.2 7.7 20.5Q5.9 21.3 5.5 18.6Q5.2 16 5.4 13.5Z" />
          {/* body, tail, neck */}
          <path d="M9.8 13.8Q9 9.8 12.5 8.6Q15.5 7.6 18.8 8.8Q20.4 9.6 20 12.8Q19.6 14.3 17.5 14.2Q14 14.5 11 14Q10.2 13.9 9.8 13.8Z" />
          <path d="M18 10.5Q18.3 7 19.3 4.3Q19.7 3 20.6 3.2Q21.4 3.6 20.9 4.9Q19.9 7.5 19.6 10Q19.5 11.2 19.8 12Q18.7 12 18 10.5Z" />
          <path d="M11.6 9.4Q13.2 11 12.5 14.2Q11.6 16.8 8.4 17.5Q6.7 17.8 6.4 16.1Q7.4 11.4 11.6 9.4Z" />
          {/* head with knocked-out eye */}
          <path
            fillRule="evenodd"
            d="M3 16.3a2.8 2.8 0 1 0 5.6 0a2.8 2.8 0 1 0-5.6 0ZM4.38 15.5a0.62 0.62 0 1 0 1.24 0a0.62 0.62 0 1 0-1.24 0Z"
          />
          {/* muzzle + nose */}
          <ellipse cx="3.7" cy="18.3" rx="1.6" ry="1.4" />
          <ellipse cx="2.5" cy="18.1" rx="0.66" ry="0.6" />
        </g>
      </g>
    </svg>
  );
}
