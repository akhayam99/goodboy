import { ChevronLeft } from 'lucide-react';

type Props = {
  readonly label: string;
  readonly onClick: () => void;
};

export const ChatHeaderBack = ({ label, onClick }: Props) => (
  <button
    type="button"
    onClick={onClick}
    className="flex min-w-0 shrink-0 items-center gap-1 rounded-sm text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
  >
    <ChevronLeft size={13} aria-hidden className="shrink-0" />
    <span className="max-w-40 truncate" title={label}>
      {label}
    </span>
  </button>
);
