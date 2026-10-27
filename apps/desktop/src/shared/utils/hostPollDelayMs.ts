import { HOST_BACKOFF } from './hostBackoff';

type Params = {
  readonly unreachable: number;
};

export const hostPollDelayMs = ({ unreachable }: Params): number =>
  unreachable >= HOST_BACKOFF.slowAfterUnreachable ? HOST_BACKOFF.slowPollMs : HOST_BACKOFF.pollMs;
