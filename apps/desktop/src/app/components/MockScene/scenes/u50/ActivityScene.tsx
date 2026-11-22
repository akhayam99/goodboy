import { useEffect, useState } from 'react';
import type { WorkEvent } from '@goodboy/db';
import { brandId, type MountId } from '@goodboy/types';
import { SessionWorkspace } from '../../../../../features/session/components/SessionWorkspace';
import { applyDocumentTheme } from '../../../../../shared/lib/theme';
import { useAppStore } from '../../../../../store';
import { sceneClock } from '../../sceneClock';
import { SESSION, SESSION_ID, seedActivityRunScene } from '../activityRunSeed';
import { ShellFrame, seedShellChrome } from '../shellChrome';

type Props = {
  readonly theme: 'dark' | 'light';
};

type RunParams = {
  readonly id: string;
  readonly kind: WorkEvent['kind'];
  readonly mountId: string;
  readonly at: string;
  readonly seconds: number;
  readonly exitCode: number;
  readonly payload: Readonly<Record<string, string>>;
};

const clock = sceneClock({ anchor: '2026-09-18T10:05:00.000Z' });

const runOf = ({ id, kind, mountId, at, seconds, exitCode, payload }: RunParams): WorkEvent => {
  const startedAt = clock.ms({ at });
  return {
    id,
    runId: `run-${id}`,
    sessionId: SESSION_ID,
    mountId: brandId<MountId>({ value: mountId }),
    agentId: null,
    kind,
    startedAt,
    endedAt: startedAt + seconds * 1_000,
    exitCode,
    payload,
  };
};

const WORK_EVENTS: ReadonlyArray<WorkEvent> = [
  runOf({
    id: 'activity-rerun',
    kind: 'check-rerun',
    mountId: 'mock-run-mount-payments',
    at: '2026-09-18T10:03:00.000Z',
    seconds: 240,
    exitCode: 0,
    payload: { name: 'integration-tests' },
  }),
  runOf({
    id: 'activity-relay-test',
    kind: 'script',
    mountId: 'mock-run-mount-console',
    at: '2026-09-18T10:01:00.000Z',
    seconds: 42,
    exitCode: 2,
    payload: { scriptId: 'test:retry', name: 'test:retry' },
  }),
  runOf({
    id: 'activity-payments-test',
    kind: 'script',
    mountId: 'mock-run-mount-payments',
    at: '2026-09-18T09:27:00.000Z',
    seconds: 95,
    exitCode: 1,
    payload: { scriptId: 'test:integration', name: 'test:integration' },
  }),
];

export const ActivityScene = ({ theme }: Props) => {
  const [isReady, setIsReady] = useState(false);
  useEffect(() => {
    applyDocumentTheme({ theme });
    seedActivityRunScene();
    seedShellChrome({
      session: SESSION,
      siblings: [],
      branches: {},
      telemetryAt: clock.iso({ at: '2026-09-18T09:05:00.000Z' }),
      lens: 'activity',
    });
    useAppStore.setState((state) => ({
      selectedAgentId: {},
      workEvents: { ...state.workEvents, [SESSION_ID]: WORK_EVENTS },
      loadWorkEvents: async () => undefined,
    }));
    setIsReady(true);
  }, [theme]);
  if (!isReady) {
    return null;
  }
  return (
    <ShellFrame
      session={SESSION}
      main={
        <div className="relative h-full w-full">
          <SessionWorkspace session={SESSION} />
        </div>
      }
    />
  );
};
