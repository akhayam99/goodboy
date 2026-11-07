// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { alsoOnLabelOf } from './alsoOnLabelOf';
import { branchListLabelOf, type AlsoOnBranch } from './branchListLabelOf';

type Params = {
  readonly name: string;
};

const branchOf = ({ name }: Params): AlsoOnBranch => ({
  branch: name,
  projectName: 'notify-relay',
});

describe('alsoOnLabelOf', () => {
  it('names the branch when the run is on one more', () => {
    expect(alsoOnLabelOf({ branches: [branchOf({ name: 'feat/retry-budget' })] })).toBe(
      'Also on feat/retry-budget',
    );
  });

  it('counts the branches when the run is on two or more', () => {
    expect(
      alsoOnLabelOf({ branches: [branchOf({ name: 'feat/a' }), branchOf({ name: 'feat/b' })] }),
    ).toBe('Also on 2 branches');
  });
});

describe('branchListLabelOf', () => {
  it('lists the project and the branch of each', () => {
    expect(
      branchListLabelOf({ branches: [branchOf({ name: 'feat/a' }), branchOf({ name: 'feat/b' })] }),
    ).toBe('notify-relay · feat/a, notify-relay · feat/b');
  });
});
