import { useEffect } from 'react';
import type { Session, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { useStartFromDraft } from './useStartFromDraft';
import { useDraftDiscard } from './useDraftDiscard';
import { selectSessionDraft } from '../../../../store/slices/sessionDraft/selectSessionDraft';
import type { Mode } from '../../../../store/slices/workflowDrafts/types';
import {
  WorkflowBuilderView,
  type BuilderKickoff,
} from '../../../workflows/components/WorkflowBuilderView';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly mode: Mode;
};

export const KICKOFF_GOAL_PLACEHOLDER = 'What should get done?';

export const WorkflowStart = ({ workspaceId, mode }: Props) => {
  const loadPhaseTemplates = useAppStore((state) => state.loadPhaseTemplates);
  const patchSessionDraft = useAppStore((state) => state.patchSessionDraft);
  const startSessionFromDraft = useStartFromDraft();
  const { canDiscard, discard } = useDraftDiscard({ workspaceId });
  const goal = useAppStore((state) => selectSessionDraft({ state, workspaceId }).workflowGoal);
  const startError = useAppStore((state) => selectSessionDraft({ state, workspaceId }).startError);

  useEffect(() => {
    void loadPhaseTemplates(workspaceId).catch(() => undefined);
  }, [loadPhaseTemplates, workspaceId]);

  const kickoff: BuilderKickoff = {
    workspaceId,
    goal,
    goalPlaceholder: KICKOFF_GOAL_PLACEHOLDER,
    startError,
    canDiscard,
    onDiscard: discard,
    onGoalChange: (next) => patchSessionDraft({ workspaceId, patch: { workflowGoal: next } }),
    start: async (run: (session: Session) => Promise<void>) => {
      await startSessionFromDraft({
        workspaceId,
        start: { kind: 'workflow-run', goal: goal.trim(), run },
      });
    },
  };

  return (
    <WorkflowBuilderView
      mode={mode}
      kickoff={kickoff}
      onOrchestrateInstead={() =>
        patchSessionDraft({ workspaceId, patch: { choice: 'orchestrate' } })
      }
    />
  );
};
