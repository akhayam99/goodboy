import { createPort } from './createPort';

export type ChecksRerunResult =
  | Readonly<{ kind: 'rerun'; verdict: 'green' | 'red' | 'not_checked' }>
  | Readonly<{ kind: 'refused'; message: string }>;

type RerunParams = {
  readonly delegationId: string;
};

export type ChecksRerunPort = (params: RerunParams) => Promise<ChecksRerunResult>;

const slot = createPort<ChecksRerunPort>();

export const registerChecksRerunPort = slot.register;

export const currentChecksRerunPort = slot.current;
