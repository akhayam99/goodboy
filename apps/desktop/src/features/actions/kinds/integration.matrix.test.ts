// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { matrixOf } from '../../../__tests__/helpers/actionMatrix';
import type { ActionEnv } from '../types';
import { INTEGRATION_KIND, type IntegrationFacts } from './integration';

const facts = (overrides: Partial<IntegrationFacts>): IntegrationFacts => ({
  label: 'Linear',
  disconnectDescription: 'Goodboy stops reading Linear issues. Your Linear account is untouched.',
  onOpenTasks: vi.fn(),
  onCheck: vi.fn(async () => undefined),
  onDisconnect: vi.fn(async () => undefined),
  ...overrides,
});

const OPEN_TASKS = 'integration.openTasks menu';
const CHECK = 'integration.check menu';
const DISCONNECT = 'integration.disconnect menu';

const STATES: ReadonlyArray<{
  readonly name: string;
  readonly facts: IntegrationFacts;
  readonly expected: ReadonlyArray<string>;
}> = [
  {
    name: 'a tracker',
    facts: facts({}),
    expected: [OPEN_TASKS, CHECK, DISCONNECT],
  },
  {
    name: 'a host with no Tasks page',
    facts: facts({ onOpenTasks: null }),
    expected: [CHECK, DISCONNECT],
  },
  {
    name: 'an integration with nothing to check',
    facts: facts({ onOpenTasks: null, onCheck: null }),
    expected: [DISCONNECT],
  },
  {
    name: 'a host whose accounts disconnect from their own rows',
    facts: facts({ onDisconnect: null }),
    expected: [OPEN_TASKS, CHECK],
  },
];

const env: ActionEnv = {
  getState: () => {
    throw new Error('this verb does not read the store');
  },
  showToast: vi.fn(),
  copyText: vi.fn(async () => undefined),
  origin: 'menu',
  anchorKey: null,
  viewing: null,
};

const actionOf = ({ id }: { readonly id: string }) => {
  const found = INTEGRATION_KIND.actions.find((action) => action.id === id);
  if (found === undefined) {
    throw new Error(`no ${id}`);
  }
  return found;
};

describe('integration kind matrix', () => {
  it.each(STATES)('$name', ({ facts: given, expected }) => {
    expect(matrixOf({ definitions: INTEGRATION_KIND.actions, facts: given })).toEqual(expected);
  });

  it('keeps today’s Disconnect confirm with the description of the page', () => {
    expect(actionOf({ id: 'integration.disconnect' }).confirm?.({ facts: facts({}) })).toEqual({
      title: 'Disconnect Linear?',
      description: 'Goodboy stops reading Linear issues. Your Linear account is untouched.',
      confirmLabel: 'Disconnect Linear',
      role: 'danger',
    });
  });

  it('runs the page handlers', async () => {
    const given = facts({});

    await actionOf({ id: 'integration.openTasks' }).run({ facts: given, env, choice: null });
    await actionOf({ id: 'integration.check' }).run({ facts: given, env, choice: null });
    await actionOf({ id: 'integration.disconnect' }).run({ facts: given, env, choice: null });

    expect(given.onOpenTasks).toHaveBeenCalledTimes(1);
    expect(given.onCheck).toHaveBeenCalledTimes(1);
    expect(given.onDisconnect).toHaveBeenCalledTimes(1);
  });

  it('keeps the page connected and rejects when the disconnect fails', async () => {
    const failing = facts({
      onDisconnect: () => Promise.reject(new Error('Linear did not answer')),
    });

    await expect(
      actionOf({ id: 'integration.disconnect' }).run({ facts: failing, env, choice: null }),
    ).rejects.toThrow('Linear did not answer');
  });

  it('serves a GitHub, GitLab or Bitbucket binding with the same verbs', () => {
    for (const label of ['GitHub', 'GitLab', 'Bitbucket']) {
      expect(matrixOf({ definitions: INTEGRATION_KIND.actions, facts: facts({ label }) })).toEqual([
        OPEN_TASKS,
        CHECK,
        DISCONNECT,
      ]);
    }
  });
});
