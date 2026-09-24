import { DEFAULT_SESSION_PROVIDER_PREFERENCE } from '@goodboy/core';
import { describe, expect, it } from 'vitest';
import type {
  IsoDateTime,
  Session,
  SessionId,
  WorkflowId,
  WorkflowRunId,
  WorkspaceId,
} from '@goodboy/types';
import { isHandsFree } from './handsFree';
import type { GetFn } from './types';

const WS_ID = 'ws-1' as WorkspaceId;
const SESSION_ID = 'ses-1' as SessionId;
const RUN_ID = 'run-1' as WorkflowRunId;
const WF_ID = 'wf-1' as WorkflowId;
const NOW = '2026-09-18T00:00:00.000Z' as IsoDateTime;

const makeSession = ({
  autoRun,
  runAutoRun,
}: {
  readonly autoRun: boolean;
  readonly runAutoRun?: boolean;
}): Session => ({
  id: SESSION_ID,
  workspaceId: WS_ID,
  goal: 'g',
  state: { kind: 'idle', lastActivityAt: NOW },
  contextSlots: [],
  providerPreference: DEFAULT_SESSION_PROVIDER_PREFERENCE,
  permissionMode: 'bypassPermissions',
  workflowRuns:
    runAutoRun == null
      ? []
      : [
          {
            id: RUN_ID,
            workflowId: WF_ID,
            ordinal: 0,
            currentStep: 0,
            autoRun: runAutoRun,
            triggerMode: 'immediate',
            executionMode: 'static',
            createdAt: NOW,
          },
        ],
  autoRun,
  titleUserEdited: false,
  createdAt: NOW,
  updatedAt: NOW,
});

const getWith = (session: Session): GetFn => (() => ({ sessions: [session] })) as unknown as GetFn;

describe('isHandsFree', () => {
  it('frees an agent with no workflow run when the session flag is on', () => {
    const get = getWith(makeSession({ autoRun: true }));
    expect(isHandsFree(get, SESSION_ID, null)).toBe(true);
    expect(isHandsFree(get, SESSION_ID, undefined)).toBe(true);
  });

  it('holds an agent with no workflow run when the session flag is off', () => {
    const get = getWith(makeSession({ autoRun: false }));
    expect(isHandsFree(get, SESSION_ID, null)).toBe(false);
  });

  it('lets the run flag win over the session flag in both directions', () => {
    expect(
      isHandsFree(getWith(makeSession({ autoRun: false, runAutoRun: true })), SESSION_ID, RUN_ID),
    ).toBe(true);
    expect(
      isHandsFree(getWith(makeSession({ autoRun: true, runAutoRun: false })), SESSION_ID, RUN_ID),
    ).toBe(false);
  });

  it('falls back to the session flag when the run id is unknown', () => {
    const get = getWith(makeSession({ autoRun: true, runAutoRun: false }));
    expect(isHandsFree(get, SESSION_ID, 'run-missing' as WorkflowRunId)).toBe(true);
  });

  it('holds when the session is gone', () => {
    const get = getWith(makeSession({ autoRun: true }));
    expect(isHandsFree(get, 'ses-missing' as SessionId, null)).toBe(false);
  });
});
