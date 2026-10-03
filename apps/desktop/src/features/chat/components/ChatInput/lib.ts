import type { AgentId, ProviderId, TurnProviderOverride, EffortLevel } from '@goodboy/types';
import type { PendingAttachment, StoredAttachment } from '../../../attachments/pendingAttachment';
import { PREFIXES, type QuickActionGroup } from '../../../quick-actions/grammar';
import { EFFORT_LEVELS } from '../../utils/chat-constants';

export const RUNNING_KINDS = new Set(['starting', 'running']);

const CHAT_GROUP_ORDER: ReadonlyArray<QuickActionGroup> = ['script', 'workflow', 'skill', 'agent'];

export const CHAT_PREFIXES = CHAT_GROUP_ORDER.flatMap((group) =>
  PREFIXES.filter((prefix) => prefix.group === group),
);

const escapeForClass = (symbol: string): string => symbol.replace(/[\\\]^-]/g, '\\$&');

export const CHAT_PREFIX_RE = new RegExp(
  `^\\s*[${CHAT_PREFIXES.map((prefix) => escapeForClass(prefix.symbol)).join('')}][^\\s]*$`,
);

type ComposerPlaceholderParams = {
  readonly isRunning: boolean;
  readonly firstMessagePrompt: string | null;
  readonly roleLabel: string | null;
};

export const composerPlaceholder = ({
  isRunning,
  firstMessagePrompt,
  roleLabel,
}: ComposerPlaceholderParams): string => {
  if (firstMessagePrompt !== null) {
    return firstMessagePrompt;
  }
  if (isRunning) {
    return roleLabel !== null ? `Queue a message for ${roleLabel}` : 'Queue a message';
  }
  return roleLabel !== null ? `Reply to ${roleLabel}` : 'Reply';
};

export const VALID_PROVIDERS = [
  'anthropic',
  'cursor',
  'codex',
  'gemini',
  'opencode',
  'openrouter',
  'moonshot',
] satisfies ReadonlyArray<ProviderId>;

type Expect<T extends true> = T;
type ValidProvidersAreTotal =
  Exclude<ProviderId, (typeof VALID_PROVIDERS)[number]> extends never ? true : false;
type _ValidProvidersTotalCheck = Expect<ValidProvidersAreTotal>;

export type FailedTurn = {
  readonly agentId: AgentId;
  readonly content: string;
  readonly attachments: ReadonlyArray<PendingAttachment>;
  readonly override: TurnProviderOverride | undefined;
};

export type QueuedTurn = Omit<FailedTurn, 'attachments'> & {
  readonly id: string;
  readonly attachments: ReadonlyArray<StoredAttachment>;
};

export const asEffortLevel = (v: string | undefined | null): EffortLevel | null => {
  return v && EFFORT_LEVELS.includes(v as EffortLevel) ? (v as EffortLevel) : null;
};

export const asProvider = (v: string | undefined | null): ProviderId | null => {
  return v && VALID_PROVIDERS.includes(v as ProviderId) ? (v as ProviderId) : null;
};
