import { useEffect, useState } from 'react';
import { mockSceneIpc } from './mockSceneIpc';
import type { SessionExternalTask } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { SessionOverviewPane } from '../../../../features/session/components/SessionOverviewPane';
import { SESSION, finishActivityRuns, seedActivityRunScene } from './activityRunSeed';
import { ShellFrame, seedShellChrome } from './shellChrome';

type Props = {
  readonly state?: 'idle' | 'hover' | 'undo';
};

export const TaskLinksScene = ({ state = 'idle' }: Props) => {
  const [isReady, setIsReady] = useState(false);
  useEffect(() => {
    seedActivityRunScene();
    finishActivityRuns();
    seedShellChrome({
      session: SESSION,
      siblings: [],
      branches: {},
      telemetryAt: SESSION.updatedAt,
      lens: null,
    });
    mockSceneIpc((command, args) => {
      if (command === 'db_transaction') {
        const statements: unknown =
          args !== undefined && 'statements' in args ? args.statements : null;
        return {
          status: 'committed',
          results: Array.isArray(statements)
            ? statements.map(() => ({ rowsAffected: 1, rows: [] }))
            : [],
        };
      }
      if (command === 'db_select') {
        return [];
      }
      if (command === 'db_execute') {
        return { rowsAffected: 1 };
      }
      return null;
    });
    const mounts = useAppStore.getState().sessionProjectMounts[SESSION.id] ?? [];
    const first = mounts[0];
    if (first === undefined) {
      return;
    }
    const task: SessionExternalTask = {
      sessionId: SESSION.id,
      projectId: first.projectId,
      provider: 'linear',
      externalId: 'mock-nw-142',
      identifier: 'NW-142',
      title: 'Reconcile duplicate refunds',
      url: 'https://linear.app/northwind/issue/NW-142',
      createdAt: SESSION.createdAt,
    };
    const placements = mounts
      .filter((mount) => mount.projectId === first.projectId && mount.branch !== '')
      .slice(0, 2)
      .map((mount): SessionExternalTask => ({ ...task, scope: 'branch', branch: mount.branch }));
    useAppStore.setState({
      sessionExternalTasks: { [SESSION.id]: [task, ...placements] },
      sessionEvents: { [SESSION.id]: [] },
      undoStack: [],
      undoNotices: [],
    });
    if (state === 'undo') {
      void useAppStore
        .getState()
        .unlinkSessionExternalTask(SESSION.id, task.provider, task.externalId, task.projectId);
    }
    setIsReady(true);
  }, [state]);
  useEffect(() => {
    if (!isReady || state !== 'hover') {
      return;
    }
    document.querySelector<HTMLButtonElement>('button[aria-label^="Open NW-142"]')?.focus();
  }, [isReady, state]);
  if (!isReady) {
    return null;
  }
  const session = {
    ...SESSION,
    state: { kind: 'idle', lastActivityAt: SESSION.updatedAt },
  } satisfies typeof SESSION;
  return (
    <ShellFrame
      session={session}
      sidebar="expanded"
      main={<SessionOverviewPane session={session} onSelectLens={() => undefined} />}
    />
  );
};
