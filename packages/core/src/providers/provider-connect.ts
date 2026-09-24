import type { ProviderConnectCapability, ProviderId } from '@goodboy/types';

export const PROVIDER_CONNECT_CAPABILITIES = {
  anthropic: {
    tier: 'one-click',
    hasAuthProbe: true,
    opensBrowser: true,
    loginEnv: {},
    manualReason: null,
  },
  cursor: {
    tier: 'one-click',
    hasAuthProbe: true,
    opensBrowser: true,
    loginEnv: { NO_OPEN_BROWSER: '1' },
    manualReason: null,
  },
  codex: {
    tier: 'one-click',
    hasAuthProbe: true,
    opensBrowser: true,
    loginEnv: {},
    manualReason: null,
  },
  gemini: {
    tier: 'manual',
    hasAuthProbe: true,
    opensBrowser: false,
    loginEnv: {},
    manualReason:
      'Antigravity has no login command: `agy` ships no auth subcommand at all. Sign in from the Antigravity app, or set GEMINI_API_KEY as a credential.',
  },
  opencode: {
    tier: 'assisted',
    hasAuthProbe: true,
    opensBrowser: true,
    loginEnv: {},
    manualReason: null,
  },
  openrouter: {
    tier: 'assisted',
    hasAuthProbe: true,
    opensBrowser: true,
    loginEnv: {},
    manualReason: null,
  },
  moonshot: {
    tier: 'assisted',
    hasAuthProbe: true,
    opensBrowser: true,
    loginEnv: {},
    manualReason: null,
  },
} satisfies Readonly<Record<ProviderId, ProviderConnectCapability>>;
