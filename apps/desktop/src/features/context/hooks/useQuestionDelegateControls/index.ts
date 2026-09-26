import { useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { clampEffortForModel } from '@goodboy/core';
import { useAutoLimitContext } from '../../../providers/hooks/useAutoLimitContext';
import { resolveLimitedTaskModel } from '../../../../store/slices/providerLimits/resolveLimitedTaskModel';
import type { Agent, OpenQuestion, ProviderId, SessionId } from '@goodboy/types';
import { useAppStore, agentPlace } from '../../../../store';
import {
  delegateRowState,
  latestQuestionDelegate,
  type DelegateRowState,
} from '../../questionDelegate';
import {
  PERSON_ANSWERS,
  useOpenQuestions,
  type DelegateRouting,
} from '../../components/QuestionsTab/useOpenQuestions';
import { selectResolvedSettings } from '../../../../store/slices/overrides/selectResolvedSettings';

type Params = {
  readonly sessionId: SessionId;
  readonly question: OpenQuestion;
};

export type QuestionDelegateControls = {
  readonly delegateState: DelegateRowState;
  readonly delegateHints: string;
  readonly delegateRouting: DelegateRouting;
  readonly connectedProviders: ReadonlyArray<ProviderId>;
  readonly onChooseDelegate: () => void;
  readonly onCancelDelegate: () => void;
  readonly onDelegateHints: (hints: string) => void;
  readonly onDelegateRouting: (routing: DelegateRouting) => void;
  readonly onOpenDelegate: (() => void) | null;
  readonly onTakeBackDelegate: () => void;
};

const NO_AGENTS: ReadonlyArray<Agent> = [];

export const useQuestionDelegateControls = ({
  sessionId,
  question,
}: Params): QuestionDelegateControls => {
  const setAnswerIntent = useOpenQuestions((state) => state.setAnswerIntent);
  const navigate = useAppStore((state) => state.navigate);
  const takeQuestionBack = useAppStore((state) => state.takeQuestionBack);
  const intent = useOpenQuestions(
    (state) => state.drafts[question.id]?.answerIntent ?? PERSON_ANSWERS,
  );
  const agents = useAppStore((state) => state.sessionPhaseRuns?.[sessionId] ?? NO_AGENTS);
  const session = useAppStore(
    (state) => state.sessions?.find((candidate) => candidate.id === sessionId) ?? null,
  );
  const workspaceId = session?.workspaceId ?? null;
  const taskModels = useAppStore(
    (state) => selectResolvedSettings({ state, sessionId })?.taskModels ?? null,
  );
  const connectedProviders = useAppStore(
    useShallow((state) =>
      (state.providers ?? [])
        .filter((provider) => provider.connection === 'connected')
        .map(({ id }) => id),
    ),
  );

  const sessionProvider: ProviderId =
    session?.providerPreference.defaultProvider ?? connectedProviders[0] ?? 'anthropic';

  const limitContext = useAutoLimitContext();

  const defaultRouting = useMemo((): DelegateRouting => {
    const resolved = resolveLimitedTaskModel({
      limitContext,
      task: 'question_delegate',
      preferences: taskModels,
      workspaceDefaultProviderId: null,
      sessionDefaultProviderId: sessionProvider,
    });
    const requestedEffort = resolved.effort ?? 'medium';
    return {
      provider: resolved.providerId,
      model: resolved.model,
      effort:
        clampEffortForModel({ model: resolved.model, effort: requestedEffort }) ?? requestedEffort,
    };
  }, [limitContext, sessionProvider, taskModels]);

  const asker =
    question.createdByAgentId == null
      ? null
      : (agents.find((agent) => agent.id === question.createdByAgentId) ?? null);
  const delegate = latestQuestionDelegate({ agents, questionId: question.id });
  const delegateState = delegateRowState({ asker, delegate, isChosen: intent.kind === 'agent' });
  const delegateHints = intent.kind === 'agent' ? intent.hints : '';
  const delegateRouting = intent.kind === 'agent' ? intent.routing : defaultRouting;

  const onChooseDelegate = useCallback(() => {
    setAnswerIntent(question.id, { kind: 'agent', hints: '', routing: defaultRouting });
  }, [defaultRouting, question.id, setAnswerIntent]);

  const onCancelDelegate = useCallback(() => {
    setAnswerIntent(question.id, PERSON_ANSWERS);
  }, [question.id, setAnswerIntent]);

  const onDelegateHints = useCallback(
    (hints: string) => {
      setAnswerIntent(question.id, { kind: 'agent', hints, routing: delegateRouting });
    },
    [delegateRouting, question.id, setAnswerIntent],
  );

  const onDelegateRouting = useCallback(
    (routing: DelegateRouting) => {
      setAnswerIntent(question.id, { kind: 'agent', hints: delegateHints, routing });
    },
    [delegateHints, question.id, setAnswerIntent],
  );

  const delegateId = delegate?.id ?? null;
  const onOpenDelegate = useCallback(() => {
    if (delegateId === null) {
      return;
    }
    navigate({ to: agentPlace({ sessionId, agentId: delegateId }) });
  }, [delegateId, navigate, sessionId]);

  const onTakeBackDelegate = useCallback(() => {
    setAnswerIntent(question.id, PERSON_ANSWERS);
    void takeQuestionBack({ sessionId, questionId: question.id });
  }, [question.id, sessionId, setAnswerIntent, takeQuestionBack]);

  return {
    delegateState,
    delegateHints,
    delegateRouting,
    connectedProviders,
    onChooseDelegate,
    onCancelDelegate,
    onDelegateHints,
    onDelegateRouting,
    onOpenDelegate: delegateId === null ? null : onOpenDelegate,
    onTakeBackDelegate,
  };
};
