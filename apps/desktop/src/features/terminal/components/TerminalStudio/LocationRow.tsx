import { Folder, GitBranch } from 'lucide-react';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import type { TerminalTarget } from '../../terminalTargets';
import { PathLine } from '../PathLine';
import { TargetPicker } from './TargetPicker';

type Props = {
  readonly cwd: string;
  readonly branch: string | null;
  readonly targets: ReadonlyArray<TerminalTarget>;
  readonly isIdle: boolean;
  readonly onChangeDirectory: (target: TerminalTarget) => void;
};

export const LocationRow = ({ cwd, branch, targets, isIdle, onChangeDirectory }: Props) => {
  return (
    <div className="flex h-8 shrink-0 items-center gap-2 px-3">
      <Folder size={ICON_SIZE.row} aria-hidden className="shrink-0 text-faint-foreground" />
      <PathLine path={cwd} />
      {branch === null ? null : (
        <span className="flex shrink-0 items-center gap-1 font-mono text-meta text-faint-foreground">
          <GitBranch size={ICON_SIZE.row} aria-hidden />
          {branch}
        </span>
      )}
      <span className="flex-1" />
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
