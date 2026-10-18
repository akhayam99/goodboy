// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { matrixOf } from '../../../__tests__/helpers/actionMatrix';
import { resolveActions } from '../resolveActions';
import type { ActionEnv } from '../types';
import { PROVIDER_KIND, type ProviderFacts } from './provider';

const facts = (overrides: Partial<ProviderFacts>): ProviderFacts => ({
  label: 'Codex',
  cliPath: '/usr/local/bin/codex',
  isChecking: false,
  canReauth: true,
  willSignOutOnReauth: false,
  canDisconnect: true,
  onCheck: vi.fn(async () => undefined),
  onReauth: vi.fn(async () => undefined),
  onShowHistory: vi.fn(),
  onDisconnect: vi.fn(async () => undefined),
  ...overrides,
});

const CHECK = 'provider.check menu';
const REAUTH = 'provider.reauth menu';
const HISTORY = 'provider.history menu';
const COPY = 'provider.copyCliPath menu';
const DISCONNECT = 'provider.disconnect menu';

const STATES: ReadonlyArray<{
  readonly name: string;
  readonly facts: ProviderFacts;
  readonly expected: ReadonlyArray<string>;
}> = [
  {
    name: 'a signed in CLI provider',
    facts: facts({}),
    expected: [CHECK, REAUTH, HISTORY, COPY, DISCONNECT],
  },
  {
    name: 'a provider that runs through API keys',
    facts: facts({ canReauth: false, canDisconnect: false, cliPath: null, onShowHistory: null }),
    expected: [CHECK],
  },
  {
    name: 'a CLI that is not signed in yet',
    facts: facts({ canDisconnect: false, canReauth: false }),
    expected: [CHECK, HISTORY, COPY],
  },
  {
    name: 'a check already running',
    facts: facts({ isChecking: true }),
    expected: ['provider.check menu (Checking)', REAUTH, HISTORY, COPY, DISCONNECT],
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
  const found = PROVIDER_KIND.actions.find((action) => action.id === id);
  if (found === undefined) {
    throw new Error(`no ${id}`);
  }
  return found;
};

describe('provider kind matrix', () => {
  it.each(STATES)('$name', ({ facts: given, expected }) => {
    expect(matrixOf({ definitions: PROVIDER_KIND.actions, facts: given })).toEqual(expected);
  });

  it('puts Disconnect last, behind its own separator group', () => {
    const resolved = resolveActions({ definitions: PROVIDER_KIND.actions, facts: facts({}) });

    expect(resolved.map((action) => action.group)).toEqual(['act', 'act', 'act', 'copy', 'danger']);
  });

  it('asks before Sign in again only when it signs the CLI out first', () => {
    const reauth = actionOf({ id: 'provider.reauth' });

    expect(reauth.confirm?.({ facts: facts({}) })).toBeNull();
    expect(reauth.confirm?.({ facts: facts({ willSignOutOnReauth: true }) })).toEqual({
      title: 'Sign in to Codex again?',
      description: 'Signing in again signs you out of Codex first.',
      confirmLabel: 'Sign in again',
      role: 'alert',
    });
  });

  it('keeps today’s Disconnect confirm', () => {
    expect(actionOf({ id: 'provider.disconnect' }).confirm?.({ facts: facts({}) })).toEqual({
      title: 'Disconnect Codex?',
      description: 'Signs the CLI out on this machine. Connect again to sign back in.',
      confirmLabel: 'Disconnect',
      role: 'alert',
    });
  });

  it('runs the page handlers and copies the CLI path', async () => {
    const given = facts({});
    const copyText = vi.fn(async () => undefined);

    await actionOf({ id: 'provider.check' }).run({ facts: given, env, choice: null });
    await actionOf({ id: 'provider.reauth' }).run({ facts: given, env, choice: null });
    await actionOf({ id: 'provider.history' }).run({ facts: given, env, choice: null });
    await actionOf({ id: 'provider.copyCliPath' }).run({
      facts: given,
      env: { ...env, copyText },
      choice: null,
    });
    await actionOf({ id: 'provider.disconnect' }).run({ facts: given, env, choice: null });

    expect(given.onCheck).toHaveBeenCalledTimes(1);
    expect(given.onReauth).toHaveBeenCalledTimes(1);
    expect(given.onShowHistory).toHaveBeenCalledTimes(1);
    expect(given.onDisconnect).toHaveBeenCalledTimes(1);
    expect(copyText).toHaveBeenCalledWith({ text: '/usr/local/bin/codex' });
  });

  it('keeps the account connected and rejects when the disconnect fails', async () => {
    const failing = facts({ onDisconnect: () => Promise.reject(new Error('keychain refused')) });

    await expect(
      actionOf({ id: 'provider.disconnect' }).run({ facts: failing, env, choice: null }),
    ).rejects.toThrow('keychain refused');
  });

  it('lets a failed check reach the menu so it can say why', async () => {
    const failing = facts({ onCheck: () => Promise.reject(new Error('timed out')) });

    await expect(
      actionOf({ id: 'provider.check' }).run({ facts: failing, env, choice: null }),
    ).rejects.toThrow('timed out');
  });
});
