import { useMemo } from 'react';
import { Chip, type Tone } from '@goodboy/ui';
import type { Agent, AgentStatus, ResolveAttempt, Session, SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import {
  RESOLVE_WORD_LABEL,
  resolveTallyOf,
  type ResolveWord,
} from '../../../resolve/commentProjection';
import { fixRunThreadIdsOf, fixRunWordOf } from '../../../resolve/fixRun';
import { useReviewEntries } from '../../../resolve/components/ReviewFlow/useReviewEntries';
import { AgentStatusBadge } from '../AgentTree/AgentStatusBadge';

type Props = {
  readonly session: Session;
  readonly agent: Agent;
  readonly status: AgentStatus;
};

const WORD_TONE: Readonly<Record<ResolveWord, Tone>> = {
  open: 'neutral',
  working: 'info',
  needs_you: 'warning',
  ready: 'success',
  couldnt_fix: 'danger',
  done: 'neutral',
};

export const AgentResolverStatus = ({ session, agent, status }: Props) => {
  const sessionId = session.id as SessionId;
  const attempts = useAppStore(
    (state) =>
      state.sessionResolveAttempts?.[sessionId] ?? (EMPTY_ARRAY as ReadonlyArray<ResolveAttempt>),
  );
  const { entries } = useReviewEntries({ sessionId, scope: 'all' });
  const word = useMemo(() => {
    const threadIds = new Set(fixRunThreadIdsOf({ attempts, agentId: agent.id }));
    const own = entries.filter((entry) => threadIds.has(entry.threadId));
    return own.length === 0
      ? null
      : fixRunWordOf({ tally: resolveTallyOf({ states: own.map((entry) => entry.state) }) });
  }, [agent.id, attempts, entries]);
  if (word === null) {
    return <AgentStatusBadge status={status} />;
  }
  return (
    <Chip
      tone={WORD_TONE[word]}
      size="3xs"
      bordered={false}
      label={RESOLVE_WORD_LABEL[word]}
      className="shrink-0"
    />
  );
};
