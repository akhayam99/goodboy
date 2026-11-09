import { ArrowLeft } from 'lucide-react';
import type { DrawerChip } from '../drawerBackChipContext';
import { ICON_SIZE } from '../iconSize';
import { Button } from './Button';

type Props = {
  readonly chip: DrawerChip;
};

export const DrawerBackChip = ({ chip }: Props) => {
  const label = chip.title === null ? chip.kind : `${chip.kind} · ${chip.title}`;
  return (
    <Button
      variant="secondary"
      size="xs"
      data-drawer-back-chip=""
      aria-label={`Back to ${label}`}
      className="min-w-0 max-w-1/2 shrink justify-start"
      onClick={chip.onBack}
    >
      <ArrowLeft size={ICON_SIZE.row} aria-hidden className="shrink-0" />
      <span className="shrink-0">{chip.kind}</span>
      {chip.title === null ? null : (
        <span className="min-w-0 truncate text-muted-foreground">· {chip.title}</span>
      )}
    </Button>
  );
};
