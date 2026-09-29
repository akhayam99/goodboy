import type { AgentId, SessionDecision, SessionDecisionAuthor } from '@goodboy/types';
import { formatSpan } from '../../../../shared/utils/time/formatSpan';

type AgentNames = ReadonlyMap<AgentId, string>;

type WhoParams = {
  readonly author: SessionDecisionAuthor;
  readonly agentId: AgentId | null;
  readonly agentNames: AgentNames;
};

export const decisionAuthorLabel = ({ author, agentId, agentNames }: WhoParams): string => {
  switch (author) {
    case 'user':
      return 'You';
    case 'summarizer':
      return 'Goodboy';
    case 'agent':
      return agentId === null ? 'An agent' : (agentNames.get(agentId) ?? 'An agent');
    default: {
      const unreachable: never = author;
      return unreachable;
    }
  }
};

type AgeParams = {
  readonly iso: string;
  readonly nowMs: number;
};

export const decisionAge = ({ iso, nowMs }: AgeParams): string => {
  const fromMs = Date.parse(iso);
  if (Number.isNaN(fromMs) || nowMs - fromMs < 60_000) {
    return 'now';
  }
  return formatSpan({ from: iso, to: nowMs });
};

type BylineParams = {
  readonly decision: SessionDecision;
  readonly agentNames: AgentNames;
  readonly replaces: number | null;
  readonly nowMs: number;
};

export const activeDecisionByline = ({
  decision,
  agentNames,
  replaces,
  nowMs,
}: BylineParams): string =>
  [
    decisionAuthorLabel({ author: decision.author, agentId: decision.agentId, agentNames }),
    decision.turnOrdinal === null || decision.author === 'user'
      ? null
      : `turn ${decision.turnOrdinal}`,
    decisionAge({ iso: decision.createdAt, nowMs }),
    replaces === null ? null : `replaces ${replaces}`,
  ]
    .filter((part): part is string => part !== null)
    .join(' · ');

type ClosedParams = {
  readonly decision: SessionDecision;
  readonly agentNames: AgentNames;
};

export type ClosedDecisionByline = {
  readonly author: string;
  readonly verb: 'replaced by' | 'merged into' | 'withdrawn';
  readonly target: number | null;
  readonly closer: string | null;
};

export const closedDecisionByline = ({
  decision,
  agentNames,
}: ClosedParams): ClosedDecisionByline => {
  const author = decisionAuthorLabel({
    author: decision.author,
    agentId: decision.agentId,
    agentNames,
  });
  const closer =
    decision.closedBy === null
      ? null
      : decisionAuthorLabel({
          author: decision.closedBy,
          agentId: decision.closedByAgentId,
          agentNames,
        });
  if (decision.status === 'withdrawn' || decision.replacedBy === null) {
    return { author, verb: 'withdrawn', target: null, closer };
  }
  return {
    author,
    verb: decision.replacedBy > decision.number ? 'replaced by' : 'merged into',
    target: decision.replacedBy,
    closer,
  };
};

type BaselineParams = {
  readonly iso: string | null;
  readonly baseline: string | null | undefined;
};

export const isAfterBaseline = ({ iso, baseline }: BaselineParams): boolean =>
  iso !== null && typeof baseline === 'string' && iso > baseline;
