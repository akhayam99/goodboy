import { describe, expect, it, vi } from 'vitest';
import type { ProviderId } from '@goodboy/types';
import { resolveAuto } from './resolveAuto';
import { latestInGroup } from '../latestInGroup';
import { SELECTABLE_AGENT_ROLES } from '../../roles';
import { TASKS } from '../../settings/tasks';

vi.mock('../latestInGroup', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../latestInGroup')>();
  return { latestInGroup: vi.fn(actual.latestInGroup) };
});

const PROVIDERS: ReadonlyArray<ProviderId> = [
  'anthropic',
  'codex',
  'gemini',
  'cursor',
  'openrouter',
];

describe('auto line expansion', () => {
  it('expands the lines once at load and never while resolving', () => {
    const atLoad = vi.mocked(latestInGroup).mock.calls.length;
    expect(atLoad).toBeGreaterThan(0);
    for (const defaultProvider of PROVIDERS) {
      for (const role of SELECTABLE_AGENT_ROLES) {
        resolveAuto({ slot: { kind: 'role', id: role }, defaultProvider });
      }
      for (const task of TASKS) {
        resolveAuto({ slot: { kind: 'task', id: task.id }, defaultProvider });
      }
    }
    expect(vi.mocked(latestInGroup).mock.calls.length).toBe(atLoad);
  });
});
