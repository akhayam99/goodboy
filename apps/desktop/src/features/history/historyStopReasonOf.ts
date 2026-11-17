import type { HistoryStopReason } from '../../store/slices/history/types';

const STOP_REASONS: ReadonlyArray<HistoryStopReason> = [
  'conflict',
  'hook',
  'stuck',
  'invalid',
  'unverified',
  'origin-moved',
  'head-moved',
  'blocked',
  'dirty',
  'no-provider',
  'push-failed',
  'failed',
];

type Params = {
  readonly reason: string | undefined;
};

export const historyStopReasonOf = ({ reason }: Params): HistoryStopReason =>
  STOP_REASONS.find((known) => known === reason) ?? 'failed';
