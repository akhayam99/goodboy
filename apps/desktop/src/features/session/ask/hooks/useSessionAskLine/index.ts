import { useCallback, useMemo, useRef, useState } from 'react';
import { formatError } from '@goodboy/ui';
import type { AgentId, ChatMessage, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import type { AppStore } from '../../../../../store/store';
import { createLatestOnly } from '../../../../../store/runtime/state-writes/latestOnly';
import { sumSessionCost } from '../../../../../store/slices/sessions/sumSessionCost';
import { NAMES } from '../../../../../shared/utils/names';
import type {
  AskLineAnswerView,
  AskLineMessageView,
  AskLineQuestionParams,
  AskLineSendParams,
} from '../../../../../shared/components/AskLine/AskLineView';
import { classifyAgent } from '../../../agent-kind';
import { planPartsLeftOf } from '../../../../plans/planPartsLeftOf';
import { askAnswerOriginOf } from '../../askAnswerOriginOf';
import { askLineReplyIdOf, type AskLineReplyId } from '../../askLineReplyIdOf';
import { askLineReplyOf } from '../../askLineReplyOf';
import { askRightNow, askRightNowText } from '../../askRightNow';
import type { AskSessionAnswer } from '../../AskSessionAnswer';
import { askStarterOf, type AskStarter } from '../../askStarterOf';
import { askDigestOf } from '../../collectAskPackInput';
import { doingAnswerOf, type DoingBranch, type DoingRun } from '../../doingAnswerOf';
import { leftAnswerOf } from '../../leftAnswerOf';
import { messageAgentFromAsk } from '../../messageAgentFromAsk';
import { readDoingRuns } from '../../readDoingRuns';
import { useAskActionFacts } from '../useAskActionFacts';

type Params = {
  readonly sessionId: SessionId;
  readonly branches: ReadonlyArray<DoingBranch>;
};

type Asked =
  | Readonly<{
      origin: 'session';
      question: string;
      answer: AskSessionAnswer | null;
      error: string | null;
    }>
  | Readonly<{
      origin: 'model';
      question: string;
      replyId: AskLineReplyId | null;
      error: string | null;
    }>;

export type SessionAskLine = Readonly<{
  starters: ReadonlyArray<string>;
  answer: AskLineAnswerView | null;
  message: AskLineMessageView | null;
  ask: (params: AskLineQuestionParams) => void;
  close: () => void;
  openInAsk: () => void;
}>;

const STARTERS: ReadonlyArray<string> = [NAMES.whatAreYouDoing, NAMES.whatIsLeft];
const NOT_INTERRUPTED = 'The agent was not interrupted.';
const NOT_SENT = 'Ask did not start: an answer is still running, or the session is gone.';
const ASK_KEY = 'ask';

type StateParams = {
  readonly state: AppStore;
  readonly sessionId: SessionId;
};

const leadIdOf = ({ state, sessionId }: StateParams): AgentId | null =>
  (state.sessionPhaseRuns[sessionId] ?? []).find(
    (agent) =>
      agent.deletedAt == null &&
      classifyAgent({ agent, override: state.agentKindOverride[agent.id] ?? null }) === 'auto',
  )?.id ?? null;

const leftOf = ({ state, sessionId }: StateParams): AskSessionAnswer => {
  const plan =
    [...(state.sessionPlans[sessionId] ?? [])]
      .filter((candidate) => candidate.status !== 'superseded' && candidate.status !== 'discarded')
      .sort((first, second) => second.updatedAt.localeCompare(first.updatedAt))[0] ?? null;
  const questions = state.sessionOpenQuestions[sessionId] ?? [];
  return leftAnswerOf({
    plan:
      plan === null
        ? null
        : planPartsLeftOf({
            plan,
            agents: state.sessionPhaseRuns[sessionId] ?? [],
            askingAgentIds: new Set(
              questions.flatMap((question) =>
                question.status === 'open' && question.createdByAgentId != null
                  ? [question.createdByAgentId]
                  : [],
              ),
            ),
          }),
    leadId: leadIdOf({ state, sessionId }),
  });
};

type RightNowParams = StateParams & {
  readonly runs: ReadonlyArray<DoingRun>;
};

const rightNowOf = ({ state, sessionId, runs }: RightNowParams): ReadonlyArray<string> => [
  ...runs.map((run) => `${run.agent}: ${run.phrase}`),
  ...askRightNowText(
    askRightNow({
      ...askDigestOf({ state, sessionId, now: Date.now() }),
      runningAgents: [],
      description: '',
      cost: sumSessionCost(state.sessionTelemetry[sessionId] ?? []),
    }),
  ),
];

type FailParams = {
  readonly error: string;
};

type FreeParams = {
  readonly starter: AskStarter;
};

type ReplyParams = {
  readonly state: AppStore;
  readonly replyId: AskLineReplyId;
};

const replyOf = ({ state, replyId }: ReplyParams): ChatMessage | null =>
  (state.askMessages[replyId.threadId] ?? []).find((message) => message.id === replyId.messageId) ??
  null;

export const useSessionAskLine = ({ sessionId, branches }: Params): SessionAskLine => {
  const [asked, setAsked] = useState<Asked | null>(null);
  const latest = useMemo(() => createLatestOnly(), []);
  const messageIds = useRef(new Map<string, string>());
  const facts = useAskActionFacts({ sessionId });
  const replyId = asked?.origin === 'model' ? asked.replyId : null;
  const reply = useAppStore((state) => (replyId === null ? null : replyOf({ state, replyId })));
  const handles = useAppStore((state) => (reply === null ? undefined : state.askHandles[reply.id]));
  const costUsd = useAppStore((state) =>
    reply === null ? null : (state.askReplyMeta[reply.id]?.costUsd ?? null),
  );

  const answerFree = useCallback(
    async ({ starter }: FreeParams): Promise<AskSessionAnswer> => {
      if (starter === 'left') {
        return leftOf({ state: useAppStore.getState(), sessionId });
      }
      const runs = await readDoingRuns({ sessionId, getState: useAppStore.getState });
      return doingAnswerOf({ runs, branches });
    },
    [branches, sessionId],
  );

  const ask = useCallback(
    ({ question }: AskLineQuestionParams) => {
      const claim = latest.claim({ key: ASK_KEY });
      const starter = askStarterOf({ question });
      if (starter !== null) {
        setAsked({ origin: 'session', question, answer: null, error: null });
        void answerFree({ starter }).then(
          (answer) => {
            if (claim.isCurrent()) {
              setAsked({ origin: 'session', question, answer, error: null });
            }
          },
          (error: unknown) => {
            if (claim.isCurrent()) {
              setAsked({ origin: 'session', question, answer: null, error: formatError(error) });
            }
          },
        );
        return;
      }
      setAsked({ origin: 'model', question, replyId: null, error: null });
      const fail = ({ error }: FailParams) => {
        if (claim.isCurrent()) {
          setAsked({ origin: 'model', question, replyId: null, error });
        }
      };
      void (async () => {
        const runs = await readDoingRuns({ sessionId, getState: useAppStore.getState }).catch(
          (): ReadonlyArray<DoingRun> => [],
        );
        if (!claim.isCurrent()) {
          return;
        }
        let isBound = false;
        const unsubscribe = useAppStore.subscribe((state) => {
          const found = isBound ? null : askLineReplyIdOf({ state, sessionId, question });
          if (found === null) {
            return;
          }
          isBound = true;
          if (claim.isCurrent()) {
            setAsked({ origin: 'model', question, replyId: found, error: null });
          }
        });
        const state = useAppStore.getState();
        const isSent = await state
          .sendAskQuestion({
            sessionId,
            question,
            rightNow: rightNowOf({ state, sessionId, runs }),
          })
          .finally(unsubscribe);
        if (!isSent) {
          fail({ error: NOT_SENT });
        }
      })().catch((error: unknown) => fail({ error: formatError(error) }));
    },
    [answerFree, latest, sessionId],
  );

  const close = useCallback(() => {
    latest.cancel({ key: ASK_KEY });
    setAsked(null);
  }, [latest]);

  const openInAsk = useCallback(() => {
    useAppStore.getState().openAsk({ sessionId });
  }, [sessionId]);

  const answer = useMemo((): AskLineAnswerView | null => {
    if (asked === null) {
      return null;
    }
    if (asked.origin === 'session') {
      return {
        question: asked.question,
        phase: asked.error !== null ? 'failed' : asked.answer === null ? 'thinking' : 'answered',
        text: asked.answer?.text ?? '',
        sources: asked.answer?.sources ?? [],
        origin: askAnswerOriginOf({ origin: 'session', costUsd: null }),
        note: NOT_INTERRUPTED,
        error: asked.error,
      };
    }
    const origin = askAnswerOriginOf({ origin: 'model', costUsd });
    const error = asked.error ?? (reply?.status === 'failed' ? reply.error : null);
    if (error !== null) {
      return {
        question: asked.question,
        phase: 'failed',
        text: '',
        sources: [],
        origin,
        note: NOT_INTERRUPTED,
        error,
      };
    }
    const parsed =
      reply === null ? null : askLineReplyOf({ content: reply.content, handles: handles ?? [] });
    const isStreaming = reply?.status === 'streaming';
    return {
      question: asked.question,
      phase:
        parsed === null || (parsed.text === '' && isStreaming)
          ? 'thinking'
          : isStreaming
            ? 'streaming'
            : 'answered',
      text: parsed?.text ?? '',
      sources: parsed?.sources ?? [],
      origin,
      note: NOT_INTERRUPTED,
      error: null,
    };
  }, [asked, costUsd, handles, reply]);

  const recipientId = useMemo((): AgentId | null => {
    if (asked === null) {
      return null;
    }
    if (asked.origin === 'session') {
      return asked.answer?.agentId ?? null;
    }
    return reply === null
      ? null
      : askLineReplyOf({ content: reply.content, handles: handles ?? [] }).agentId;
  }, [asked, handles, reply]);

  const send = useCallback(
    async ({ text }: AskLineSendParams): Promise<boolean> => {
      if (recipientId === null) {
        return false;
      }
      const messageId = messageIds.current.get(text) ?? crypto.randomUUID();
      messageIds.current.set(text, messageId);
      const isQueued = await messageAgentFromAsk({
        sessionId,
        agentId: recipientId,
        messageId,
        text,
        getState: useAppStore.getState,
      });
      if (isQueued) {
        messageIds.current.delete(text);
      }
      return isQueued;
    },
    [recipientId, sessionId],
  );

  const message = useMemo((): AskLineMessageView | null => {
    const recipient = facts.messageableAgents.find((agent) => agent.id === recipientId);
    if (recipient === undefined || answer?.phase !== 'answered') {
      return null;
    }
    const noun = `the ${recipient.noun}`;
    return { label: `Message ${noun}`, recipient: noun, onSend: send };
  }, [answer?.phase, facts.messageableAgents, recipientId, send]);

  return {
    starters: asked === null ? STARTERS : [],
    answer,
    message,
    ask,
    close,
    openInAsk,
  };
};
