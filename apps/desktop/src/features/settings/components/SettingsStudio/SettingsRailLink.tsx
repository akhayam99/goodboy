import { ArrowRight } from '@goodboy/ui/icons';
import { FOCUS_RING, ICON_SIZE, SelectableRow, cn } from '@goodboy/ui';

type Props = {
  readonly label: string;
  readonly onClick: () => void;
};

export const SettingsRailLink = ({ label, onClick }: Props) => (
  <SelectableRow
    selected={false}
    onClick={onClick}
    className={cn(
      'h-7 items-center gap-2 px-2 text-meta text-faint-foreground hover:text-foreground',
      FOCUS_RING,
      'motion-safe:transition-colors',
    )}
  >
    <span className="min-w-0 flex-1 truncate">{label}</span>
    <ArrowRight size={ICON_SIZE.row} aria-hidden className="shrink-0" />
  </SelectableRow>
);
