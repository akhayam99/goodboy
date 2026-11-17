import { describe, expect, it } from 'vitest';
import type { PrCheckRun } from '@goodboy/types';
import { checksGroupsOf } from '../../integrations/github/checksRollup';
import { heldCheckGroupsOf } from './heldCheckGroupsOf';

type RunParams = {
  readonly name: string;
  readonly conclusion: PrCheckRun['conclusion'];
};

const runOf = ({ name, conclusion }: RunParams): PrCheckRun => ({
  name,
  conclusion,
  detailsUrl: `https://github.com/harborline/payments-api/actions/runs/1/job/${name}`,
  durationMs: null,
});

const TEST = 'payments-api / test';
const BUILD = 'build';
const LINT = 'ledger-core / lint';

describe('heldCheckGroupsOf', () => {
  it('keeps a check in the group it had when the list opened', () => {
    const first = heldCheckGroupsOf({
      held: new Map(),
      checks: [
        runOf({ name: TEST, conclusion: 'failure' }),
        runOf({ name: BUILD, conclusion: 'success' }),
      ],
    });
    const rerun = [
      runOf({ name: TEST, conclusion: 'pending' }),
      runOf({ name: BUILD, conclusion: 'success' }),
    ];
    const held = heldCheckGroupsOf({ held: first, checks: rerun });

    expect(held).toBe(first);
    expect(
      checksGroupsOf({ checks: rerun, held }).map((entry) => [
        entry.group,
        entry.runs.map((check) => check.name),
      ]),
    ).toEqual([
      ['failing', [TEST]],
      ['passed', [BUILD]],
    ]);
  });

  it('places a check it has not seen by its own conclusion', () => {
    const build = runOf({ name: BUILD, conclusion: 'success' });
    const first = heldCheckGroupsOf({ held: new Map(), checks: [build] });
    const held = heldCheckGroupsOf({
      held: first,
      checks: [build, runOf({ name: LINT, conclusion: 'failure' })],
    });

    expect(held.get(LINT)).toBe('failing');
    expect(held.get(BUILD)).toBe('passed');
  });
});
