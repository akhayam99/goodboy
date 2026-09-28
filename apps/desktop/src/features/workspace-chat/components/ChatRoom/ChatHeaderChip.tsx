import type { ReactNode } from 'react';

type Props = {
  readonly icon: ReactNode;
  readonly label: string;
};

export const ChatHeaderChip = ({ icon, label }: Props) => (
  <span className="flex h-6 shrink-0 items-center gap-1 rounded-md border border-border-soft bg-subtle px-2 text-secondary text-muted-foreground">
    {icon}
    {label}
  </span>
);
