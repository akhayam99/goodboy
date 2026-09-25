import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';
import { describe, expect, it } from 'vitest';
import { resolveLimitedTaskModel } from './resolveLimitedTaskModel';

const DESKTOP_SRC = join(__dirname, '..', '..', '..');
const HELPER = join(__dirname, 'resolveLimitedTaskModel.ts');

const sourceFiles = (dir: string): ReadonlyArray<string> =>
  readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      return entry === 'node_modules' ? [] : sourceFiles(path);
    }
    return /\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry) ? [path] : [];
  });

describe('resolveLimitedTaskModel', () => {
  it('runs an Auto naming task on the next provider while the default is exhausted', () => {
    const base = {
      task: 'agent_naming' as const,
      preferences: null,
      workspaceDefaultProviderId: 'codex' as const,
      sessionDefaultProviderId: 'codex' as const,
    };

    expect(resolveLimitedTaskModel({ ...base, limitContext: null }).providerId).toBe('codex');
    expect(
      resolveLimitedTaskModel({
        ...base,
        limitContext: { connected: ['codex', 'anthropic'], atLimit: ['codex'] },
      }).providerId,
    ).toBe('anthropic');
  });

  it('keeps a pinned task on its provider', () => {
    expect(
      resolveLimitedTaskModel({
        task: 'agent_naming',
        preferences: { agent_naming: { providerId: 'codex', model: 'gpt-5.6-luna' } },
        workspaceDefaultProviderId: 'codex',
        sessionDefaultProviderId: 'codex',
        limitContext: { connected: ['codex', 'anthropic'], atLimit: ['codex'] },
      }).providerId,
    ).toBe('codex');
  });

  it('is the only way the desktop resolves a task model', () => {
    const offenders = sourceFiles(DESKTOP_SRC)
      .filter((file) => file !== HELPER)
      .filter((file) => /\bresolveTaskModel\b/.test(readFileSync(file, 'utf8')))
      .map((file) => relative(DESKTOP_SRC, file));

    expect(offenders).toEqual([]);
  });
});
