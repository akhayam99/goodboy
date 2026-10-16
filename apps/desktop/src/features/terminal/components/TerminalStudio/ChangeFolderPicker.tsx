import type { TerminalTarget } from '../../terminalTargets';
import { TargetPicker } from './TargetPicker';

type Props = {
  readonly targets: ReadonlyArray<TerminalTarget>;
  readonly isIdle: boolean;
  readonly onChangeDirectory: (target: TerminalTarget) => void;
};

export const ChangeFolderPicker = ({ targets, isIdle, onChangeDirectory }: Props) => {
  if (targets.length < 2) {
    return null;
  }
  return (
    <TargetPicker
      targets={targets}
      label="Change directory in this terminal"
      valueLabel="Change folder"
      {...(!isIdle && { disabledReason: 'Stop the running command to change folder' })}
      onPick={onChangeDirectory}
    />
  );
};
