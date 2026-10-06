import { useCallback } from 'react';
import type { Workflow } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore, useCurrentSession, useCurrentWorkspace } from '../../../store';
import { useToast } from '../../../shared/components/Toast';

type StartRun = {
  readonly workflows: ReadonlyArray<Workflow>;
  readonly start: (workflow: Workflow) => void;
};

export const useStartRun = (): StartRun => {
  const workspace = useCurrentWorkspace();
  const session = useCurrentSession();
  const workflows = useAppStore((s) =>
    workspace === null ? EMPTY_ARRAY : (s.phaseTemplates[workspace.id] ?? EMPTY_ARRAY),
  ) as ReadonlyArray<Workflow>;
  const attachWorkflowToSession = useAppStore((s) => s.attachWorkflowToSession);
  const reportError = useAppStore((s) => s.reportError);
  const { showToast } = useToast();
  const sessionId = session === null ? null : session.id;

  const start = useCallback(
    (workflow: Workflow) => {
      if (sessionId === null) {
        return;
      }
      void attachWorkflowToSession(sessionId, workflow.id, { navigate: true })
        .then(() => showToast({ kind: 'success', message: `Started ${workflow.name}.` }))
        .catch((error: unknown) =>
          reportError({ title: `Couldn't start ${workflow.name}`, error, sessionId }),
        );
    },
    [attachWorkflowToSession, reportError, sessionId, showToast],
  );

  return { workflows, start };
};
