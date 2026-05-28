interface Props {
  size?: number;
  className?: string;
}

// Goodboy mascot, solid dog face ("musetto"). Single-color (currentColor):
// two floppy ears + a rounded head; eyes and nose are knocked out (evenodd)
// so the background shows through. Reads as a dog from 16px up to hero sizes.
export function DogMascot({ size = 16, className }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      className={className}
    >
      <path d="M9 8.5Q4.3 7.7 3 11.5Q2.5 15.5 4.8 17.3Q6.8 18.2 7.2 15.3Q6.7 12.5 6.3 10.3Q6 8.9 9 8.5Z" />
      <path d="M15 8.5Q19.7 7.7 21 11.5Q21.5 15.5 19.2 17.3Q17.2 18.2 16.8 15.3Q17.3 12.5 17.7 10.3Q18 8.9 15 8.5Z" />
      <path
        fillRule="evenodd"
        d="M7.5 13a4.5 5.1 0 1 0 9 0a4.5 5.1 0 1 0-9 0ZM9.3 12a1.1 1.1 0 1 0 2.2 0a1.1 1.1 0 1 0-2.2 0ZM12.5 12a1.1 1.1 0 1 0 2.2 0a1.1 1.1 0 1 0-2.2 0ZM10.7 14.4Q12 16.2 13.3 14.4Q12 13.7 10.7 14.4Z"
      />
    </svg>
  );
}
