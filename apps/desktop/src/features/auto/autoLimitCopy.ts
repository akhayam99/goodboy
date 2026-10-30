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

export const AUTO_LIMIT_COPY = {
  noLimit: NO_LIMIT,
  defaultTag: 'default',
  other: 'Other amount',
  use: 'Use this limit',
  invalid: 'Enter an amount more than zero.',
  fromSession: 'From the budget of this session',
  labelOf: ({ usd }: AmountParams): string => (usd === null ? NO_LIMIT : `Limit ${formatUsd(usd)}`),
  titleOf: ({ kind }: KindParams): string => TITLE[kind],
  helpOf: ({ kind }: KindParams): string =>
    `The most ${SPENDER[kind]} may spend. Without a limit, it only stops when the work is done. Other runs in this workspace start from the same limit.`,
} as const;
