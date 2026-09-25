type Props = {
  readonly isLast: boolean;
};

export const ReplyElbow = ({ isLast }: Props) => (
  <>
    {isLast ? null : (
      <span aria-hidden className="absolute bottom-0 left-[-15px] top-0 w-px bg-border" />
    )}
    <svg
      aria-hidden
      width="14"
      height="17"
      viewBox="0 0 14 17"
      className="pointer-events-none absolute left-[-15px] top-0 text-border"
    >
      <path d="M0.5 0 V6 A10 10 0 0 0 10.5 16.5 H14" fill="none" stroke="currentColor" />
    </svg>
  </>
);
