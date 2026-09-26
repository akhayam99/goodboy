import { describe, expect, it } from 'vitest';
import { workspaceInvocation } from './workspaceInvocation';

describe('workspaceInvocation', () => {
  it('runs the manager invocation directly for the root package', () => {
    expect(
      workspaceInvocation({ manager: 'yarn', packageName: 'northwind', relDir: '', name: 'dev' }),
    ).toBe('yarn run dev');
    expect(
      workspaceInvocation({
        manager: 'composer',
        packageName: 'acme/server',
        relDir: '',
        name: 'test',
      }),
    ).toBe('composer run-script test');
  });

  it('reaches a yarn workspace package by name from the root', () => {
    expect(
      workspaceInvocation({
        manager: 'yarn',
        packageName: '@northwind/web',
        relDir: 'apps/web',
        name: 'dev',
      }),
    ).toBe('yarn workspace @northwind/web run dev');
  });

  it('reaches a pnpm workspace package with --filter', () => {
    expect(
      workspaceInvocation({
        manager: 'pnpm',
        packageName: '@northwind/web',
        relDir: 'apps/web',
        name: 'dev',
      }),
    ).toBe('pnpm --filter @northwind/web run dev');
  });

  it('reaches an npm workspace package by folder', () => {
    expect(
      workspaceInvocation({
        manager: 'npm',
        packageName: '@northwind/web',
        relDir: 'apps/web',
        name: 'dev',
      }),
    ).toBe('npm run dev --workspace apps/web');
  });

  it('reaches a bun workspace package with --filter', () => {
    expect(
      workspaceInvocation({
        manager: 'bun',
        packageName: '@northwind/web',
        relDir: 'apps/web',
        name: 'dev',
      }),
    ).toBe('bun run --filter @northwind/web dev');
  });

  it('reaches a composer package with -d', () => {
    expect(
      workspaceInvocation({
        manager: 'composer',
        packageName: 'acme/api',
        relDir: 'apps/api',
        name: 'dev',
      }),
    ).toBe('composer run-script dev -d apps/api');
  });
});
