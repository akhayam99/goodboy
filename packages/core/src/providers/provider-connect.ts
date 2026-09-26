import type { ProviderConnectCapability, ProviderId } from '@goodboy/types';

export const PROVIDER_CONNECT_CAPABILITIES = {
  anthropic: {
    tier: 'one-click',
    browserOwner: 'cli',
    reauthSignsOut: false,
    loginEnv: {},
    manualReason: null,
  },
  cursor: {
    tier: 'one-click',
    browserOwner: 'goodboy',
    reauthSignsOut: false,
    loginEnv: { NO_OPEN_BROWSER: '1' },
    manualReason: null,
  },
  codex: {
    tier: 'one-click',
    browserOwner: 'cli',
    reauthSignsOut: true,
    loginEnv: {},
    manualReason: null,
  },
  gemini: {
    tier: 'manual',
    browserOwner: 'none',
    reauthSignsOut: false,
    loginEnv: {},
    manualReason:
      'Antigravity has no login command: `agy` ships no auth subcommand at all. Sign in from the Antigravity app, or set GEMINI_API_KEY as a credential.',
  },
  opencode: {
    tier: 'assisted',
    browserOwner: 'goodboy',
    reauthSignsOut: false,
    loginEnv: {},
    manualReason: null,
  },
  openrouter: {
    tier: 'assisted',
    browserOwner: 'goodboy',
    reauthSignsOut: false,
    loginEnv: {},
    manualReason: null,
  },
  moonshot: {
    tier: 'assisted',
    browserOwner: 'goodboy',
    reauthSignsOut: false,
    loginEnv: {},
    manualReason: null,
  },
} satisfies Readonly<Record<ProviderId, ProviderConnectCapability>>;
