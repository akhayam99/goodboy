import { useEffect, useRef } from 'react';
import type { AgentId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { isWatchingWorkflowLens } from '../../../../store/slices/workflows/isWatchingWorkflowLens';
import { useAgentStartedToast } from '../../../../shared/hooks/useAgentStartedToast';
import { useToast } from '../../../../app/components/Toast';

type StepStartedDetail = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
  readonly stepName: string;
};

export const WorkflowFollowToastBridge = () => {
  const announceAgentStarted = useAgentStartedToast();
  const { showToast } = useToast();
  const generations = useAppStore((state) => state.workflowGenerations);
  const visibleWorkspaceId = useAppStore((state) => state.visibleWorkflowStudioWorkspaceId);
  const announced = useRef(new Set<string>());

  useEffect(() => {
    for (const generation of Object.values(generations)) {
      if (generation?.status !== 'complete') {
        continue;
      }
      if (announced.current.has(generation.notificationId)) {
        continue;
      }
      announced.current.add(generation.notificationId);
      if (visibleWorkspaceId === generation.workspaceId) {
        continue;
      }
      showToast('success', 'Your workflow is ready.', {
        action:
          generation.undoSnapshot === null
            ? {
                label: 'Open',
                onClick: () =>
                  window.dispatchEvent(new CustomEvent('goodboy:open-workflow-studio')),
              }
            : {
                label: 'Undo',
                onClick: () =>
                  void useAppStore
                    .getState()
                    .undoWorkflowGeneration({ workspaceId: generation.workspaceId }),
              },
      });
    }
  }, [generations, showToast, visibleWorkspaceId]);

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
