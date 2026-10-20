import { CheckCheck, Pin } from 'lucide-react';
import { IconButton } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly name: string;
  readonly command: string;
  readonly isPinned: boolean;
  readonly isAutoCheck?: boolean;
  readonly onTogglePin: () => void;
  readonly onToggleAutoCheck?: () => void;
};

export const ProjectScriptRow = ({
  name,
  command,
  isPinned,
  isAutoCheck = false,
  onTogglePin,
  onToggleAutoCheck,
}: Props) => (
  <div className="grid h-7 grid-cols-[minmax(0,160px)_minmax(0,1fr)_auto] items-center gap-3">
    <span className="truncate font-mono text-code text-foreground">{name}</span>
    <span className="truncate font-mono text-meta text-faint-foreground">{command}</span>
    <div className="flex items-center gap-1">
      {onToggleAutoCheck === undefined ? null : (
        <IconButton
          size="xs"
          variant="ghost"
          icon={CheckCheck}
          iconSize={ICON_SIZE.row}
          label={
            isAutoCheck ? `Stop using ${name} as an Auto check` : `Use ${name} as an Auto check`
          }
          aria-pressed={isAutoCheck}
          tone={isAutoCheck ? 'primary' : 'neutral'}
          onClick={onToggleAutoCheck}
        />
      )}
      <IconButton
        size="xs"
        variant="ghost"
        icon={Pin}
        iconSize={ICON_SIZE.row}
        label={isPinned ? `Unpin ${name}` : `Pin ${name}`}
        aria-pressed={isPinned}
        tone={isPinned ? 'primary' : 'neutral'}
        onClick={onTogglePin}
      />
    </div>
  </div>
);
