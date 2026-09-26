import { modeSupportFor } from '@goodboy/core';
import type { ClaudePermissionMode, PermissionRule, ProviderId } from '@goodboy/types';
import type { Tone } from '@goodboy/ui';
import { modeCopyOf } from '../modeCopy';

export type SupportCell = {
  readonly glyph: '✓' | '≈' | '✕' | '⚠';
  readonly word: string;
  readonly detail: string | null;
  readonly tone: Tone;
};

export const SUPPORT_COLUMNS = [
  'anthropic',
  'codex',
  'cursor',
  'gemini',
  'opencode',
] as const satisfies ReadonlyArray<ProviderId>;

export const RULE_PROVIDERS = ['anthropic'] as const satisfies ReadonlyArray<ProviderId>;

type ModeCellParams = {
  readonly provider: ProviderId;
  readonly mode: ClaudePermissionMode;
};

type ProviderParams = {
  readonly provider: ProviderId;
};

type RuleSplitParams = {
  readonly providers: ReadonlyArray<ProviderId>;
};

export type RuleSplit = {
  readonly followers: ReadonlyArray<ProviderId>;
  readonly ignorers: ReadonlyArray<ProviderId>;
};

export const modeCell = ({ provider, mode }: ModeCellParams): SupportCell => {
  const support = modeSupportFor({ provider, mode });
  if (support.support === 'works') {
    return { glyph: '✓', word: 'Works', detail: null, tone: 'success' };
  }
  if (support.support === 'partly') {
    return { glyph: '≈', word: 'Partly', detail: support.reason, tone: 'warning' };
  }
  return {
    glyph: '✕',
    word: `Runs ${modeCopyOf({ mode: support.runsAs }).label}`,
    detail: support.reason,
    tone: 'neutral',
  };
};

export const followsRules = ({ provider }: ProviderParams): boolean =>
  RULE_PROVIDERS.some((candidate) => candidate === provider);

export const ruleCell = ({ provider }: ProviderParams): SupportCell =>
  followsRules({ provider })
    ? { glyph: '✓', word: 'Works', detail: null, tone: 'success' }
    : {
        glyph: '✕',
        word: 'Ignored',
        detail: 'This CLI has no allow or deny flag',
        tone: 'neutral',
      };

export const ROLE_LIMIT_CELL: SupportCell = {
  glyph: '≈',
  word: 'Asked',
  detail: 'An instruction to the agent, checked after each turn',
  tone: 'warning',
};

export const splitRuleProviders = ({ providers }: RuleSplitParams): RuleSplit => ({
  followers: providers.filter((provider) => followsRules({ provider })),
  ignorers: providers.filter((provider) => !followsRules({ provider })),
});

type IgnoredDenyParams = {
  readonly rules: ReadonlyArray<PermissionRule>;
  readonly activeProviders: ReadonlyArray<ProviderId>;
};

export const hasIgnoredDeny = ({ rules, activeProviders }: IgnoredDenyParams): boolean =>
  rules.some((rule) => rule.decision === 'deny') &&
  splitRuleProviders({ providers: activeProviders }).ignorers.length > 0;
