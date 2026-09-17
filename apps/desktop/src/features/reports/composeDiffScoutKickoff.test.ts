import { describe, expect, it } from 'vitest';
import { composeDiffScoutKickoff, DIFF_SCOUT_LIMITS } from './composeDiffScoutKickoff';

const SCOUT = {
  name: 'diff context',
  scope: 'for every path the diff touches: the enclosing function as it reads now',
};

describe('composeDiffScoutKickoff', () => {
  it('pins the root, the scope and the two bounds that matter', () => {
    const kickoff = composeDiffScoutKickoff({
      scout: SCOUT,
      others: [],
      root: 'apps/web',
      goal: 'explain the local change',
      brief: null,
      paths: ['apps/web/src/Batches.tsx'],
    });
    expect(kickoff).toContain('**Root** apps/web');
    expect(kickoff).toContain(`**Scope** ${SCOUT.scope}`);
    expect(kickoff).toContain('**Not yours** nothing, you are the only scout on this report.');
    expect(kickoff).toContain('ends with a repo-relative path');
    expect(kickoff).toContain('**Bound** one turn');
  });

  it('names the paths the diff touched and what is not its ground', () => {
    const kickoff = composeDiffScoutKickoff({
      scout: SCOUT,
      others: [{ name: 'diff context in api', scope: 'the api side' }],
      root: '.',
      goal: 'explain the local change',
      brief: 'focus on the ledger',
      paths: ['apps/web/src/Batches.tsx', 'apps/web/src/Ledger.ts'],
    });
    expect(kickoff).toContain('apps/web/src/Batches.tsx, apps/web/src/Ledger.ts');
    expect(kickoff).toContain('diff context in api is reading the api side');
    expect(kickoff).toContain('**Brief** focus on the ledger');
  });

  it('bounds the path list and says how many it left out', () => {
    const paths = Array.from({ length: DIFF_SCOUT_LIMITS.paths + 4 }, (_, i) => `src/f${i}.ts`);
    const kickoff = composeDiffScoutKickoff({
      scout: SCOUT,
      others: [],
      root: '.',
      goal: 'explain the local change',
      brief: null,
      paths,
    });
    expect(kickoff).toContain(`these ${paths.length} paths`);
    expect(kickoff).toContain('4 more paths changed and are not listed here');
    expect(kickoff).not.toContain(`src/f${DIFF_SCOUT_LIMITS.paths}.ts`);
  });

  it('redacts a secret carried in the goal', () => {
    const kickoff = composeDiffScoutKickoff({
      scout: SCOUT,
      others: [],
      root: '.',
      goal: 'ship it with api_key=harborline-test-value',
      brief: null,
      paths: [],
    });
    expect(kickoff).not.toContain('harborline-test-value');
    expect(kickoff).toContain('**Changed paths** the diff named no path');
  });
});
