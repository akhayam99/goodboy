import { X } from 'lucide-react';
import { ICON_SIZE, IconButton } from '@goodboy/ui';

type Props = {
  readonly eyebrow: string;
  readonly label: string;
  readonly removeLabel: string;
  readonly onRemove: () => void;
};

export const SearchChipPill = ({ eyebrow, label, removeLabel, onRemove }: Props) => (
  <span className="inline-flex h-6 shrink-0 items-center gap-1 rounded-sm bg-fill pl-2 text-chip text-foreground">
    <span className="text-faint-foreground">{eyebrow}</span>
    <span className="max-w-40 truncate text-foreground">{label}</span>
    <IconButton
      icon={X}
      label={removeLabel}
      size="xs"
      iconSize={ICON_SIZE.mark}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onRemove}
      className="h-6 w-5"
    />
  </span>
);
