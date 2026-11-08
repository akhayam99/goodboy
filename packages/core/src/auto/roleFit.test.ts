import { describe, expect, it } from 'vitest';
import { roleFitOf, roleNarrowerMessage } from './roleFit';
import { AUTO_COMMAND_ROLES } from './roleTools';
import { AUTO_CLOSED_ROLES, type AutoDelegationRole } from './roles';

type FitCase = Readonly<{
  title: string | null;
  task: string;
  role: AutoDelegationRole | null;
}>;

const CASES: ReadonlyArray<FitCase> = [
  {
    title: 'Regroup the branch history',
    task: 'Regroup the 12 commits of ak/feat-retry in ledger-core into four clusters.',
    role: 'implementer',
  },
  {
    title: 'Fix the red lint check',
    task: 'The lint check of notify-relay is red since the last push. Make it pass.',
    role: 'ci-fixer',
  },
  {
    title: null,
    task: 'Find why the CI pipeline fails on payments-api and fix it in the branch.',
    role: 'ci-fixer',
  },
  {
    title: 'Write the pull request body',
    task: 'Write the title and body of the pull request of ak/feat-retry in payments-api.',
    role: 'scribe',
  },
  {
    title: 'Open a draft PR for notify-relay',
    task: 'Open the pull request of the branch as a draft.',
    role: 'scribe',
  },
  {
    title: 'Add tests for the retry cap',
    task: 'Add tests for the retry cap in payments-api: zero, one and the cap itself.',
    role: 'tester',
  },
  {
    title: null,
    task: 'The webhook dedupe of notify-relay has no regression test. Write one that restarts the worker.',
    role: 'tester',
  },
  {
    title: 'Update the README of ledger-core',
    task: 'Describe the new export flags in the README.',
    role: 'docs',
  },
  {
    title: 'Write the changelog entry',
    task: 'Write the changelog entry of Cascadia 0.31.15 from the merged pull requests.',
    role: 'docs',
  },
  {
    title: 'Fix the checkout total rounding',
    task: 'Fix the rounding bug in the checkout total of payments-api.',
    role: null,
  },
  {
    title: 'Add a retry limit to notify-relay',
    task: 'Add a retry limit to notify-relay. Update docs/auto.md and add tests for it.',
    role: null,
  },
  {
    title: 'Implement the Acme backoff',
    task: 'Implement the backoff in ledger-core. Do not open a PR and never squash commits.',
    role: null,
  },
];

describe('roleFitOf', () => {
  it('lands twelve mock tasks on their role', () => {
    expect(CASES).toHaveLength(12);
    for (const entry of CASES) {
      expect({
        task: entry.task,
        role: roleFitOf({ title: entry.title, task: entry.task }),
      }).toEqual({ task: entry.task, role: entry.role });
    }
  });

  it.each([
    'Address the review comments on the open PR of Harborline.',
    'Add a squash option to the merge menu of Northwind.',
    'Split the history view component of Acme in two.',
    'Reword the error message of the payments-api retry.',
    "Don't touch the README, change the parser of ledger-core.",
  ])('leaves a code task to the implementer: %s', (task) => {
    expect(roleFitOf({ title: null, task })).toBeNull();
  });

  it('never returns a role Auto cannot start', () => {
    for (const entry of CASES) {
      const role = roleFitOf({ title: entry.title, task: entry.task });
      for (const closed of AUTO_CLOSED_ROLES) {
        expect(role).not.toBe(closed);
      }
    }
  });
});

describe('roleNarrowerMessage', () => {
  it('names the narrower role and the roleReason way out', () => {
    expect(roleNarrowerMessage({ fit: 'tester', chosen: 'implementer' })).toBe(
      'This task asks for tests: a tester fits. Send it to a tester ("role":"tester"), or keep the implementer with "roleReason": one line on why the implementer fits better. Nothing was started',
    );
  });

  it('only ever names a role Auto can start', () => {
    for (const entry of CASES) {
      const fit = roleFitOf({ title: entry.title, task: entry.task });
      if (fit === null || fit === 'implementer') {
        continue;
      }
      expect(AUTO_COMMAND_ROLES).toContain(fit);
    }
  });
});
