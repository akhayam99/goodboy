// @vitest-environment node
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
import { scriptPinId } from './scriptPinId';
import { discoveredScriptCwd, type ScriptGroup } from './scripts';

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
    scripts: [{ name: 'test', command: 'composer run-script test', body: 'phpunit' }],
  },
  {
    source: 'package-json',
    packageName: 'ledger-core',
    relDir: '',
    manager: 'pnpm',
    scripts: [
      { name: 'lint', command: 'pnpm run lint', body: 'eslint .' },
      { name: 'test', command: 'pnpm run test', body: 'vitest run' },
      { name: 'dev', command: 'pnpm run dev', body: 'vite' },
    ],
  },
];

const NORTHWIND: ReadonlyArray<ScriptGroup> = [
  {
    source: 'package-json',
    packageName: 'northwind',
    relDir: '',
    manager: 'yarn',
    scripts: [{ name: 'dev', command: 'yarn run dev', body: 'turbo run dev' }],
  },
  {
    source: 'package-json',
    packageName: '@northwind/web',
    relDir: 'apps/web',
    manager: 'yarn',
    scripts: [
      { name: 'test', command: 'yarn run test', body: 'vitest run' },
      { name: 'dev', command: 'yarn run dev', body: 'vite --port 3000' },
    ],
  },
  {
    source: 'package-json',
    packageName: '@acme/api',
    relDir: 'apps/api',
    manager: 'yarn',
    scripts: [{ name: 'dev', command: 'yarn run dev', body: 'tsx watch src/server.ts' }],
  },
];

const pinAll = (projectId: ProjectId, groups: ReadonlyArray<ScriptGroup>) => ({
  [projectId]: groups.flatMap((group) =>
    group.scripts.map((script) =>
      scriptPinId({ source: group.source, relDir: group.relDir, name: script.name, savedId: null }),
    ),
  ),
});

describe('buildSessionScripts', () => {
  it('lists saved scripts first, then each manifest by category', () => {
    const [group] = buildSessionScripts({
      mounts: [mount('m1', LEDGER, '/wt/ledger')],
      projects: PROJECTS,
      saved: [saved('b', LEDGER, 2), saved('a', LEDGER, 1), saved('c', RELAY, 0)],
      discovered: { '/wt/ledger': MANIFEST },
      pins: pinAll(LEDGER, MANIFEST),
    });

    expect(group?.projectName).toBe('ledger-core');
    expect(group?.packageCount).toBe(2);
    expect(group?.scripts.map((script) => [script.source, script.name])).toEqual([
      ['saved', 'Replay a'],
      ['saved', 'Replay b'],
      ['package-json', 'dev'],
      ['package-json', 'test'],
      ['package-json', 'lint'],
      ['composer', 'test'],
    ]);
    expect(group?.scripts[0]).toMatchObject({
      kind: 'saved',
      body: 'node ./tools/a.js',
      invocation: 'node ./tools/a.js',
      savedId: 'a',
    });
  });

  it('keeps a script name shared by two workspace packages apart, root package first', () => {
    const [group] = buildSessionScripts({
      mounts: [mount('m1', LEDGER, '/wt/northwind/')],
      projects: PROJECTS,
      saved: [],
      discovered: { '/wt/northwind/': NORTHWIND },
      pins: pinAll(LEDGER, NORTHWIND),
    });

    const scripts = group?.scripts ?? [];
    expect(group?.packageCount).toBe(3);
    expect(
      scripts.map((script) => [
        script.packageName,
        script.name,
        discoveredScriptCwd({ worktreePath: '/wt/northwind/', relDir: script.relDir }),
      ]),
    ).toEqual([
      ['northwind', 'dev', '/wt/northwind/'],
      ['@acme/api', 'dev', '/wt/northwind/apps/api'],
      ['@northwind/web', 'dev', '/wt/northwind/apps/web'],
      ['@northwind/web', 'test', '/wt/northwind/apps/web'],
    ]);
    expect(new Set(scripts.map((script) => script.key)).size).toBe(4);
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
      pins: pinAll(LEDGER, MANIFEST),
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
        pins: pinAll(LEDGER, MANIFEST),
      })[0]?.scripts[0]?.key,
    );
  });

  it('leaves out projects that are not mounted and marks a mount without a worktree', () => {
    const groups = buildSessionScripts({
      mounts: [mount('m1', LEDGER, '')],
      projects: PROJECTS,
      saved: [saved('c', RELAY, 0)],
      discovered: undefined,
      pins: {},
    });

    expect(groups).toEqual([
      expect.objectContaining({ projectId: LEDGER, isReady: false, scripts: [] }),
    ]);
  });

  it('lists only the pinned manifest scripts, keeping every saved script', () => {
    const pinned = scriptPinId({
      source: 'package-json',
      relDir: '',
      name: 'dev',
      savedId: null,
    });
    const alsoPinned = scriptPinId({
      source: 'package-json',
      relDir: '',
      name: 'lint',
      savedId: null,
    });
    const [group] = buildSessionScripts({
      mounts: [mount('m1', LEDGER, '/wt/ledger')],
      projects: PROJECTS,
      saved: [saved('a', LEDGER, 0)],
      discovered: { '/wt/ledger': MANIFEST },
      pins: { [LEDGER]: [pinned, alsoPinned] },
    });

    expect(group?.scripts.map((script) => script.name)).toEqual(['Replay a', 'dev', 'lint']);
    expect(group?.packageCount).toBe(1);
  });

  it('lists no manifest script when nothing is pinned', () => {
    const [group] = buildSessionScripts({
      mounts: [mount('m1', LEDGER, '/wt/ledger')],
      projects: PROJECTS,
      saved: [],
      discovered: { '/wt/ledger': MANIFEST },
      pins: {},
    });

    expect(group?.scripts).toEqual([]);
    expect(group?.packageCount).toBe(0);
  });

  it('ignores pins of another project', () => {
    const relayPin = scriptPinId({
      source: 'package-json',
      relDir: '',
      name: 'dev',
      savedId: null,
    });
    const [group] = buildSessionScripts({
      mounts: [mount('m1', LEDGER, '/wt/ledger')],
      projects: PROJECTS,
      saved: [],
      discovered: { '/wt/ledger': MANIFEST },
      pins: { [RELAY]: [relayPin] },
    });

    expect(group?.scripts).toEqual([]);
  });
});
