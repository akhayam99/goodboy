import { useCallback } from 'react';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import type { TimelineStreamEntry } from '../../timeline/buildTimelineStream';

type Params = {
  readonly sessionId: SessionId;
};

export type TimelineOpenTarget = {
  readonly label: string;
  readonly open: () => void;
};

type TargetParams = {
  readonly entry: TimelineStreamEntry;
};

export const useTimelineOpen = ({
  sessionId,
}: Params): ((params: TargetParams) => TimelineOpenTarget) =>
  useCallback(
    ({ entry }: TargetParams): TimelineOpenTarget => {
      const store = useAppStore.getState();
      if (entry.kind === 'run') {
        return {
          label: 'Open run',
          open: () => {
            store.setFocusedWorkflowRun(sessionId, entry.run.id);
            store.setActiveLens(sessionId, 'workflows');
          },
        };
      }
      if (entry.kind === 'agent') {
        const isResolver = entry.agentKind === 'resolver';
        return {
          label: isResolver ? 'Open resolve' : 'Open chat',
          open: () => {
            if (isResolver) {
              store.setActiveLens(sessionId, 'resolve');
            }
            void store.selectAgent(sessionId, entry.agent.id);
          },
        };
      }
      if (entry.kind === 'plan') {
        return {
          label: 'Open plan',
          open: () => {
            store.setFocusedPlanId(sessionId, entry.plan.id);
            store.setActiveLens(sessionId, 'plans');
          },
        };
      }
      if (entry.kind === 'issue') {
        return {
          label: `Open ${entry.task.identifier}`,
          open: () => store.openExternalTaskLens(sessionId, entry.task),
        };
      }
      if (entry.kind === 'branch') {
        return { label: 'Open files', open: () => store.setActiveLens(sessionId, 'files') };
      }
      return {
        label: 'Open questions',
        open: () => store.setActiveLens(sessionId, 'questions'),
      };
    },
    [sessionId],
  );
