import { useEffect, useMemo, useState } from 'react';
import { brandId, type AgentId, type MountId, type ProjectId } from '@goodboy/types';
import type { HistoryRun } from '../../../../../store/slices/history/types';
import { useAppStore } from '../../../../../store';
import { applyDocumentTheme } from '../../../../../shared/lib/theme';
import type { BranchFacts } from '../../../../../features/session/central/branches/branchFactsOf';
import { branchEntriesOf } from '../../../../../features/session/central/branches/branchStoryOf';
import { branchBoardOf } from '../../../../../features/session/central/board/branchBoardOf';
import type { BoardRow } from '../../../../../features/session/central/board/boardTypes';
import type { ActionCardModel } from '../../../../../features/session/central/next/actionCardsOf';
import type { CardVerb } from '../../../../../features/session/central/next/useActionCardActions';
import {
  BoardContext,
  type BoardContextValue,
} from '../../../../../features/session/components/ProjectBlocks/BoardContext';
import { BoardTile } from '../../../../../features/session/components/ProjectBlocks/BoardTile';
import { SESSION } from '../activityRunSeed';
import { mockSceneIpc } from '../mockSceneIpc';

type Props = {
  readonly theme: 'dark' | 'light';
};

type CaseSeed = Readonly<{
  id: string;
  branch: string;
  facts: Partial<Pick<BranchFacts, 'behind' | 'request' | 'status'>> & {
    readonly isMergeable?: boolean;
    readonly checks?: 'success' | 'failure' | 'pending' | null;
  };
  runningCount: number;
  attention: 'needs-approval' | null;
  card: { readonly kind: ActionCardModel['kind']; readonly verb: string } | null;
}>;

const WIDTH = 760;
const PROJECT_ID = brandId<ProjectId>({ value: 'mock-rows-project-ledger-core' });

const CASES: ReadonlyArray<CaseSeed> = [
  {
    id: 'conflicts',
    branch: 'nw/ledger-rounding',
    facts: { checks: 'success', isMergeable: false, behind: 3 },
    runningCount: 0,
    attention: null,
    card: { kind: 'rebase-project', verb: 'Rebase' },
  },
  {
    id: 'permission',
    branch: 'nw/ledger-export',
    facts: { checks: 'pending' },
    runningCount: 1,
    attention: 'needs-approval',
    card: null,
  },
  {
    id: 'stopped',
    branch: 'nw/ledger-credits',
    facts: { request: null },
    runningCount: 0,
    attention: null,
    card: null,
  },
  {
    id: 'running',
    branch: 'nw/ledger-retry',
    facts: { checks: 'pending' },
    runningCount: 1,
    attention: null,
    card: { kind: 'push-branch', verb: 'Push' },
  },
  {
    id: 'ready',
    branch: 'nw/ledger-invoices',
    facts: { checks: 'success' },
    runningCount: 0,
    attention: null,
    card: { kind: 'merge-pr', verb: 'Merge' },
  },
];

type FactsParams = {
  readonly seed: CaseSeed;
};

const factsOf = ({ seed }: FactsParams): BranchFacts => {
  const hasRequest = seed.facts.request !== null;
  return {
    mountId: brandId<MountId>({ value: `mock-rows-mount-${seed.id}` }),
    mountPath: `/wt/${seed.id}`,
    projectId: PROJECT_ID,
    projectName: 'ledger-core',
    branch: seed.branch,
    baseBranch: 'main',
    request: hasRequest
      ? {
          noun: '#',
          number: 412,
          isDraft: false,
          state: 'open',
          checksWord: null,
          checks: seed.facts.checks ?? null,
          reviewDecision: null,
          isMergeable: seed.facts.isMergeable ?? true,
          isChecksAbsent: false,
          isReviewOptional: false,
        }
      : null,
    behind: seed.facts.behind ?? null,
    isStale: false,
    checkedAgo: null,
    liveCount: 0,
    liveTitle: null,
    isFinished: false,
    status: hasRequest
      ? null
      : {
          ahead: 2,
          changedFiles: 0,
          isRebasing: true,
          push: { kind: 'not-pushed', commits: 2 },
        },
    series: null,
  };
};

type VerbParams = {
  readonly label: string;
};

const verbOf = ({ label }: VerbParams): CardVerb => ({
  label,
  ariaLabel: undefined,
  isDisabled: false,
  isBusy: false,
  confirmRole: null,
  confirm: null,
  hasPicker: false,
  run: () => undefined,
});

type IdParams = {
  readonly id: string;
};

type CardParams = {
  readonly seed: CaseSeed;
};

