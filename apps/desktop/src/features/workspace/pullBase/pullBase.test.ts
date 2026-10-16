import { beforeEach, describe, expect, it, vi } from 'vitest';
import { aProject } from '@goodboy/types/testing';

const { update } = vi.hoisted(() => ({ update: vi.fn() }));

vi.mock('../../../shared/lib/repo', () => ({ checkoutUpdateBase: update }));

import { pullBaseInRepos } from './pullBaseInRepos';
import { pullBaseSummary } from './pullBaseSummary';

const LEDGER = aProject({ name: 'ledger-core', rootPath: '/work/ledger-core', baseBranch: 'main' });
const NOTIFY = aProject({
  name: 'notify-relay',
  rootPath: '/work/notify-relay',
  baseBranch: 'main',
});
const PAYMENTS = aProject({
  name: 'payments-api',
  rootPath: '/work/payments-api',
  baseBranch: 'main',
});

beforeEach(() => {
  update.mockReset();
});

describe('pulling the base branch in linked repos', () => {
  it('asks each repo for its own base branch and keeps the order of the repos', async () => {
    update.mockImplementation(async ({ checkoutPath }: { checkoutPath: string }) => ({
      base: 'main',
      checkoutBranch: 'mara/ledger-export',
      commitsPulled: checkoutPath === LEDGER.rootPath ? 3 : 0,
    }));

    const outcomes = await pullBaseInRepos({ projects: [LEDGER, NOTIFY] });

    expect(outcomes.map((outcome) => outcome.name)).toEqual(['ledger-core', 'notify-relay']);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ checkoutPath: LEDGER.rootPath, baseBranch: 'main' }),
    );
  });

  it('counts a refusal as skipped and an unreachable remote as failed', async () => {
    update.mockImplementation(async ({ checkoutPath }: { checkoutPath: string }) => {
      if (checkoutPath === NOTIFY.rootPath) {
        throw new Error('unable to access https://github.com/acme/notify-relay.git');
      }
      if (checkoutPath === PAYMENTS.rootPath) {
        throw new Error('this checkout has uncommitted changes. commit or stash them first');
      }
      return { base: 'main', checkoutBranch: 'main', commitsPulled: 1 };
    });

    const outcomes = await pullBaseInRepos({ projects: [LEDGER, NOTIFY, PAYMENTS] });

    expect(outcomes.map((outcome) => outcome.kind)).toEqual(['updated', 'failed', 'skipped']);
    expect(pullBaseSummary({ outcomes }).title).toBe('Updated 1 repo · 1 skipped · 1 failed');
  });
});

describe('the pull summary', () => {
  it('names the branch each repo updated and where its checkout stays', () => {
    const summary = pullBaseSummary({
      outcomes: [
        {
          kind: 'updated',
          projectId: LEDGER.id,
          name: 'ledger-core',
          base: 'main',
          checkoutBranch: 'mara/ledger-export',
          commits: 3,
        },
        {
          kind: 'updated',
          projectId: NOTIFY.id,
          name: 'notify-relay',
          base: 'main',
          checkoutBranch: 'main',
          commits: 0,
        },
        {
          kind: 'skipped',
          projectId: PAYMENTS.id,
          name: 'payments-api',
          reason: '2 uncommitted files',
        },
      ],
    });

    expect(summary.title).toBe('Updated 2 repos · 1 skipped');
    expect(summary.kind).toBe('info');
    expect(summary.lines).toEqual([
      'ledger-core: main updated, 3 new commits, your checkout stays on mara/ledger-export',
      'notify-relay: main already up to date',
      'payments-api: 2 uncommitted files',
    ]);
  });
});
