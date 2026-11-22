// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { brandId, type ProjectId } from '@goodboy/types';
import { branchFactsOf } from './branchFactsOf';
import { branchEntriesOf } from './branchStoryOf';
import { overviewStatusOf } from './overviewStatusOf';
import { aMountRow, aRequest } from './testing/aMountRow';

const NOW = Date.UTC(2026, 10, 20, 10, 0, 0);
const FRESH = new Date(NOW - 60_000).toISOString();

type RowSpec = {
  readonly key: string;
  readonly projectName: string;
  readonly projectKey?: string;
  readonly checks?: 'failure' | 'success' | 'pending' | null;
  readonly state?: 'open' | 'merged';
};

type BranchesParams = {
  readonly rows: ReadonlyArray<RowSpec>;
};

const branchesOf = ({ rows }: BranchesParams) => {
  const mountRows = rows.map(
    ({ key, projectName, projectKey = projectName, checks = null, state = 'open' }) => ({
      ...aMountRow({
        key,
        projectName,
        branch: `ak/hbl-412-${key}`,
        request: aRequest({ provider: 'github', number: 418, checks, state }),
      }),
      projectId: brandId<ProjectId>({ value: `project-${projectKey}` }),
    }),
  );
  const facts = branchFactsOf({
    rows: mountRows,
    fetchedAtByMountId: new Map(mountRows.map((row) => [row.mountId, FRESH])),
    behindByMountId: new Map(),
    liveCountByMountId: new Map(),
    liveTitleByMountId: new Map(),
    statusByMountId: new Map(),
    now: NOW,
  });
  return branchEntriesOf({ facts, detailByMountId: new Map() });
};

describe('overviewStatusOf', () => {
  it('says nothing for a session without branches', () => {
    expect(overviewStatusOf({ branches: { live: [], finished: [] } })).toBeNull();
  });

  it('writes one short sentence per project with the branch word of its most urgent branch', () => {
    const branches = branchesOf({
      rows: [
        { key: 'a', projectName: 'payments-api', checks: 'success' },
        { key: 'b', projectName: 'payments-api', checks: 'failure' },
        { key: 'c', projectName: 'ledger-core', state: 'merged' },
      ],
    });
    const failing = branches.live.find((entry) => entry.fact.mountId === 'mount-b');
    const merged = branches.finished[0];
    expect(failing).toBeDefined();
    expect(merged).toBeDefined();
    const status = overviewStatusOf({ branches });
    expect(status?.toLowerCase()).toBe(
      `payments-api: ${failing?.story.word.toLowerCase()}. ledger-core: ${merged?.story.word.toLowerCase()}.`,
    );
  });

  it('keeps two projects that share a name apart by their id', () => {
    const branches = branchesOf({
      rows: [
        { key: 'a', projectName: 'ledger-core', projectKey: 'ledger-one', checks: 'failure' },
        { key: 'b', projectName: 'ledger-core', projectKey: 'ledger-two', state: 'merged' },
      ],
    });
    const failing = branches.live.find((entry) => entry.fact.mountId === 'mount-a');
    const merged = branches.finished[0];
    expect(failing).toBeDefined();
    expect(merged).toBeDefined();
    expect(overviewStatusOf({ branches })?.toLowerCase()).toBe(
      `ledger-core: ${failing?.story.word.toLowerCase()}. ledger-core: ${merged?.story.word.toLowerCase()}.`,
    );
  });

  it('names at most three projects and counts the rest', () => {
    const branches = branchesOf({
      rows: ['payments-api', 'ledger-core', 'notify-relay', 'Northwind', 'Acme'].map(
        (projectName, index) => ({ key: `k${index}`, projectName, checks: 'success' as const }),
      ),
    });
    const status = overviewStatusOf({ branches }) ?? '';
    expect(status.endsWith('2 more projects.')).toBe(true);
    expect(status.includes('Northwind')).toBe(false);
  });
});
