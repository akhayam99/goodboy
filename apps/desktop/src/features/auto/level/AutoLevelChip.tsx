import type { AutoLevel } from '@goodboy/core';
import { AsksYouChip } from '../../workflows/AsksYouChip';
import { runAutonomyOf } from '../../workflows/runAutonomy';

type PickParams = {
  readonly next: AutoLevel;
};

type Props = {
  readonly value: AutoLevel;
  readonly isPicked: boolean;
  readonly workspaceName: string;
  readonly isDisabled: boolean;
  readonly onPick: (params: PickParams) => void;
};

const HELP =
  'How much Auto does without asking. A change applies from the next step. A step already waiting for your go keeps waiting.';

export const AutoLevelChip = ({ value, isPicked, workspaceName, isDisabled, onPick }: Props) => {
  const own = runAutonomyOf({ autoRun: false, autonomy: value });
  return (
    <AsksYouChip
      value={own.key}
      words={{
        value: own.label,
        source: isPicked ? 'this run' : `from ${workspaceName}`,
        chain: isPicked
          ? `This run: ${own.label}. The run wins.`
          : `From ${workspaceName}: ${own.label}.`,
      }}
      help={HELP}
      error={null}
      isDisabled={isDisabled}
      onPick={onPick}
    />
  );
};
