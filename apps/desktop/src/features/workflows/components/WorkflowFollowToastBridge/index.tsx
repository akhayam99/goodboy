import { useEffect } from 'react';
import type { AgentId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { isWatchingWorkflowLens } from '../../../../store/slices/workflows/isWatchingWorkflowLens';
import { useAgentStartedToast } from '../../../../shared/hooks/useAgentStartedToast';

type StepStartedDetail = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
  readonly stepName: string;
};

export const WorkflowFollowToastBridge = () => {
  const announceAgentStarted = useAgentStartedToast();

  useEffect(() => {
    const onStepStarted = (event: Event) => {
      const detail = (event as CustomEvent<StepStartedDetail>).detail;
      if (detail == null) {
        return;
      }
      const state = useAppStore.getState();
      const isWatching = isWatchingWorkflowLens({ state, sessionId: detail.sessionId });
      const isSelected = state.selectedAgentId?.[detail.sessionId] === detail.agentId;
      if (isWatching || isSelected) {
        return;
      }
      announceAgentStarted({
        sessionId: detail.sessionId,
        agentId: detail.agentId,
        title: `${detail.stepName} started`,
        message: 'The workflow moved on to the next step.',
        actionLabel: 'Follow',
        lens: 'workflows',
      });
    };
    window.addEventListener('goodboy:workflow-step-started', onStepStarted);
    return () => window.removeEventListener('goodboy:workflow-step-started', onStepStarted);
  }, [announceAgentStarted]);

  return null;
};
