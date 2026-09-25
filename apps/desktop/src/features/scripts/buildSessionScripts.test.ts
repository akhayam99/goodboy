import { describe, expect, it } from 'vitest';
import type {
  IsoDateTime,
  MountId,
  Project,
  ProjectId,
  ProjectScript,
  ProjectScriptId,
  SessionId,
  SessionProjectMount,
} from '@goodboy/types';
import { buildSessionScripts } from './buildSessionScripts';
import type { ScriptGroup } from './scripts';

const LEDGER = 'project-ledger' as ProjectId;
const CREATED_AT = '2026-09-01T00:00:00.000Z' as IsoDateTime;
const RELAY = 'project-relay' as ProjectId;

const mount = (
  mountId: string,
  projectId: ProjectId,
  worktreePath: string,
  branch = 'main',
): SessionProjectMount => ({
  mountId: mountId as MountId,
  sessionId: 'session-1' as SessionId,
  projectId,
  mountName: mountId,
  worktreePath,
  lastWorktreePath: null,
  repoRoot: '/repos/ledger-core',
  branch,
  baseBranch: null,
  parallelIndex: 0,
  isAttached: true,
  diskState: 'present',
  revision: 1,
});

const PROJECTS = [
  { id: LEDGER, name: 'ledger-core' },
  { id: RELAY, name: 'notify-relay' },
] as unknown as ReadonlyArray<Project>;

const saved = (id: string, projectId: ProjectId, sortOrder: number): ProjectScript => ({
  id: id as ProjectScriptId,
  projectId,
  name: `Replay ${id}`,
  body: `node ./tools/${id}.js\necho done`,
  sortOrder,
  createdAt: CREATED_AT,
  updatedAt: CREATED_AT,
});

const MANIFEST: ReadonlyArray<ScriptGroup> = [
  {
    source: 'composer',
    packageName: 'acme/ledger',
    relDir: '',
    manager: 'composer',
    scripts: [{ name: 'test', command: 'composer run-script test' }],
  },
  {
    source: 'package-json',
    packageName: 'ledger-core',
    relDir: '',
    manager: 'pnpm',
    scripts: [
      { name: 'lint', command: 'pnpm run lint' },
      { name: 'test', command: 'pnpm run test' },
      { name: 'dev', command: 'pnpm run dev' },
    ],
  },
];

describe('buildSessionScripts', () => {
  it('lists saved scripts first, then manifest scripts by category', () => {
    const [group] = buildSessionScripts({
      mounts: [mount('m1', LEDGER, '/wt/ledger')],
      projects: PROJECTS,
      saved: [saved('b', LEDGER, 2), saved('a', LEDGER, 1), saved('c', RELAY, 0)],
      discovered: { '/wt/ledger': MANIFEST },
    });

    expect(group?.projectName).toBe('ledger-core');
    expect(group?.scripts.map((script) => [script.source, script.name])).toEqual([
      ['saved', 'Replay a'],
      ['saved', 'Replay b'],
      ['package-json', 'dev'],
      ['package-json', 'test'],
      ['composer', 'test'],
      ['package-json', 'lint'],
    ]);
    expect(group?.scripts[0]).toMatchObject({
      kind: 'saved',
      command: 'node ./tools/a.js',
      savedId: 'a',
    });
  });

  it('gives each mount of the same project its own group with the saved scripts in both', () => {
    const groups = buildSessionScripts({
      mounts: [
        mount('m1', LEDGER, '/wt/ledger-a', 'nw/fix-rounding'),
        mount('m2', LEDGER, '/wt/ledger-b', 'nw/settlement'),
      ],
      projects: PROJECTS,
      saved: [saved('a', LEDGER, 0)],
      discovered: { '/wt/ledger-a': MANIFEST },
    });

    expect(groups.map((group) => [group.branch, group.scripts.length])).toEqual([
      ['nw/fix-rounding', 5],
      ['nw/settlement', 1],
    ]);
    expect(groups[0]?.scripts[1]?.key).not.toBe(
      buildSessionScripts({
        mounts: [mount('m2', LEDGER, '/wt/ledger-b')],
        projects: PROJECTS,
        saved: [],
        discovered: { '/wt/ledger-b': MANIFEST },
      })[0]?.scripts[0]?.key,
    );
  });

  it('leaves out projects that are not mounted and marks a mount without a worktree', () => {
    const groups = buildSessionScripts({
      mounts: [mount('m1', LEDGER, '')],
      projects: PROJECTS,
      saved: [saved('c', RELAY, 0)],
      discovered: undefined,
    });

    expect(groups).toEqual([
      expect.objectContaining({ projectId: LEDGER, isReady: false, scripts: [] }),
    ]);
  });
});
