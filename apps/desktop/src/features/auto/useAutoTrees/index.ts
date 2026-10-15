import { useEffect, useRef } from 'react';
import type { SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../store';
import type { AutoTreeView } from '../../../store/slices/auto-view/state';
import { classifyAgent } from '../../session/agent-kind';
import { isAutoTreeActive } from '../autoTreePhases';
import { useAutoTreeViews } from '../useAutoTreeViews';

const POLL_MS = 2000;

type Params = {
  readonly sessionId: SessionId;
};

export const useAutoTrees = ({ sessionId }: Params): ReadonlyArray<AutoTreeView> => {
  const views = useAutoTreeViews({ sessionId });
  const loadAutoTrees = useAppStore((state) => state.loadAutoTrees);
  const reportError = useAppStore((state) => state.reportError);
  const hasAutoAgent = useAppStore((state) =>
    (state.sessionPhaseRuns[sessionId] ?? EMPTY_ARRAY).some(
      (agent) =>
        classifyAgent({ agent, override: state.agentKindOverride[agent.id] ?? null }) === 'auto',
    ),
  );
  const hasReported = useRef(false);
  const isPolling =
    hasAutoAgent || views.some((view) => isAutoTreeActive({ phase: view.tree.phase }));

  useEffect(() => {
    const load = () => {
      loadAutoTrees({ sessionId })
        .then(() => {
          hasReported.current = false;
        })
        .catch((error: unknown) => {
          if (hasReported.current) {
            return;
          }
          hasReported.current = true;
          void reportError({ title: "Couldn't read the Auto agents", error, sessionId });
        });
    };
    load();
    if (!isPolling) {
      return;
    }
    const id = window.setInterval(load, POLL_MS);
    return () => window.clearInterval(id);
  }, [isPolling, loadAutoTrees, reportError, sessionId]);

  return views;
};
