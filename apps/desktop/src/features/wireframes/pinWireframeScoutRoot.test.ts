import { describe, expect, it, vi } from 'vitest';
import {
  collectWireframeScoutRootCandidates,
  pinWireframeScoutRoot,
  WIREFRAME_SCOUT_REPOSITORY_ROOT,
} from './pinWireframeScoutRoot';

describe('pinWireframeScoutRoot', () => {
  it('pins the repository root when the repository declares no workspaces', () => {
    const pinned = pinWireframeScoutRoot({ candidates: [], goal: 'draw the admin', brief: null });
    expect(pinned.path).toBe(WIREFRAME_SCOUT_REPOSITORY_ROOT);
    expect(pinned.reason).toContain('declares no workspaces');
  });

  it('pins the workspace the goal names', () => {
    const pinned = pinWireframeScoutRoot({
      candidates: ['apps/web', 'apps/admin', 'packages/ui'],
      goal: 'redesign the admin batch review screen',
      brief: null,
    });
    expect(pinned.path).toBe('apps/admin');
    expect(pinned.reason).toContain('"admin"');
  });

  it('reads the brief as well as the goal', () => {
    const pinned = pinWireframeScoutRoot({
      candidates: ['apps/web', 'apps/admin'],
      goal: 'draw the review flow',
      brief: 'this is the web checkout, not the back office',
    });
    expect(pinned.path).toBe('apps/web');
  });

  it('falls back to the repository root when nothing in the goal names a workspace', () => {
    const pinned = pinWireframeScoutRoot({
      candidates: ['apps/web', 'apps/admin'],
      goal: 'draw the settlement flow',
      brief: null,
    });
    expect(pinned.path).toBe(WIREFRAME_SCOUT_REPOSITORY_ROOT);
    expect(pinned.reason).toContain('2 workspaces');
  });

  it('never lets a structural segment decide the root', () => {
    const pinned = pinWireframeScoutRoot({
      candidates: ['apps/web', 'apps/admin'],
      goal: 'look in the apps folder',
      brief: null,
    });
    expect(pinned.path).toBe(WIREFRAME_SCOUT_REPOSITORY_ROOT);
  });

  it('breaks a tie deterministically by path length then alphabet', () => {
    const first = pinWireframeScoutRoot({
      candidates: ['apps/reviewer-web', 'apps/review'],
      goal: 'review',
      brief: null,
    });
    const second = pinWireframeScoutRoot({
      candidates: ['apps/review', 'apps/reviewer-web'],
      goal: 'review',
      brief: null,
    });
    expect(first.path).toBe('apps/review');
    expect(second.path).toBe(first.path);
  });
});

describe('collectWireframeScoutRootCandidates', () => {
  it('expands a pnpm workspace glob into real directories', async () => {
    const list = vi.fn(async ({ relPath }: { readonly relPath: string }) =>
      relPath === 'apps'
        ? [
            { name: 'web', isDir: true },
            { name: 'admin', isDir: true },
            { name: 'README.md', isDir: false },
          ]
        : [{ name: 'ui', isDir: true }],
    );
    const read = vi.fn(async ({ relPath }: { readonly relPath: string }) =>
      relPath === 'pnpm-workspace.yaml' ? "packages:\n  - 'apps/*'\n  - 'packages/*'\n" : null,
    );
    const candidates = await collectWireframeScoutRootCandidates({ list, read });
    expect(candidates).toEqual(['apps/web', 'apps/admin', 'packages/ui']);
  });

  it('expands the inline sequence form of the pnpm workspace list', async () => {
    const list = vi.fn(async ({ relPath }: { readonly relPath: string }) =>
      relPath === 'apps'
        ? [
            { name: 'web', isDir: true },
            { name: 'admin', isDir: true },
          ]
        : [{ name: 'ui', isDir: true }],
    );
    const read = vi.fn(async ({ relPath }: { readonly relPath: string }) =>
      relPath === 'pnpm-workspace.yaml' ? "packages: ['apps/*', 'packages/*']\n" : null,
    );
    const candidates = await collectWireframeScoutRootCandidates({ list, read });
    expect(candidates).toEqual(['apps/web', 'apps/admin', 'packages/ui']);
  });

  it('pins a workspace from an inline sequence instead of the whole repository', async () => {
    const list = vi.fn(async () => [{ name: 'admin', isDir: true }]);
    const read = vi.fn(async ({ relPath }: { readonly relPath: string }) =>
      relPath === 'pnpm-workspace.yaml' ? 'packages: [apps/*]' : null,
    );
    const candidates = await collectWireframeScoutRootCandidates({ list, read });
    const pinned = pinWireframeScoutRoot({
      candidates,
      goal: 'redesign the admin batch review screen',
      brief: null,
    });
    expect(pinned.path).toBe('apps/admin');
  });

  it('falls back to the package.json workspaces field', async () => {
    const list = vi.fn(async () => [{ name: 'web', isDir: true }]);
    const read = vi.fn(async ({ relPath }: { readonly relPath: string }) =>
      relPath === 'package.json' ? JSON.stringify({ workspaces: ['apps/*', 'tooling'] }) : null,
    );
    const candidates = await collectWireframeScoutRootCandidates({ list, read });
    expect(candidates).toEqual(['apps/web', 'tooling']);
  });

  it('returns nothing when neither manifest can be read', async () => {
    const list = vi.fn(async () => []);
    const read = vi.fn(async () => {
      throw new Error('no such file');
    });
    await expect(collectWireframeScoutRootCandidates({ list, read })).resolves.toEqual([]);
  });
});
