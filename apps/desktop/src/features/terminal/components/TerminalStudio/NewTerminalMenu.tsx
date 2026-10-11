import { Plus } from 'lucide-react';
import { Button, ICON_SIZE } from '@goodboy/ui';
import type { TerminalTarget } from '../../terminalTargets';
import { TargetPicker } from './TargetPicker';

type Props = {
  readonly targets: ReadonlyArray<TerminalTarget>;
  readonly onNew: () => void;
  readonly onOpenAt: (target: TerminalTarget) => void;
};

export const NewTerminalMenu = ({ targets, onNew, onOpenAt }: Props) => (
  <div className="flex items-center gap-1">
    <Button size="sm" onClick={onNew}>
      <Plus size={ICON_SIZE.row} aria-hidden />
      New terminal
    </Button>
    {targets.length > 1 ? (
      <TargetPicker
        targets={targets}
        label="New terminal in"
        valueLabel={<span aria-hidden />}
        onPick={onOpenAt}
      />
    ) : null}
  </div>
);
