import { useEffect } from 'react';
import type { Session, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { selectSessionDraft } from '../../../../store/slices/sessionDraft/selectSessionDraft';
import { WorkflowBuilderView, type BuilderKickoff } from '../WorkflowBuilderView';

type Props = {
  readonly workspaceId: WorkspaceId;
};

export const KICKOFF_GOAL_PLACEHOLDER = 'What should get done?';

export const WorkflowStart = ({ workspaceId }: Props) => {
  const loadPhaseTemplates = useAppStore((state) => state.loadPhaseTemplates);
  const patchSessionDraft = useAppStore((state) => state.patchSessionDraft);
  const startSessionFromDraft = useAppStore((state) => state.startSessionFromDraft);
  const goal = useAppStore((state) => selectSessionDraft({ state, workspaceId }).workflowGoal);

  useEffect(() => {
    void loadPhaseTemplates(workspaceId);
  }, [loadPhaseTemplates, workspaceId]);

  const kickoff: BuilderKickoff = {
    workspaceId,
    goal,
    goalPlaceholder: KICKOFF_GOAL_PLACEHOLDER,
    onGoalChange: (next) => patchSessionDraft({ workspaceId, patch: { workflowGoal: next } }),
    start: async (run: (session: Session) => Promise<void>) => {
      await startSessionFromDraft({
        workspaceId,
        start: { kind: 'workflow-run', goal: goal.trim(), run },
      });
    },
  };

  return <WorkflowBuilderView kickoff={kickoff} />;
};
