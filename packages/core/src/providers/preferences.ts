import type { SessionProviderPreference } from '@kay-am/types';

/**
 * Baseline provider preference used when a session has no explicit override.
 * Lives in `@kay-am/core` (not `@kay-am/types`) because it is a runtime
 * constant — the types package is strict types-only per its conventions.
 */
export const DEFAULT_SESSION_PROVIDER_PREFERENCE: SessionProviderPreference = {
  defaultProvider: 'anthropic',
  allowTurnOverride: true,
};
