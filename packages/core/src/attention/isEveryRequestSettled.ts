import type { SettleParams } from './settleTypes';

const OPEN_THREAD_STATES: ReadonlyArray<string> = ['needs_answer', 'failed'];

export const isEveryRequestSettled = ({ requests, threads }: SettleParams): boolean =>
  requests.length > 0 &&
  requests.every((request) => request.state === 'merged' || request.state === 'closed') &&
  !threads.some((thread) => OPEN_THREAD_STATES.includes(thread.state));
