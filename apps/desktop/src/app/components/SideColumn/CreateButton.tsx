import { Plus } from 'lucide-react';
import { Button, StatusDot, Tooltip, cn, tintClasses } from '@goodboy/ui';
import { ICON_SIZE } from '../../../shared/components/conceptIcons';

type Props = {
  readonly id: string;
  readonly label: string;
  readonly accessibleName: string;
  readonly tooltip: string;
  readonly isPrimary?: boolean;
  readonly isCurrent?: boolean;
  readonly hasDot?: boolean;
  readonly onSelect: () => void;
};

const PRIMARY = tintClasses('primary');

export const CreateButton = ({
  id,
  label,
  accessibleName,
  tooltip,
  isPrimary = false,
  isCurrent = false,
  hasDot = false,
  onSelect,
}: Props) => (
  <Tooltip content={tooltip} side="bottom">
    <Button
      variant={isPrimary ? 'ghost' : 'secondary'}
      data-create={id}
      aria-current={isCurrent ? 'page' : undefined}
      aria-label={accessibleName}
      onClick={onSelect}
      className={cn(
        'relative min-w-0 gap-1 px-1 font-normal',
        isPrimary &&
          cn(
            'ring-1 ring-inset',
            PRIMARY.ring,
            isCurrent ? 'bg-selected' : cn(PRIMARY.bg, PRIMARY.hoverBg),
          ),
        !isPrimary && isCurrent && 'bg-selected',
      )}
    >
      <Plus
        size={ICON_SIZE.row}
        aria-hidden
        className={cn('shrink-0', isPrimary && PRIMARY.icon)}
      />
      <span className="min-w-0 truncate">{label}</span>
      {hasDot ? (
        <span aria-hidden data-slot="draft-dot" className="absolute right-1 top-1 flex">
          <StatusDot tone="primary" size="sm" />
        </span>
      ) : null}
    </Button>
  </Tooltip>
);
