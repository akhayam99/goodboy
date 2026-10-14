import { useCallback } from 'react';
import { SuggestionOverflowMenu } from '../../../actions/SuggestionOverflowMenu';
import { TALK_ACTION_ID } from '../../../actions/kinds/suggestion';
import type {
  ActionHeldParams,
  ActionPreviewParams,
  ActionTrack,
  SuggestionActionTarget,
} from '../../../actions/types';
import type { AgentKind } from '../../../session/agent-kind';
import { NEXT_STEP_CELLS } from './nextStepGrid';

type Props = {
  readonly target: SuggestionActionTarget;
  readonly pendingChoiceIds: ReadonlySet<string>;
  readonly isHeld: boolean;
  readonly isDisabled: boolean;
  readonly onPreview: (kind: AgentKind | null) => void;
  readonly trackChoice: ActionTrack;
};

export const NextStepMenu = ({
  target,
  pendingChoiceIds,
  isHeld,
  isDisabled,
  onPreview,
  trackChoice,
}: Props) => {
  const onActionPreview = useCallback(
    ({ preview }: ActionPreviewParams) => onPreview(preview === null ? null : preview.agentKind),
    [onPreview],
  );

  const track = useCallback<ActionTrack>(
    ({ actionId, task }) =>
      actionId === TALK_ACTION_ID ? task() : trackChoice({ actionId, task }),
    [trackChoice],
  );

  const isActionHeld = useCallback(
    ({ actionId }: ActionHeldParams) =>
      actionId === TALK_ACTION_ID ? isDisabled : isHeld && !pendingChoiceIds.has(actionId),
    [isDisabled, isHeld, pendingChoiceIds],
  );

  return (
    <span data-column="menu" className={NEXT_STEP_CELLS.menu}>
      <SuggestionOverflowMenu
        target={target}
        label={`More options for ${target.suggestion.title}`}
        isDisabled={isDisabled}
        onPreview={onActionPreview}
        track={track}
        isHeld={isActionHeld}
      />
    </span>
  );
};
