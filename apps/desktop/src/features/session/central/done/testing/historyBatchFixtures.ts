import { brandId, type IsoDateTime, type SessionEvent } from '@goodboy/types';
import { eventOf } from './doneFixtures';

type StampParams = {
  readonly minute: number;
  readonly second: number;
};

export const stamp = ({ minute, second }: StampParams): IsoDateTime =>
  brandId<IsoDateTime>({ value: new Date(2026, 9, 18, 9, minute, second).toISOString() });

const PROJECTS = ['payments-api', 'ledger-core', 'notify-relay'];

type BranchParams = {
  readonly index: number;
  readonly batchId?: string;
  readonly origin?: 'rebase' | 'plan';
  readonly prNumber?: number;
  readonly agentId?: string;
  readonly minuteOffset?: number;
};

export const branchEvents = ({
  index,
  batchId,
  origin = 'rebase',
  prNumber,
  agentId,
  minuteOffset = 0,
}: BranchParams): ReadonlyArray<SessionEvent> => {
  const payload = {
    origin,
    branch: `hl/branch-${index}`,
    mountId: `mount-${index}`,
    projectName: PROJECTS[index % PROJECTS.length] ?? 'payments-api',
    ...(batchId === undefined ? {} : { batchId }),
    ...(agentId === undefined ? {} : { agentId }),
  };
  const minute = index + minuteOffset;
  return [
    eventOf({
      id: `rw-${index}`,
      kind: 'history_rewritten',
      payload,
      createdAt: stamp({ minute, second: 0 }),
    }),
    eventOf({
      id: `ps-${index}`,
      kind: 'history_pushed',
      payload: { ...payload, ...(prNumber === undefined ? {} : { prNumber }) },
      createdAt: stamp({ minute, second: 30 }),
    }),
  ];
};

type ManyParams = {
  readonly count: number;
  readonly batchId?: string;
  readonly agentIds?: ReadonlyArray<string>;
};

export const manyBranchEvents = ({
  count,
  batchId,
  agentIds = [],
}: ManyParams): ReadonlyArray<SessionEvent> =>
  Array.from({ length: count }, (_, index) =>
    branchEvents({
      index,
      ...(batchId === undefined ? {} : { batchId }),
      ...(index < 3 ? { prNumber: 300 + index } : {}),
      ...(agentIds[index] === undefined ? {} : { agentId: agentIds[index] }),
    }),
  ).flat();

export const rebaseRequest: SessionEvent = eventOf({
  id: 'request',
  kind: 'rebase_requested',
  payload: { branch: 'main' },
  createdAt: stamp({ minute: 0, second: 0 }),
});
