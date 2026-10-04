import { describe, expect, it } from 'vitest';
import type { IsoDateTime, SessionExternalTask, SessionId } from '@goodboy/types';
import { partOfReferences } from './partOfReferences';

const task = (overrides: Partial<SessionExternalTask>): SessionExternalTask => ({
  sessionId: 'session-ledger-export' as SessionId,
  provider: 'linear',
  externalId: 'lin-412',
  identifier: 'HBL-412',
  title: 'Duplicate credit on webhook redelivery',
  url: 'https://linear.app/harborline/issue/HBL-412',
  createdAt: '2026-10-02T09:00:00.000Z' as IsoDateTime,
  ...overrides,
});

describe('partOfReferences', () => {
  it('skips a task that sits on another branch', () => {
    const lines = partOfReferences({
      tasks: [
        task({ scope: 'branch', branch: 'hl/notify-retry' }),
        task({
          externalId: 'lin-413',
          identifier: 'HBL-413',
          scope: 'branch',
          branch: 'hl/ledger',
        }),
      ],
      branch: 'hl/ledger',
      body: '',
    });
    expect(lines).toEqual(['Part of HBL-413']);
  });

  it('keeps a task that is not on a branch yet', () => {
    const lines = partOfReferences({
      tasks: [task({ scope: 'session' })],
      branch: 'hl/ledger',
      body: '',
    });
    expect(lines).toEqual(['Part of HBL-412']);
  });

  it('does not repeat a task the body already names', () => {
    const lines = partOfReferences({
      tasks: [task({ scope: 'session' })],
      branch: 'hl/ledger',
      body: 'Follow-up to HBL-412',
    });
    expect(lines).toEqual([]);
  });
});
