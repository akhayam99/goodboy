import type { WorkflowRoutingDecision } from '@goodboy/types';

export type CandidateCause =
  | 'off'
  | 'not-connected'
  | 'backup-idle'
  | 'at-limit'
  | 'cooldown'
  | 'breaker'
  | 'budget'
  | 'outside-run'
  | 'failed-start'
  | 'not-for-helpers'
  | 'writer'
  | 'no-model'
  | 'hidden'
  | 'no-access'
  | 'cli-too-old'
  | 'off-pin'
  | 'same-family'
  | 'unknown-model'
  | 'not-listed';

type CauseCopy = Readonly<{
  text: string;
  adjustment: WorkflowRoutingDecision['adjustment'];
}>;

export const CANDIDATE_CAUSES = {
  off: { text: 'turned off in Settings', adjustment: 'disconnected' },
  'not-connected': { text: 'not connected', adjustment: 'disconnected' },
  'backup-idle': {
    text: 'backup, used only when no On provider can work',
    adjustment: 'disconnected',
  },
  'at-limit': { text: 'out of room until its limit resets', adjustment: 'cooldown' },
  cooldown: { text: 'cooling down after a limit', adjustment: 'cooldown' },
  breaker: { text: 'paused after repeated failures', adjustment: 'disconnected' },
  budget: { text: 'past its budget', adjustment: 'budget' },
  'outside-run': { text: 'not one of the providers for this run', adjustment: 'disconnected' },
  'failed-start': {
    text: 'an agent for this role did not start here',
    adjustment: 'disconnected',
  },
  'not-for-helpers': {
    text: 'not used: cannot keep it read-only yet',
    adjustment: 'disconnected',
  },
  writer: {
    text: 'read-only jobs only: cannot block its pushes yet',
    adjustment: 'disconnected',
  },
  'no-model': { text: 'no model here fits this step', adjustment: 'unknown_model' },
  hidden: { text: 'hidden in Settings', adjustment: 'hidden' },
  'no-access': { text: 'not on your account', adjustment: 'hidden' },
  'cli-too-old': { text: 'its CLI is too old for this model', adjustment: 'unknown_model' },
  'off-pin': { text: 'this role is pinned to other models', adjustment: 'hidden' },
  'same-family': { text: 'same model family as the writer of the change', adjustment: 'hidden' },
  'unknown-model': { text: 'not a model this build knows', adjustment: 'unknown_model' },
  'not-listed': { text: 'not a candidate for this step', adjustment: 'unknown_model' },
} as const satisfies Readonly<Record<CandidateCause, CauseCopy>>;

const MAX_CAUSE_LENGTH = 60;

type NamedCauseParams = {
  readonly name: string;
};

const NAMED_CAUSE_TEXT: Readonly<
  Partial<Record<CandidateCause, (params: NamedCauseParams) => string>>
> = {
  'not-for-helpers': ({ name }) => `not used: cannot keep ${name} read-only yet`,
  writer: ({ name }) => `read-only jobs only: cannot block ${name}'s pushes yet`,
};

type CauseTextParams = {
  readonly cause: CandidateCause;
  readonly providerName: string | null;
};

export const candidateCauseTextOf = ({ cause, providerName }: CauseTextParams): string => {
  const named = NAMED_CAUSE_TEXT[cause];
  if (named === undefined || providerName === null) {
    return CANDIDATE_CAUSES[cause].text;
  }
  const text = named({ name: providerName });
  return text.length > MAX_CAUSE_LENGTH ? CANDIDATE_CAUSES[cause].text : text;
};

type OrderFactParams = {
  readonly providerName: string;
  readonly order: number;
};

export const candidateOrderFactOf = ({ providerName, order }: OrderFactParams): string =>
  `${providerName} is #${order} in your order`;
