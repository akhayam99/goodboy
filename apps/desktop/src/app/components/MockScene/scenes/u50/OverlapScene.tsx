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
const HEIGHT = 560;
const CLICK_DELAY_MS = 300;
const PROJECT_ID = 'mock-overlap-project-ledger-core';
const TOTALS = 'packages/ledger-core/src/totals.ts';
const ROUND = 'packages/ledger-core/src/round.ts';
const EXPORTER =
  'packages/ledger-core/src/reconcile/statements/export/reconciliationStatementExporter.ts';
const CURRENCY = 'packages/ledger-core/src/currency.ts';
const INDEX = 'packages/ledger-core/src/index.ts';
const OPEN_MOUNT = brandId<MountId>({ value: 'mock-overlap-mount-totals' });

const ROWS: ReadonlyArray<RowSeed> = [
  {
    sessionId: brandId<SessionId>({ value: 'mock-overlap-session-398' }),
    mountId: OPEN_MOUNT,
    agentId: brandId<AgentId>({ value: 'mock-overlap-agent-totals' }),
    title: 'Fix the Harborline ledger totals',
    branch: 'ak/fix-ledger-totals',
    paths: [TOTALS, ROUND, EXPORTER, CURRENCY, INDEX],
    createdAt: 2,
  },
  {
    sessionId: brandId<SessionId>({ value: 'mock-overlap-session-412' }),
    mountId: brandId<MountId>({ value: 'mock-overlap-mount-relay' }),
    agentId: brandId<AgentId>({ value: 'mock-overlap-agent-relay' }),
    title: 'Retry the notify-relay sends',
    branch: 'ak/notify-relay-retry',
    paths: [TOTALS, INDEX, 'services/notify-relay/src/retry.ts'],
    createdAt: 1,
  },
  {
    sessionId: brandId<SessionId>({ value: 'mock-overlap-session-420' }),
    mountId: brandId<MountId>({ value: 'mock-overlap-mount-refunds' }),
    agentId: brandId<AgentId>({ value: 'mock-overlap-agent-refunds' }),
    title: 'Refund the Northwind statements',
    branch: 'ak/payments-api-refunds-for-northwind-statements',
    paths: [
      ROUND,
      EXPORTER,
      CURRENCY,
      'services/payments-api/src/refunds/plan.ts',
      'services/payments-api/src/refunds/run.ts',
      'services/payments-api/src/refunds/report.ts',
      'services/payments-api/src/refunds/limits.ts',
      'services/payments-api/src/refunds/index.ts',
    ],
    createdAt: 3,
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
      document.querySelector<HTMLButtonElement>(`[data-scene-row="${OPEN_MOUNT}"] button`)?.click();
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
          data-scene-row={row.mountId}
          className="flex min-w-0 items-center gap-3 rounded-md border border-border-soft bg-subtle px-3 py-2"
        >
          <span className="shrink-0 text-body text-foreground">Implementer</span>
          <span className="min-w-0 flex-1 truncate text-meta text-muted-foreground">
            {row.title}
          </span>
          <span className="shrink-0 text-code text-faint-foreground">{row.branch}</span>
          <OverlapChip mountId={row.mountId} />
        </div>
      ))}
    </div>
  );
};
