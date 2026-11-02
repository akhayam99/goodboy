import { formatUsd } from '@goodboy/ui';
import type { StartShape } from '../../store/slices/sessionDraft/state';

type AmountParams = {
  readonly usd: number | null;
};

export type AutoLimitKind = Exclude<StartShape, 'agent'>;

type KindParams = {
  readonly kind: AutoLimitKind;
};

const NO_LIMIT = 'No limit';

const LIMIT_NONE = 'Limit: none';

const TITLE = {
  orchestrated: 'Limit for this run',
  preset: 'Limit for this run',
  autoAgent: 'Limit for this Auto run',
} as const satisfies Record<AutoLimitKind, string>;

const SPENDER = {
  orchestrated: 'this run and the agents it starts',
  preset: 'this run and the agents it starts',
  autoAgent: 'Auto and the agents it starts',
} as const satisfies Record<AutoLimitKind, string>;

const STARTS_FROM = 'It applies to this run only. Run defaults set where new runs start.';

export const AUTO_LIMIT_COPY = {
  noLimit: NO_LIMIT,
  defaultTag: 'default',
  other: 'Other amount',
  use: 'Use this limit',
  changeDefault: 'Change default',
  invalid: 'Enter an amount more than zero.',
  fromSession: 'From the budget of this session',
  labelOf: ({ usd }: AmountParams): string =>
    usd === null ? LIMIT_NONE : `Limit: ${formatUsd(usd)}`,
  titleOf: ({ kind }: KindParams): string => TITLE[kind],
  helpOf: ({ kind }: KindParams): string =>
    `The most ${SPENDER[kind]} may spend. Without a limit, it only stops when the work is done. Your session limit and a provider's monthly limit still apply, whichever comes first. ${STARTS_FROM}`,
} as const;
