import { useEffect, useState } from 'react';
import { brandId, type Agent, type AgentId, type MountId, type SessionId } from '@goodboy/types';
import { applyDocumentTheme } from '../../../../../shared/lib/theme';
import { useAppStore } from '../../../../../store';
import { OverlapChip } from '../../../../../features/overlap/OverlapChip';
import { SESSION } from '../activityRunSeed';
import { mockSceneIpc } from '../mockSceneIpc';

export type OverlapView = 'rows' | 'open';

type Props = {
  readonly theme: 'dark' | 'light';
  readonly view: OverlapView;
};

type RowSeed = Readonly<{
  sessionId: SessionId;
  mountId: MountId;
  agentId: AgentId;
  title: string;
  branch: string;
  paths: ReadonlyArray<string>;
  createdAt: number;
}>;

const WIDTH = 760;
const HEIGHT = 360;
const CLICK_DELAY_MS = 300;
const PROJECT_ID = 'mock-overlap-project-ledger-core';

const ROWS: ReadonlyArray<RowSeed> = [
  {
    sessionId: brandId<SessionId>({ value: 'mock-overlap-session-398' }),
    mountId: brandId<MountId>({ value: 'mock-overlap-mount-retry' }),
    agentId: brandId<AgentId>({ value: 'mock-overlap-agent-retry' }),
    title: 'Retry the Harborline ledger export',
    branch: 'hl/retry-export',
    paths: ['src/retry/state.ts', 'src/retry/backoff.ts', 'src/retry/index.ts'],
    createdAt: 1,
  },
  {
    sessionId: brandId<SessionId>({ value: 'mock-overlap-session-412' }),
    mountId: brandId<MountId>({ value: 'mock-overlap-mount-batch' }),
    agentId: brandId<AgentId>({ value: 'mock-overlap-agent-batch' }),
    title: 'Batch the Northwind statements',
    branch: 'hl/ledger-batch',
    paths: [
      'src/retry/state.ts',
      'src/batch/plan.ts',
      'src/batch/run.ts',
      'src/batch/queue.ts',
      'src/batch/report.ts',
      'src/batch/index.ts',
      'src/batch/limits.ts',
    ],
    createdAt: 2,
  },
];

type SeedParams = {
  readonly row: RowSeed;
};

const agentOf = ({ row }: SeedParams): Agent => ({
  id: row.agentId,
  sessionId: row.sessionId,
  ordinal: 1,
  name: 'Implementer',
  kind: 'implementer',
  status: 'running',
  mountId: row.mountId,
});

const liveMountOf = ({ row }: SeedParams) => ({
  mountId: row.mountId,
  sessionId: row.sessionId,
  projectId: PROJECT_ID,
  branch: row.branch,
  createdAt: row.createdAt,
  port: null,
  hasFixedPort: false,
  paths: row.paths,
});

export const OverlapScene = ({ theme, view }: Props) => {
  const [isReady, setIsReady] = useState(false);
  useEffect(() => {
    applyDocumentTheme({ theme });
    const mounts = ROWS.map((row) => liveMountOf({ row }));
    mockSceneIpc((command) => (command === 'overlap_read' ? mounts : null));
    useAppStore.setState({
      sessions: ROWS.map((row) => ({ ...SESSION, id: row.sessionId, goal: row.title })),
      sessionPhaseRuns: Object.fromEntries(ROWS.map((row) => [row.sessionId, [agentOf({ row })]])),
    });
    setIsReady(true);
  }, [theme]);
  useEffect(() => {
    if (!isReady || view !== 'open') {
      return;
    }
    const timer = window.setTimeout(() => {
      const chip = [...document.querySelectorAll<HTMLButtonElement>('button')].find((button) =>
        (button.textContent ?? '').startsWith('Overlaps Retry'),
      );
      chip?.click();
    }, CLICK_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [isReady, view]);
  if (!isReady) {
    return null;
  }
  return (
    <div
      data-shot
      style={{ width: WIDTH, height: HEIGHT }}
      className="flex flex-col gap-2 bg-background p-6"
    >
      {ROWS.map((row) => (
        <div
          key={row.mountId}
          className="flex min-w-0 items-center gap-3 rounded-md border border-border-soft bg-subtle px-3 py-2"
        >
          <span className="shrink-0 text-body text-foreground">Implementer</span>
          <span className="min-w-0 flex-1 truncate text-meta text-muted-foreground">
            {row.title}
          </span>
          <span className="shrink-0 text-code text-faint-foreground">{row.branch}</span>
          <OverlapChip mountId={row.mountId} placement="session" />
        </div>
      ))}
    </div>
  );
};
