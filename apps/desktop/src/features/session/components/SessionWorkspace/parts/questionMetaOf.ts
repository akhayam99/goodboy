import type { Agent, AgentId } from '@goodboy/types';
import { formatAge } from '../../../../../shared/utils/time/formatAge';
import { classifyAgent, type AgentKind } from '../../../agent-kind';
import type { QuestionRow } from './questionsLensModel';

type Params = {
  readonly row: QuestionRow;
  readonly agents: ReadonlyArray<Agent>;
  readonly kindOverrides: Readonly<Record<AgentId, AgentKind>>;
  readonly now: number;
};

type QuestionMeta = {
  readonly askerKind: AgentKind | null;
  readonly age: string;
};

export const questionMetaOf = ({ row, agents, kindOverrides, now }: Params): QuestionMeta => {
  const { question } = row;
  const askerId = question.createdByAgentId ?? null;
  const asker = askerId === null ? null : (agents.find((agent) => agent.id === askerId) ?? null);
  const askedOrAnsweredAt =
    row.kind === 'answered' ? (question.answeredAt ?? question.createdAt) : question.createdAt;
  return {
    askerKind:
      asker === null
        ? null
        : classifyAgent({ agent: asker, override: kindOverrides[asker.id] ?? null }),
    age: formatAge({ from: askedOrAnsweredAt, now }),
  };
};
