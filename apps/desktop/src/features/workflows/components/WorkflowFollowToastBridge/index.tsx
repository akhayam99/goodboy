import { useEffect, useRef } from 'react';
import type { AgentId, SessionId } from '@goodboy/types';
import { agentPlace, useAppStore } from '../../../../store';
import { isWatchingWorkflowLens } from '../../../../store/slices/workflows/isWatchingWorkflowLens';
import { useFollowToast } from '../../../../shared/hooks/useFollowToast';
import { useToast } from '../../../../shared/components/Toast';
import { isUserStart } from '../../../../shared/lib/userStarts';

type StepStartedDetail = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
  readonly stepName: string;
};

export const WorkflowFollowToastBridge = () => {
  const followStep = useFollowToast();
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
      if (generation.undoSnapshot !== null) {
        useAppStore.getState().undoable({
          showToast,
          message: 'Your workflow is ready.',
          undo: async () => {
            await useAppStore
              .getState()
              .undoWorkflowGeneration({ workspaceId: generation.workspaceId });
          },
        });
        continue;
      }
      showToast({
        kind: 'success',
        message: 'Your workflow is ready.',
        action: {
          label: 'Open',
          onClick: () => window.dispatchEvent(new CustomEvent('goodboy:open-workflow-studio')),
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
      const runId =
        (state.sessionPhaseRuns[detail.sessionId] ?? []).find(
          (agent) => agent.id === detail.agentId,
        )?.workflowRunId ?? null;
      if (isUserStart(detail.agentId) || (runId !== null && isUserStart(runId))) {
        return;
      }
      followStep({
        title: `${detail.stepName} started`,
        message: 'The run moved on to the next step.',
        target: { place: agentPlace({ sessionId: detail.sessionId, agentId: detail.agentId }) },
        startKey: runId ?? detail.agentId,
      });
    };
    window.addEventListener('goodboy:workflow-step-started', onStepStarted);
    return () => window.removeEventListener('goodboy:workflow-step-started', onStepStarted);
  }, [followStep]);

  return null;
};
