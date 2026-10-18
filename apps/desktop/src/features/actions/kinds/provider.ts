import { Copy, History, LogIn, RefreshCw, Unplug } from 'lucide-react';
import type { ObjectKindDefinition, ProviderActionTarget } from '../types';

export type ProviderFacts = {
  readonly label: string;
  readonly cliPath: string | null;
  readonly isChecking: boolean;
  readonly canReauth: boolean;
  readonly willSignOutOnReauth: boolean;
  readonly canDisconnect: boolean;
  readonly onCheck: () => Promise<void>;
  readonly onReauth: () => Promise<void>;
  readonly onShowHistory: (() => void) | null;
  readonly onDisconnect: () => Promise<void>;
};

export const PROVIDER_KIND: ObjectKindDefinition<ProviderActionTarget, ProviderFacts> = {
  noun: 'provider',
  facts: ({ target }) => (target.facts.label === '' ? null : target.facts),
  actions: [
    {
      id: 'provider.check',
      label: 'Check again',
      icon: RefreshCw,
      group: 'act',
      pendingLabel: () => 'Checking',
      isBusy: ({ facts }) => facts.isChecking,
      blockedReason: ({ facts }) => (facts.isChecking ? 'Checking' : null),
      when: () => true,
      run: async ({ facts }) => {
        await facts.onCheck();
      },
    },
    {
      id: 'provider.reauth',
      label: 'Sign in again',
      icon: LogIn,
      group: 'act',
      when: ({ facts }) => facts.canReauth,
      confirm: ({ facts }) =>
        facts.willSignOutOnReauth
          ? {
              title: `Sign in to ${facts.label} again?`,
              description: `Signing in again signs you out of ${facts.label} first.`,
              confirmLabel: 'Sign in again',
              role: 'alert',
            }
          : null,
      run: async ({ facts }) => {
        await facts.onReauth();
      },
    },
    {
      id: 'provider.history',
      label: 'History',
      icon: History,
      group: 'act',
      when: ({ facts }) => facts.onShowHistory !== null,
      run: ({ facts }) => facts.onShowHistory?.(),
    },
    {
      id: 'provider.copyCliPath',
      label: 'Copy CLI path',
      icon: Copy,
      group: 'copy',
      when: ({ facts }) => facts.cliPath !== null,
      run: async ({ facts, env }) => {
        if (facts.cliPath === null) {
          return 'unchanged';
        }
        await env.copyText({ text: facts.cliPath });
      },
    },
    {
      id: 'provider.disconnect',
      label: 'Disconnect',
      icon: Unplug,
      group: 'danger',
      pendingLabel: () => 'Disconnecting',
      when: ({ facts }) => facts.canDisconnect,
      confirm: ({ facts }) => ({
        title: `Disconnect ${facts.label}?`,
        description: 'Signs the CLI out on this machine. Connect again to sign back in.',
        confirmLabel: 'Disconnect',
        role: 'alert',
      }),
      run: async ({ facts }) => {
        await facts.onDisconnect();
      },
    },
  ],
};
