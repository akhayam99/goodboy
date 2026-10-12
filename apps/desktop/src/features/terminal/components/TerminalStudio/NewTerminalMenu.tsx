import { Plus } from 'lucide-react';
import { Button } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import type { TerminalTarget } from '../../terminalTargets';
import { TargetPicker } from './TargetPicker';

type Props = {
  readonly targets: ReadonlyArray<TerminalTarget>;
  readonly onNew: () => void;
  readonly onOpenAt: (target: TerminalTarget) => void;
};

export const NewTerminalMenu = ({ targets, onNew, onOpenAt }: Props) => (
  <div className="flex items-center gap-1">
    <Button variant="secondary" className="min-w-0 flex-1 justify-start" onClick={onNew}>
      <Plus size={ICON_SIZE.control} aria-hidden />
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
