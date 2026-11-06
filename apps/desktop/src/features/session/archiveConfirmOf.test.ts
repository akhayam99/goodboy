import { describe, expect, it } from 'vitest';
import { archiveConfirmOf } from './archiveConfirmOf';

describe('archiveConfirmOf', () => {
  it('asks nothing when no agent is live, since Undo brings the session back', () => {
    expect(archiveConfirmOf({ sessionCount: 1, runningAgentCount: 0 })).toBeNull();
    expect(archiveConfirmOf({ sessionCount: 3, runningAgentCount: 0 })).toBeNull();
  });

  it('names the one agent it stops on the button', () => {
    const confirm = archiveConfirmOf({ sessionCount: 1, runningAgentCount: 1 });

    expect(confirm?.title).toBe('Stop 1 agent and archive?');
    expect(confirm?.confirmLabel).toBe('Stop 1 agent and archive');
    expect(confirm?.description).toBe(
      'Archive stops it first and keeps what it wrote. Branches, worktrees and history stay on disk, and Restore brings it back.',
    );
    expect(confirm?.role).toBe('alert');
  });

  it('names the count of agents it stops across several sessions', () => {
    const confirm = archiveConfirmOf({ sessionCount: 3, runningAgentCount: 2 });

    expect(confirm?.confirmLabel).toBe('Stop 2 agents and archive');
    expect(confirm?.description).toBe(
      'Archive stops them first and keeps what they wrote. Branches, worktrees and history stay on disk, and Restore brings them back.',
    );
  });

  it('never says an agent keeps running after the archive', () => {
    const copy = [1, 4].flatMap((sessionCount) =>
      [1, 3].map((runningAgentCount) => {
        const confirm = archiveConfirmOf({ sessionCount, runningAgentCount });
        return `${confirm?.title ?? ''} ${confirm?.description ?? ''}`;
      }),
    );

    expect(copy.filter((line) => /keeps? running/i.test(line))).toEqual([]);
  });
});
