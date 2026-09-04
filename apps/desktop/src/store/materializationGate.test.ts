import { describe, expect, it } from 'vitest';
import type { Project, ProjectId, SessionId } from '@goodboy/types';
import { materializationGate } from './materializationGate';
import type { GetFn } from './slice-types';

const SESSION_ID = 'session-1' as SessionId;

const project = (id: string, name: string): Project =>
  ({ id: id as ProjectId, name, workspaceId: 'ws-1' }) as Project;

type HarnessParams = {
  readonly mounts: ReadonlyArray<string>;
  readonly goal?: string;
};

const harness = ({ mounts, goal = 'ship' }: HarnessParams): GetFn =>
  (() => ({
    sessions: [{ id: SESSION_ID, goal }],
    sessionProjectMounts: { [SESSION_ID]: mounts.map((projectId) => ({ projectId })) },
    sessionSlots: {},
    sessionExternalTasks: {},
  })) as unknown as GetFn;

describe('materializationGate', () => {
  it('reports a mounted project', () => {
    const get = harness({ mounts: ['p-api'] });
    expect(
      materializationGate({
        get,
        sessionId: SESSION_ID,
        project: project('p-api', 'api'),
        immediateCount: 0,
      }),
    ).toBe('mounted');
  });

  it('allows the first mounts of a request that started with none, up to the cap', () => {
    const empty = harness({ mounts: [] });
    expect(
      materializationGate({
        get: empty,
        sessionId: SESSION_ID,
        project: project('p-api', 'api'),
        immediateCount: 0,
      }),
    ).toBe('allowed');
    const afterOne = harness({ mounts: ['p-api'] });
    expect(
      materializationGate({
        get: afterOne,
        sessionId: SESSION_ID,
        project: project('p-web', 'web'),
        immediateCount: 1,
      }),
    ).toBe('allowed');
    const afterTwo = harness({ mounts: ['p-api', 'p-web'] });
    expect(
      materializationGate({
        get: afterTwo,
        sessionId: SESSION_ID,
        project: project('p-docs', 'docs'),
        immediateCount: 2,
      }),
    ).toBe('deferred');
  });

  it('defers a project the goal does not name once a mount predates the request', () => {
    const get = harness({ mounts: ['p-api'] });
    expect(
      materializationGate({
        get,
        sessionId: SESSION_ID,
        project: project('p-web', 'web'),
        immediateCount: 0,
      }),
    ).toBe('deferred');
  });

  it('allows a project the goal names next to an existing mount', () => {
    const get = harness({ mounts: ['p-api'], goal: 'wire the web form' });
    expect(
      materializationGate({
        get,
        sessionId: SESSION_ID,
        project: project('p-web', 'web'),
        immediateCount: 0,
      }),
    ).toBe('allowed');
  });
});
