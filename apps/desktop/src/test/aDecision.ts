import { brandId, type IsoDateTime, type SessionDecision, type SessionId } from '@goodboy/types';

const AT = brandId<IsoDateTime>({ value: '2026-11-01T08:00:00.000Z' });

type Params = Partial<SessionDecision> & {
  readonly number: number;
  readonly sessionId: SessionId;
};

export const aDecision = ({ number, sessionId, ...overrides }: Params): SessionDecision => ({
  id: `decision-${number}`,
  sessionId,
  number,
  text: `Decision ${number}`,
  why: null,
  status: 'active',
  replacedBy: null,
  author: 'agent',
  agentId: null,
  turnOrdinal: 1,
  reason: null,
  closedBy: null,
  closedByAgentId: null,
  previousText: null,
  rewordedAt: null,
  createdAt: AT,
  updatedAt: AT,
  ...overrides,
});
