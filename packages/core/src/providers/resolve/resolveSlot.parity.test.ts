import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProviderPolicy, RoleModelPreferences, TaskModelPreferences } from '@goodboy/types';
import { ROLE_REGISTRY, isAgentRole } from '../../roles';
import { TASKS } from '../../settings/tasks';
import type { AutoContext } from '../autoRouting/resolveAuto';
import { resolveRoleRouting } from '../role-models';
import { resolveTaskModel } from '../task-models';
import { resolveSlot } from './resolveSlot';

const POLICIES: ReadonlyArray<ProviderPolicy | null> = [
  null,
  [{ id: 'codex', state: 'on' }],
  [
    { id: 'anthropic', state: 'off' },
    { id: 'codex', state: 'on' },
  ],
  [
    { id: 'codex', state: 'on' },
    { id: 'anthropic', state: 'backup' },
  ],
];

const ROLE_PREFS: RoleModelPreferences = {
  planner: { providerId: 'anthropic', model: 'opus-5', effort: 'high' },
  reviewer: {
    providerId: 'anthropic',
    model: 'opus-5',
    effort: 'high',
    models: [
      { providerId: 'anthropic', model: 'opus-5' },
      { providerId: 'codex', model: 'gpt-6.1-sol' },
    ],
  },
  scout: { providerId: 'anthropic', model: 'claude-opus-99', effort: 'low' },
};

const TASK_PREFS: TaskModelPreferences = {
  summarizer: { providerId: 'anthropic', model: 'haiku-4.5' },
  prose_polish: {
    providerId: 'anthropic',
    model: 'sonnet-5',
    fallback: { providerId: 'codex', model: 'gpt-6.1-sol' },
  },
};

const ROLES = Object.keys(ROLE_REGISTRY).filter(isAgentRole);

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('resolveSlot answers like the entry points it is built on', () => {
  describe.each(POLICIES.map((policy, index) => [index, policy] as const))(
    'policy %s',
    (_index, policy) => {
      const auto: AutoContext = {
        defaultProvider: policy?.[0]?.id ?? 'anthropic',
        ...(policy !== null && { policy }),
      };

      it.each(ROLES)('role %s', (role) => {
        const old = resolveRoleRouting({ role, prefs: ROLE_PREFS, auto });
        const next = resolveSlot({
          slot: { kind: 'role', id: role },
          layers: { workspace: { roleModels: ROLE_PREFS } },
          context: { policy, defaultProvider: auto.defaultProvider },
        });

        expect(next).toMatchObject({
          provider: old.provider,
          model: old.model,
          effort: old.effort,
        });
        expect(next.source === 'auto').toBe(!old.isOverride);
      });

      it.each(TASKS.map((task) => task.id))('task %s', (task) => {
        const old = resolveTaskModel({
          task,
          preferences: TASK_PREFS,
          workspaceDefaultProviderId: auto.defaultProvider,
          sessionDefaultProviderId: auto.defaultProvider,
          providerPolicy: policy,
        });
        const next = resolveSlot({
          slot: { kind: 'task', id: task },
          layers: { workspace: { taskModels: TASK_PREFS } },
          context: { policy, defaultProvider: auto.defaultProvider },
        });

        expect(next).toMatchObject({
          provider: old.providerId,
          model: old.model,
          effort: old.effort ?? null,
        });
      });
    },
  );
});
