import type { AgentStoppedBy } from '@goodboy/types';

type Params = {
  readonly by: AgentStoppedBy | undefined;
  readonly reason?: string;
  readonly isLong?: boolean;
};

const SHORT = {
  you: 'Stopped by you',
  app: 'Stopped by restart',
  auto: 'Stopped by Auto',
} as const satisfies Record<AgentStoppedBy, string>;

const LONG = {
  ...SHORT,
  app: 'Stopped by a restart of the app',
} as const satisfies Record<AgentStoppedBy, string>;

export const stoppedPhraseOf = ({ by = 'you', reason = '', isLong = false }: Params): string => {
  const phrase = (isLong ? LONG : SHORT)[by];
  const said = reason.trim();
  return by === 'auto' && said !== '' ? `${phrase}: ${said}` : phrase;
};
