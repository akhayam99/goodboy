import { Pin } from 'lucide-react';
import { IconButton } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly name: string;
  readonly command: string;
  readonly isPinned: boolean;
  readonly onTogglePin: () => void;
};

export const ProjectScriptRow = ({ name, command, isPinned, onTogglePin }: Props) => (
  <div className="grid h-7 grid-cols-[minmax(0,160px)_minmax(0,1fr)_auto] items-center gap-3">
    <span className="truncate font-mono text-code text-foreground">{name}</span>
    <span className="truncate font-mono text-meta text-faint-foreground">{command}</span>
    <IconButton
      variant="ghost"
      icon={Pin}
      iconSize={ICON_SIZE.row}
      label={isPinned ? `Unpin ${name}` : `Pin ${name}`}
      aria-pressed={isPinned}
      tone={isPinned ? 'primary' : 'neutral'}
      className="p-1"
      onClick={onTogglePin}
    />
  </div>
);
