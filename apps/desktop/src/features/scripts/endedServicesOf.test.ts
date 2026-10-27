// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { MountId, ProjectId, SessionId } from '@goodboy/types';
import { brandedId } from '../history/testing/brandedId';
import type { RunnableScript, SessionScriptGroup } from './buildSessionScripts';
import { endedServicesOf } from './endedServicesOf';

const SESSION = brandedId<SessionId>({ value: 'session-1' });
const OTHER_SESSION = brandedId<SessionId>({ value: 'session-2' });

type ScriptParams = {
  readonly key: string;
  readonly name: string;
  readonly category: RunnableScript['category'];
};

const scriptOf = ({ key, name, category }: ScriptParams): RunnableScript => ({
  key,
  kind: 'manifest',
  name,
  body: name,
  invocation: `pnpm run ${name}`,
  manager: 'pnpm',
  source: 'package-json',
  packageName: 'payments-api',
  relDir: '',
  category,
  savedId: null,
});

const API = scriptOf({ key: 'key-api', name: 'dev', category: 'dev' });
const WORKER = scriptOf({ key: 'key-worker', name: 'start', category: 'other' });
const TEST = scriptOf({ key: 'key-test', name: 'test', category: 'test' });

const groupOf = ({ path, isReady = true }: { readonly path: string; readonly isReady?: boolean }) =>
  ({
    mountId: brandedId<MountId>({ value: `mount-${path}` }),
    projectId: brandedId<ProjectId>({ value: 'project-1' }),
    projectName: 'payments-api',
    branch: 'nw/retry',
    worktreePath: path,
    isReady,
    packageCount: 1,
    scripts: [API, WORKER, TEST],
    suggested: [],
  }) satisfies SessionScriptGroup;

type EntryParams = {
  readonly scriptId: string;
  readonly cwd: string;
  readonly sessionId?: SessionId;
};

const entryOf = ({ scriptId, cwd, sessionId = SESSION }: EntryParams) => ({
  scriptId,
  sessionId,
  name: scriptId,
  cwd,
});

const endedOf = (scripts: ReadonlyArray<ReturnType<typeof entryOf>>) => ({
  at: 1,
  terminals: {},
  scripts,
});

describe('endedServicesOf', () => {
  it('finds the services that were running, in the mount they ran in, and leaves tasks out', () => {
    const found = endedServicesOf({
      ended: endedOf([
        entryOf({ scriptId: 'key-api', cwd: '/work/payments-api' }),
        entryOf({ scriptId: 'key-worker', cwd: '/work/payments-api/packages/queue' }),
        entryOf({ scriptId: 'key-test', cwd: '/work/payments-api' }),
      ]),
      sessionId: SESSION,
      groups: [groupOf({ path: '/work/payments-api' })],
    });

    expect(found.map(({ script }) => script.key)).toEqual(['key-api', 'key-worker']);
  });

  it('keeps a service in the worktree whose path it ran under, not one with the same prefix', () => {
    const found = endedServicesOf({
      ended: endedOf([entryOf({ scriptId: 'key-api', cwd: '/work/payments-api-old' })]),
      sessionId: SESSION,
      groups: [groupOf({ path: '/work/payments-api' })],
    });

    expect(found).toEqual([]);
  });

  it('ignores another session, a missing script and a folder that is still preparing', () => {
    const groups = [groupOf({ path: '/work/payments-api' })];
    expect(
      endedServicesOf({
        ended: endedOf([
          entryOf({
            scriptId: 'key-api',
            cwd: '/work/payments-api',
            sessionId: OTHER_SESSION,
          }),
        ]),
        sessionId: SESSION,
        groups,
      }),
    ).toEqual([]);
    expect(
      endedServicesOf({
        ended: endedOf([entryOf({ scriptId: 'key-gone', cwd: '/work/payments-api' })]),
        sessionId: SESSION,
        groups,
      }),
    ).toEqual([]);
    expect(
      endedServicesOf({
        ended: endedOf([entryOf({ scriptId: 'key-api', cwd: '/work/payments-api' })]),
        sessionId: SESSION,
        groups: [groupOf({ path: '/work/payments-api', isReady: false })],
      }),
    ).toEqual([]);
  });

  it('is empty without a record', () => {
    expect(endedServicesOf({ ended: null, sessionId: SESSION, groups: [] })).toEqual([]);
  });
});
