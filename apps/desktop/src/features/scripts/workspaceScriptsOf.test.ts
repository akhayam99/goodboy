import { brandId, type ProjectId } from '@goodboy/types';
import { aProject } from '@goodboy/types/testing';
import { describe, expect, it } from 'vitest';
import { scriptPinId } from './scriptPinId';
import type { ScriptGroup } from './scripts';
import { workspaceScriptsOf, type ProjectScan } from './workspaceScriptsOf';

const LEDGER = brandId<ProjectId>({ value: 'project-ledger-core' });
const PAYMENTS = brandId<ProjectId>({ value: 'project-payments-api' });

const PROJECTS = [
  aProject({ id: LEDGER, name: 'ledger-core', rootPath: '/repos/ledger-core' }),
  aProject({ id: PAYMENTS, name: 'payments-api', rootPath: '/repos/payments-api' }),
];

const GROUP: ScriptGroup = {
  source: 'package-json',
  manager: 'pnpm',
  packageName: 'ledger-core',
  relDir: '',
  scripts: [
    { name: 'dev', body: 'vite', command: 'pnpm run dev' },
    { name: 'test', body: 'vitest run', command: 'pnpm run test' },
    { name: 'seed', body: 'node seed.js', command: 'pnpm run seed' },
  ],
};

const READY: ProjectScan = { status: 'ready', groups: [GROUP] };

describe('the scripts of every project of the workspace', () => {
  it('lists one group per project, each in its own state', () => {
    const groups = workspaceScriptsOf({
      projects: PROJECTS,
      scans: {
        '/repos/ledger-core': READY,
        '/repos/payments-api': { status: 'loading', groups: [] },
      },
      saved: [],
      pins: {},
      projectId: null,
    });

    expect(groups.map((group) => [group.projectName, group.status])).toEqual([
      ['ledger-core', 'ready'],
      ['payments-api', 'loading'],
    ]);
  });

  it('suggests the root scripts by what they do when nothing is pinned', () => {
    const [group] = workspaceScriptsOf({
      projects: PROJECTS,
      scans: { '/repos/ledger-core': READY },
      saved: [],
      pins: {},
      projectId: LEDGER,
    });

    expect(group?.scripts.map((script) => script.name)).toEqual(['dev', 'test']);
  });

  it('lists the pinned scripts instead of the suggestions', () => {
    const pinId = scriptPinId({ source: 'package-json', relDir: '', name: 'seed', savedId: null });

    const [group] = workspaceScriptsOf({
      projects: PROJECTS,
      scans: { '/repos/ledger-core': READY },
      saved: [],
      pins: { [LEDGER]: [pinId] },
      projectId: LEDGER,
    });

    expect(group?.scripts.map((script) => [script.name, script.isPinned])).toEqual([
      ['seed', true],
    ]);
  });

  it('narrows to one project when a scope is named', () => {
    const groups = workspaceScriptsOf({
      projects: PROJECTS,
      scans: {},
      saved: [],
      pins: {},
      projectId: PAYMENTS,
    });

    expect(groups.map((group) => group.projectName)).toEqual(['payments-api']);
  });
});
