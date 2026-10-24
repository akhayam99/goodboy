import type { TerminalTarget } from '../../terminalTargets';
import { TargetPicker } from './TargetPicker';

type Props = {
  readonly targets: ReadonlyArray<TerminalTarget>;
  readonly isIdle: boolean;
  readonly onChangeDirectory: (target: TerminalTarget) => void;
};

const STATUS = 'The shell runs cd here. This tab stays under the folder it started in.';

export const ChangeFolderPicker = ({ targets, isIdle, onChangeDirectory }: Props) => {
  if (targets.length < 2) {
    return null;
  }
  return (
    <TargetPicker
      targets={targets}
      label="Change directory in this terminal"
      valueLabel="Change folder"
      status={STATUS}
      {...(!isIdle && { disabledReason: 'Stop the running command to change folder' })}
      onPick={onChangeDirectory}
    />
  );
};
