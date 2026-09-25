import { describe, expect, it } from 'vitest';
import type { SessionExternalTask } from '@goodboy/types';
import { summaryMeta } from './summaryMeta';

const task = { provider: 'linear', identifier: 'NW-142' } as SessionExternalTask;
const other = { provider: 'jira', identifier: 'CAS-88' } as SessionExternalTask;

describe('summaryMeta', () => {
  it('ranks what waits on you above the linked task and the agents, two at most', () => {
    const meta = summaryMeta({
      actionable: { kind: 'questions', count: 1 },
      tasks: [task],
      agentCount: 4,
    });

    expect(meta.map((item) => item.kind)).toEqual(['actionable', 'task']);
  });

  it('shows the linked task and the agents when nothing waits on you', () => {
    const meta = summaryMeta({ actionable: null, tasks: [task, other], agentCount: 2 });

    expect(meta).toEqual([
      { kind: 'task', task, more: 1 },
      { kind: 'agents', count: 2 },
    ]);
  });

  it('shows nothing for a quiet session', () => {
    expect(summaryMeta({ actionable: null, tasks: [], agentCount: 0 })).toEqual([]);
  });
});
