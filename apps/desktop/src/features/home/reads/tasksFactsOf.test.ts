// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { tasksFactsOf } from './tasksFactsOf';

describe('tasksFactsOf', () => {
  it('counts the new tasks and splits them by the source in the key', () => {
    const facts = tasksFactsOf({
      newKeys: ['github:issue:12', 'github:pr:4', 'linear:issue:HBL-9'],
      connected: ['github', 'linear', 'jira'],
    });

    expect(facts.newCount).toBe(3);
    expect(facts.sources).toEqual([
      { provider: 'github', newCount: 2 },
      { provider: 'linear', newCount: 1 },
      { provider: 'jira', newCount: 0 },
    ]);
  });

  it('is zero with nothing new and no source', () => {
    expect(tasksFactsOf({ newKeys: [], connected: [] })).toEqual({ newCount: 0, sources: [] });
  });
});
