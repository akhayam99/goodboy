import { describe, expect, it, vi } from 'vitest';
import type { MountId, ProjectId } from '@goodboy/types';
import type { RunnableScript, SessionScriptGroup } from '../scripts/buildSessionScripts';
import { buildScriptActions } from './registry';

const script = ({
  name,
  packageName,
  relDir,
  source = 'package-json',
}: {
  readonly name: string;
  readonly packageName: string;
  readonly relDir: string;
  readonly source?: RunnableScript['source'];
}): RunnableScript => ({
  key: `${source}:${relDir}:${name}`,
  kind: source === 'saved' ? 'saved' : 'manifest',
  name,
  body: 'vite --host --port 3000',
  invocation: 'yarn run dev',
  manager: 'yarn',
  source,
  packageName,
  relDir,
  category: 'dev',
  savedId: null,
});

const group = (scripts: ReadonlyArray<RunnableScript>): SessionScriptGroup => ({
  mountId: 'mount-northwind' as MountId,
  projectId: 'northwind' as ProjectId,
  projectName: 'northwind-storefront',
  branch: 'nw/fix-settlement-replay',
  worktreePath: '/work/northwind-storefront',
  isReady: true,
  packageCount: 2,
  scripts,
});

describe('buildScriptActions', () => {
  it('names the root package and shows its body', () => {
    const [action] = buildScriptActions({
      groups: [group([script({ name: 'dev', packageName: 'northwind-storefront', relDir: '' })])],
      runningKeys: new Set(),
      onPick: vi.fn(),
    });

    expect(action?.sublabel).toBe('root · vite --host --port 3000');
    expect(action?.trailing).toEqual({ label: 'root' });
  });

  it('names a workspace package in full, and trails with its short name', () => {
    const target = script({ name: 'dev', packageName: '@northwind/web', relDir: 'apps/web' });
    const [action] = buildScriptActions({
      groups: [group([target])],
      runningKeys: new Set(),
      onPick: vi.fn(),
    });

    expect(action?.sublabel).toBe('@northwind/web · vite --host --port 3000');
    expect(action?.trailing).toEqual({ label: 'web' });
  });

  it('trails a running script with Running instead of its package', () => {
    const target = script({ name: 'dev', packageName: '@northwind/web', relDir: 'apps/web' });
    const [action] = buildScriptActions({
      groups: [group([target])],
      runningKeys: new Set([target.key]),
      onPick: vi.fn(),
    });

    expect(action?.trailing).toEqual({ label: 'Running' });
  });

  it('descends a saved script as Saved rather than a package', () => {
    const target = script({ name: 'Seed sandbox', packageName: '', relDir: '', source: 'saved' });
    const [action] = buildScriptActions({
      groups: [group([target])],
      runningKeys: new Set(),
      onPick: vi.fn(),
    });

    expect(action?.sublabel).toBe('Saved · vite --host --port 3000');
    expect(action?.trailing).toEqual({ label: 'Saved' });
  });
});