const cardOf = ({ seed }: CardParams): ActionCardModel | null =>
  seed.card === null
    ? null
    : {
        id: `mock-rows-card-${seed.id}`,
        band: 1,
        priority: 0,
        kind: seed.card.kind,
        title: seed.card.verb,
        detail: null,
        mountId: `mock-rows-mount-${seed.id}`,
        source: {
          kind: 'auto',
          target: {
            agentId: brandId<AgentId>({ value: `mock-rows-agent-${seed.id}` }),
            rootAgentId: brandId<AgentId>({ value: `mock-rows-agent-${seed.id}` }),
            role: 'Implementer',
            noun: 'Implementer',
            kind: 'blocked',
            reason: null,
            reasonCode: null,
            mountId: `mock-rows-mount-${seed.id}`,
            plan: null,
            canRetry: false,
          },
        },
        folded: [],
        reason: null,
        evidence: [],
      };

const STOPPED_MOUNT = brandId<MountId>({ value: 'mock-rows-mount-stopped' });

const stoppedRunOf = (): HistoryRun => ({
  sessionId: SESSION.id,
  mountId: STOPPED_MOUNT,
  origin: 'rebase',
  phase: 'stopped',
  planId: null,
  agentId: null,
  copyPath: null,
  stop: { reason: 'conflict', message: 'Two files conflict', files: [], sha: null },
  result: null,
  backupRef: null,
  remoteSha: null,
  holder: null,
  progress: null,
  applied: null,
  identity: null,
  movedHead: null,
  threadShas: [],
  commitCount: null,
  updatedAt: 0,
});

export const BranchRowsScene = ({ theme }: Props) => {
  const [isReady, setIsReady] = useState(false);
  useEffect(() => {
    applyDocumentTheme({ theme });
    mockSceneIpc(() => null);
    useAppStore.setState({ historyRuns: { [STOPPED_MOUNT]: stoppedRunOf() } });
    setIsReady(true);
  }, [theme]);
  const value = useMemo((): BoardContextValue => {
    const facts = CASES.map((seed) => factsOf({ seed }));
    const board = branchBoardOf({
      session: SESSION,
      branches: facts,
      asks: [],
      agents: [],
      leads: [],
    });
    const entries = branchEntriesOf({ facts, detailByMountId: new Map() });
    const all = [...entries.live, ...entries.finished];
    const rows = board.rows.map((row): BoardRow => {
      const seed = CASES.find((candidate) => row.mountId === `mock-rows-mount-${candidate.id}`);
      return seed?.attention === 'needs-approval'
        ? {
            ...row,
            group: 'needs-you',
            stage: { ...row.stage, attention: 'needs-approval' },
          }
        : row;
    });
    const seedOf = ({ id }: IdParams) =>
      CASES.find((candidate) => id === `mock-rows-mount-${candidate.id}`);
    return {
      session: SESSION,
      now: Date.now(),
      rowById: new Map(rows.map((row) => [row.id, row])),
      entryByRowId: new Map(
        rows.flatMap((row) => {
          const entry = all.find((candidate) => candidate.fact.mountId === row.mountId);
          return entry === undefined ? [] : [[row.id, entry] as const];
        }),
      ),
      runningByRowId: new Map(
        rows.map((row) => [row.id, seedOf({ id: row.mountId ?? '' })?.runningCount ?? 0]),
      ),
      settledAtByMountId: new Map(),
      newRowIds: new Set(),
      diffStatByPath: new Map(),
      cardsByRowId: new Map(
        rows.flatMap((row) => {
          const seed = seedOf({ id: row.mountId ?? '' });
          const card = seed === undefined ? null : cardOf({ seed });
          return card === null ? [] : [[row.id, [card]] as const];
        }),
      ),
      mergeCard: null,
      actionsFor: ({ card }) => ({
        main: verbOf({ label: card.title }),
        second: null,
        failure: null,
        isBusy: false,
        agentKind: null,
        menu: null,
        foldedTarget: null,
      }),
      openFor: () => null,
      removal: { targets: [], isBusy: false, sizeLabel: null, run: async () => undefined },
      shownAskIds: new Set(),
      isPermissionShown: false,
    };
  }, []);
  if (!isReady) {
    return null;
  }
  return (
    <BoardContext.Provider value={value}>
      <div
        data-shot
        style={{ width: WIDTH }}
        className="flex flex-col gap-1 rounded-lg bg-subtle p-2"
      >
        {[...value.rowById.keys()].map((rowId) => (
          <BoardTile key={rowId} rowId={rowId} />
        ))}
      </div>
    </BoardContext.Provider>
  );
};
