type Props = {
  readonly label?: string;
};

export const SummarizerWorkingIndicator = ({ label = 'Summarizing context' }: Props) => (
  <span
    role="status"
    aria-label={label}
    className="spin-border spin-border-info inline-flex size-3 shrink-0 rounded-full border border-border-soft"
  />
);
