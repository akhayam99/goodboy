import type { AutoTreeView } from '../../../store/slices/auto-view/state';

export type HoldCard = Readonly<{
  title: string;
  reason: string;
  workflowName: string;
  suggestionId: string | null;
  switchLabel: string | null;
  continueLabel: string;
  stopLabel: string;
  carryLine: string | null;
}>;

type Params = {
  readonly view: AutoTreeView;
};

const TITLE = 'Stopped on the first check';

const STOP_LABEL = 'Stop the run';

const CARRY_LINE = 'Your findings and guidance carry over.';

export const holdCardOf = ({ view }: Params): HoldCard | null => {
  const hold = view.hold;
  if (hold == null) {
    return null;
  }
  const workflowName = view.guide?.name ?? 'the workflow';
  const suggestionId = hold.suggestionId ?? null;
  const isSwitchOffered = suggestionId !== null && hold.suggestion !== null;
  return {
    title: TITLE,
    reason: hold.reason,
    workflowName,
    suggestionId: isSwitchOffered ? suggestionId : null,
    switchLabel: isSwitchOffered ? `Switch to ${hold.suggestion}` : null,
    continueLabel: `Continue with ${workflowName}`,
    stopLabel: STOP_LABEL,
    carryLine: isSwitchOffered ? CARRY_LINE : null,
  };
};
