import { describe, expect, it } from 'vitest';
import { archiveConfirmOf } from './archiveConfirmOf';

describe('archiveConfirmOf', () => {
  it('asks about one session and says it can come back', () => {
    const confirm = archiveConfirmOf({ sessionCount: 1, runningAgentCount: 0 });

    expect(confirm.title).toBe('Archive session?');
    expect(confirm.confirmLabel).toBe('Archive session');
    expect(confirm.description).toBe(
      'Branches, worktrees and history stay on disk, and Restore brings it back.',
    );
    expect(confirm.role).toBe('alert');
  });

  it('says a running agent keeps running after the archive', () => {
    const confirm = archiveConfirmOf({ sessionCount: 1, runningAgentCount: 1 });

    expect(confirm.description).toBe(
      '1 agent is still running in this session and keeps running after you archive it. Branches, worktrees and history stay on disk, and Restore brings it back.',
    );
  });

  it('names the count of sessions and of running agents in one ask', () => {
    const confirm = archiveConfirmOf({ sessionCount: 3, runningAgentCount: 2 });

    expect(confirm.title).toBe('Archive 3 sessions?');
    expect(confirm.confirmLabel).toBe('Archive 3 sessions');
    expect(confirm.description).toBe(
      '2 agents are still running in these sessions and keep running after you archive them. Branches, worktrees and history stay on disk, and Restore brings them back.',
    );
  });

  it('never says archive stops an agent', () => {
    const copy = [1, 4].flatMap((sessionCount) =>
      [0, 1, 3].map((runningAgentCount) => {
        const confirm = archiveConfirmOf({ sessionCount, runningAgentCount });
        return `${confirm.title} ${confirm.description}`;
      }),
    );

    expect(copy.filter((line) => /\b(stop|stops|stopped|end|ends|kill)\b/i.test(line))).toEqual([]);
  });
});
