import { Chip, IconButton } from '@goodboy/ui';
import { Folder, PanelLeftOpen } from 'lucide-react';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import type { TerminalTarget } from '../../terminalTargets';
import { TargetPicker } from './TargetPicker';

type Props = {
  readonly cwd: string;
  readonly targets: ReadonlyArray<TerminalTarget>;
  readonly isIdle: boolean;
  readonly onDock: (() => void) | undefined;
  readonly onOpenAt: (target: TerminalTarget) => void;
  readonly onChangeDirectory: (target: TerminalTarget) => void;
};

export const LocationRow = ({
  cwd,
  targets,
  isIdle,
  onDock,
  onOpenAt,
  onChangeDirectory,
}: Props) => {
  return (
    <div className="flex h-8 shrink-0 items-center gap-2 px-3">
      {onDock === undefined ? null : (
        <IconButton
          icon={PanelLeftOpen}
          label="Show the terminal list"
          size="xs"
          onClick={onDock}
        />
      )}
      <Folder size={ICON_SIZE.row} aria-hidden className="shrink-0 text-faint-foreground" />
      <span className="min-w-0 flex-1 truncate font-mono text-meta text-muted-foreground">
        {cwd}
      </span>
      <div
        role="group"
        aria-label="Open a terminal in"
        className="flex shrink-0 items-center gap-1"
      >
        {targets.map((target) => (
          <Chip
            key={target.key}
            as="button"
            tone="neutral"
            size="md"
            label={target.label}
            ariaLabel={target.label}
            onClick={() => onOpenAt(target)}
          />
        ))}
        {isIdle && targets.length > 1 ? (
          <TargetPicker
            targets={targets}
            label="Change directory in this terminal"
            valueLabel={<span className="font-mono text-meta">cd</span>}
            onPick={onChangeDirectory}
          />
        ) : null}
      </div>
    </div>
  );
};
