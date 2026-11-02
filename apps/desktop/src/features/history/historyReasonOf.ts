import { HISTORY_REASON_COPY } from './historyReasonCopy';

type Params = {
  readonly reason: string;
};

export const historyReasonOf = ({ reason }: Params): string =>
  HISTORY_REASON_COPY[reason] ?? reason;
