import { describe, expect, it } from 'vitest';
import type { IsoDateTime, ProjectId, SessionExternalTask, SessionId } from '@goodboy/types';
import { distinctTasks } from './distinctTasks';

const task = (overrides: Partial<SessionExternalTask>): SessionExternalTask => ({
  sessionId: 'session-ledger-export' as SessionId,
  provider: 'linear',
  externalId: 'lin-412',
  identifier: 'HBL-412',
  title: 'Duplicate credit on webhook redelivery',
  url: 'https://linear.app/harborline/issue/HBL-412',
  createdAt: '2026-10-02T09:00:00.000Z' as IsoDateTime,
  scope: 'session',
  ...overrides,
});

describe('distinctTasks', () => {
  it('keeps one entry for a task linked to the session and to a branch', () => {
    const result = distinctTasks({
      tasks: [task({ scope: 'branch', branch: 'hl/ledger-export' }), task({ scope: 'session' })],
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.task.scope).toBe('session');
    expect(result[0]?.branches).toEqual(['hl/ledger-export']);
  });

  it('collects every branch a task sits on', () => {
    const result = distinctTasks({
      tasks: [
        task({ scope: 'branch', branch: 'hl/ledger-export' }),
        task({ scope: 'branch', branch: 'hl/notify-retry' }),
      ],
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.branches).toEqual(['hl/ledger-export', 'hl/notify-retry']);
  });

  it('keeps the same issue number in two projects apart, each with its own branches', () => {
    const result = distinctTasks({
      tasks: [
        task({
          provider: 'github',
          externalId: '42',
          projectId: 'project-payments-api' as ProjectId,
          scope: 'branch',
          branch: 'pay/fix-refund',
        }),
        task({
          provider: 'github',
          externalId: '42',
          projectId: 'project-storefront-web' as ProjectId,
          scope: 'branch',
          branch: 'sf/fix-cart',
        }),
      ],
    });
    expect(result).toHaveLength(2);
    expect(result.map((entry) => entry.branches)).toEqual([['pay/fix-refund'], ['sf/fix-cart']]);
  });

  it('keeps different tasks apart', () => {
    const result = distinctTasks({
      tasks: [task({}), task({ externalId: 'lin-413', identifier: 'HBL-413' })],
    });
    expect(result).toHaveLength(2);
  });
});
