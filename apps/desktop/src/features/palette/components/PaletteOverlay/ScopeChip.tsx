import type { LucideIcon } from 'lucide-react';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly icon: LucideIcon;
  readonly label: string;
  readonly hint: string;
};

export const ScopeChip = ({ icon: Icon, label, hint }: Props) => (
  <span
    title={hint}
    className="flex h-7 max-w-64 shrink-0 items-center gap-2 rounded-md bg-fill px-2 text-label text-foreground"
  >
    <Icon size={ICON_SIZE.control} aria-hidden className="shrink-0 text-muted-foreground" />
    <span className="truncate">{label}</span>
  </span>
);
