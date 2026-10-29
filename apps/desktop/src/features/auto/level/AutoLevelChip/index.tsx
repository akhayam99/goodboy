import type { AutoLevel } from '@goodboy/core';
import { AsksYouChip } from '../../../workflows/AsksYouChip';
import { asksWordsOf } from '../../../workflows/asksWordsOf';
import { runAutonomyOf } from '../../../workflows/runAutonomy';

type PickParams = {
  readonly next: AutoLevel;
};

type Props = {
  readonly value: AutoLevel;
  readonly workspaceLevel: AutoLevel;
  readonly workspaceName: string;
  readonly error: string | null;
  readonly isDisabled: boolean;
  readonly onPick: (params: PickParams) => void;
};

const HELP =
  'How much Auto may do alone. A change applies to what Auto starts next; an agent already waiting for your go keeps waiting.';

export const AutoLevelChip = ({
  value,
  workspaceLevel,
  workspaceName,
  error,
  isDisabled,
  onPick,
}: Props) => {
  const own = runAutonomyOf({ autoRun: false, autonomy: value });
  return (
    <AsksYouChip
      value={own.key}
      words={asksWordsOf({ own, workspaceName, workspaceAutonomy: workspaceLevel })}
      help={HELP}
      error={error}
      isDisabled={isDisabled}
      onPick={onPick}
    />
  );
};
