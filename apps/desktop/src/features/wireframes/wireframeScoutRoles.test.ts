import { describe, expect, it } from 'vitest';
import { composeWireframeScoutKickoff, WIREFRAME_SCOUTS } from './wireframeScoutRoles';

const [screens, data] = WIREFRAME_SCOUTS;

describe('WIREFRAME_SCOUTS', () => {
  it('is two scouts and only two', () => {
    expect(WIREFRAME_SCOUTS.map((scout) => scout.id)).toEqual(['screens', 'data']);
  });

  it('answers prior art inside the screens scope, never as its own traversal', () => {
    expect(screens!.scope).toContain('near neighbour');
    expect(screens!.scope).toContain('never walk the repository a second time');
  });
});

describe('composeWireframeScoutKickoff', () => {
  const kickoff = composeWireframeScoutKickoff({
    scout: screens!,
    others: [data!],
    root: 'apps/web',
    goal: 'draw the batch review flow',
    brief: 'start at the batch list',
  });

  it('pins the root', () => {
    expect(kickoff).toContain('**Root** apps/web');
  });

  it('states the other scout scope so neither re-reads the same ground', () => {
    expect(kickoff).toContain('**Not yours**');
    expect(kickoff).toContain('data and contracts is reading');
    expect(kickoff).toContain('do not read that ground');
  });

  it('demands a path on every claim', () => {
    expect(kickoff).toContain('ends with a repo-relative path');
    expect(kickoff).toContain('dropped without discussion');
  });

  it('bounds the scout to one turn and forbids splitting', () => {
    expect(kickoff).toContain('one turn');
    expect(kickoff).toContain('never split into sub agents');
  });

  it('carries the goal and the brief', () => {
    expect(kickoff).toContain('draw the batch review flow');
    expect(kickoff).toContain('start at the batch list');
  });

  it('leaves the brief line out when there is no brief', () => {
    const bare = composeWireframeScoutKickoff({
      scout: data!,
      others: [screens!],
      root: '.',
      goal: 'draw it',
      brief: null,
    });
    expect(bare).not.toContain('**Brief**');
  });

  it('clips a long goal rather than sending it whole', () => {
    const long = composeWireframeScoutKickoff({
      scout: data!,
      others: [screens!],
      root: '.',
      goal: 'g'.repeat(2_000),
      brief: null,
    });
    expect(long).toContain('...');
    expect(long.length).toBeLessThan(2_000);
  });
});
