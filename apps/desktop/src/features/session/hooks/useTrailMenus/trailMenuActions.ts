import { Plus, Square } from 'lucide-react';
import type { Agent, SessionId } from '@goodboy/types';
import type { CrumbMenuAction } from '@goodboy/ui';
import { openLens } from '../../openLens';
import { createAgentEventName } from '../../createAgentEventName';

export const startWorkflowAction = ({
  sessionId,
}: {
  readonly sessionId: SessionId;
}): CrumbMenuAction => ({
  id: 'start-workflow',
  label: 'Start a run',
  icon: Plus,
  confirm: null,
  onRun: () =>
    window.dispatchEvent(
      new CustomEvent('goodboy:open-workflow-builder', { detail: { sessionId } }),
    ),
});

export const startAgentAction = ({
  sessionId,
}: {
  readonly sessionId: SessionId;
}): CrumbMenuAction => ({
  id: 'start-agent',
  label: 'Start agent',
  icon: Plus,
  confirm: null,
  onRun: () => {
    openLens({ sessionId, lens: 'agents' });
    window.requestAnimationFrame(() =>
      window.dispatchEvent(new CustomEvent(createAgentEventName(sessionId))),
    );
  },
});

type StopStepParams = {
  readonly agent: Agent;
  readonly isTurnLive: boolean;
  readonly onStop: () => void;
};

export const stopStepActions = ({
  agent,
  isTurnLive,
  onStop,
}: StopStepParams): ReadonlyArray<CrumbMenuAction> =>
  agent.status === 'running' || isTurnLive
    ? [
        {
          id: 'stop',
          label: 'Stop this step',
          icon: Square,
          confirm: {
            title: `Stop ${agent.name}?`,
            description: 'The edits it made so far stay in the branch. Later steps wait for you.',
            confirmLabel: 'Stop step',
          },
          onRun: onStop,
        },
      ]
    : [];
