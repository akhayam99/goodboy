import type { ReactNode } from 'react';

type Props = {
  readonly icon: ReactNode;
  readonly label: string;
  readonly trailing?: ReactNode;
  readonly onClick: () => void;
};

export const MenuRow = ({ icon, label, trailing, onClick }: Props) => (
  <li>
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-label text-foreground motion-safe:transition-colors hover:bg-hover"
    >
      <span className="flex shrink-0 items-center text-muted-foreground">{icon}</span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {trailing}
    </button>
  </li>
);
