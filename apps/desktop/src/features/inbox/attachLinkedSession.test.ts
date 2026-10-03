// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { IsoDateTime, SessionExternalTask, SessionId } from '@goodboy/types';
import { attachLinkedSession, indexLinkedSessions } from './attachLinkedSession';
import { recordSessionId } from './recordSessionId';
import type { InboxRecord } from './types';

const SESSION = 'session-1' as SessionId;
const OTHER = 'session-2' as SessionId;

const task = (overrides: Partial<SessionExternalTask>): SessionExternalTask => ({
  sessionId: SESSION,
  provider: 'linear',
  externalId: 'uuid-1',
  identifier: 'ENG-1',
  title: 'linear item',
  url: '',
  createdAt: '2026-09-20T09:00:00.000Z' as IsoDateTime,
  ...overrides,
});

const LINEAR: InboxRecord = {
  key: 'linear:issue:uuid-1',
  provider: 'linear',
  kind: 'issue',
  identifier: 'ENG-1',
  title: 'linear item',
  state: 'open',
  stateLabel: 'Open',
  updatedAt: '2026-09-20T09:00:00.000Z',
  url: '',
  context: 'ENG',
  payload: {
    provider: 'linear',
    kind: 'issue',
    issue: {
      id: 'uuid-1',
      identifier: 'ENG-1',
      title: 'linear item',
      description: null,
      url: '',
      state: { name: 'Todo', type: 'unstarted' },
      team: { key: 'ENG' },
      updatedAt: '',
    },
    sessionId: null,
  },
};

const GITLAB_MR: InboxRecord = {
  key: 'gitlab:mr:7',
  provider: 'gitlab',
  kind: 'mr',
  identifier: '!7',
  title: 'gitlab mr',
  state: 'open',
  stateLabel: 'Open',
  updatedAt: '2026-09-20T09:00:00.000Z',
  url: '',
  context: 'ledger-core',
  payload: {
    provider: 'gitlab',
    kind: 'mr',
    mr: {
      id: 7,
      iid: 7,
      projectId: 1,
      title: 'gitlab mr',
      description: null,
      state: 'opened',
      webUrl: '',
      sourceBranch: 'feat',
      targetBranch: 'main',
      draft: false,
      hasConflicts: false,
      mergeStatus: 'can_be_merged',
      updatedAt: '',
    },
    host: 'gitlab.com',
  },
};

describe('attachLinkedSession', () => {
  it('finds the session linked by the task id', () => {
    const linked = indexLinkedSessions({
      sessionIds: [SESSION],
      sessionExternalTasks: { [SESSION]: [task({})] },
    });

    expect(recordSessionId({ record: attachLinkedSession({ record: LINEAR, linked }) })).toBe(
      SESSION,
    );
  });

  it('finds a task linked from a pasted url by its code', () => {
    const linked = indexLinkedSessions({
      sessionIds: [SESSION],
      sessionExternalTasks: { [SESSION]: [task({ externalId: 'ENG-1', identifier: 'eng-1' })] },
    });

    expect(recordSessionId({ record: attachLinkedSession({ record: LINEAR, linked }) })).toBe(
      SESSION,
    );
  });

  it('links a merge request, which carries no session of its own', () => {
    const linked = indexLinkedSessions({
      sessionIds: [SESSION],
      sessionExternalTasks: {
        [SESSION]: [task({ provider: 'gitlab', externalId: '7', identifier: '!7' })],
      },
    });

    expect(recordSessionId({ record: attachLinkedSession({ record: GITLAB_MR, linked }) })).toBe(
      SESSION,
    );
  });

  it('ignores sessions outside the list and leaves an unlinked record as it is', () => {
    const linked = indexLinkedSessions({
      sessionIds: [SESSION],
      sessionExternalTasks: { [OTHER]: [task({ sessionId: OTHER })] },
    });

    expect(attachLinkedSession({ record: LINEAR, linked })).toBe(LINEAR);
  });

  it('keeps every session that links the task, the first one opening by default', () => {
    const linked = indexLinkedSessions({
      sessionIds: [SESSION, OTHER],
      sessionExternalTasks: {
        [SESSION]: [task({}), task({ scope: 'branch', branch: 'hl/payments-retry' })],
        [OTHER]: [task({ sessionId: OTHER, externalId: 'ENG-1', identifier: 'eng-1' })],
      },
    });

    const record = attachLinkedSession({ record: LINEAR, linked });

    expect(record.linkedSessionIds).toEqual([SESSION, OTHER]);
    expect(recordSessionId({ record })).toBe(SESSION);
  });
});
