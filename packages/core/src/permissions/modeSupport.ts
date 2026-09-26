import type { ClaudePermissionMode, ProviderId } from '@goodboy/types';

export type ModeSupportLevel = 'works' | 'partly' | 'fallback';

export type ModeSupport = {
  readonly support: ModeSupportLevel;
  readonly runsAs: ClaudePermissionMode;
  readonly reason: string | null;
};

type ModeSupportTable = Record<ClaudePermissionMode, ModeSupport>;

export const MODE_STRICTNESS: Record<ClaudePermissionMode, number> = {
  plan: 0,
  dontAsk: 1,
  default: 2,
  acceptEdits: 3,
  bypassPermissions: 4,
};

const works = ({ mode }: { readonly mode: ClaudePermissionMode }): ModeSupport => ({
  support: 'works',
  runsAs: mode,
  reason: null,
});

const partly = ({
  mode,
  reason,
}: {
  readonly mode: ClaudePermissionMode;
  readonly reason: string;
}): ModeSupport => ({ support: 'partly', runsAs: mode, reason });

const CANT_ASK: ModeSupport = {
  support: 'fallback',
  runsAs: 'plan',
  reason: "it can't stop to ask you",
};

const CANT_SCOPE_EDITS: ModeSupport = {
  support: 'fallback',
  runsAs: 'plan',
  reason: "it can't allow edits without allowing commands",
};

const OPENCODE_TABLE: ModeSupportTable = {
  plan: partly({ mode: 'plan', reason: 'Edits are blocked, shell commands still run' }),
  dontAsk: CANT_ASK,
  default: CANT_ASK,
  acceptEdits: CANT_SCOPE_EDITS,
  bypassPermissions: works({ mode: 'bypassPermissions' }),
};

const MODE_SUPPORT: Record<ProviderId, ModeSupportTable> = {
  anthropic: {
    plan: works({ mode: 'plan' }),
    dontAsk: works({ mode: 'dontAsk' }),
    default: partly({
      mode: 'default',
      reason: 'Asks after the fact: it stops, then you allow and continue',
    }),
    acceptEdits: works({ mode: 'acceptEdits' }),
    bypassPermissions: works({ mode: 'bypassPermissions' }),
  },
  codex: {
    plan: works({ mode: 'plan' }),
    dontAsk: CANT_ASK,
    default: CANT_ASK,
    acceptEdits: partly({
      mode: 'acceptEdits',
      reason: 'Commands run too, but only inside the projects',
    }),
    bypassPermissions: partly({
      mode: 'bypassPermissions',
      reason: 'Writes only inside the projects',
    }),
  },
  gemini: {
    plan: works({ mode: 'plan' }),
    dontAsk: CANT_ASK,
    default: CANT_ASK,
    acceptEdits: works({ mode: 'acceptEdits' }),
    bypassPermissions: works({ mode: 'bypassPermissions' }),
  },
  cursor: {
    plan: partly({ mode: 'plan', reason: "Plan mode hasn't been fully checked" }),
    dontAsk: CANT_ASK,
    default: CANT_ASK,
    acceptEdits: CANT_SCOPE_EDITS,
    bypassPermissions: works({ mode: 'bypassPermissions' }),
  },
  opencode: OPENCODE_TABLE,
  openrouter: OPENCODE_TABLE,
  moonshot: OPENCODE_TABLE,
};

type ModeForProvider = {
  readonly provider: ProviderId;
  readonly mode: ClaudePermissionMode;
};

export const modeSupportFor = ({ provider, mode }: ModeForProvider): ModeSupport => {
  return MODE_SUPPORT[provider][mode];
};

export const resolveModeFor = ({ provider, mode }: ModeForProvider): ClaudePermissionMode => {
  return modeSupportFor({ provider, mode }).runsAs;
};
