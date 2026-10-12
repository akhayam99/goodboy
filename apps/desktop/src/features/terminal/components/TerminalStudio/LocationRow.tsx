import { Folder } from 'lucide-react';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import type { TerminalTarget } from '../../terminalTargets';
import { TargetPicker } from './TargetPicker';

type Props = {
  readonly cwd: string;
  readonly targets: ReadonlyArray<TerminalTarget>;
  readonly isIdle: boolean;
  readonly onChangeDirectory: (target: TerminalTarget) => void;
};

export const LocationRow = ({ cwd, targets, isIdle, onChangeDirectory }: Props) => {
  return (
    <div className="flex h-8 shrink-0 items-center gap-2 px-3">
      <Folder size={ICON_SIZE.row} aria-hidden className="shrink-0 text-faint-foreground" />
      <span className="min-w-0 flex-1 truncate font-mono text-meta text-muted-foreground">
        {cwd}
      </span>
      {isIdle && targets.length > 1 ? (
        <TargetPicker
          targets={targets}
          label="Change directory in this terminal"
          valueLabel={<span className="font-mono text-meta">cd</span>}
          onPick={onChangeDirectory}
        />
      ) : null}
    </div>
  );
};
