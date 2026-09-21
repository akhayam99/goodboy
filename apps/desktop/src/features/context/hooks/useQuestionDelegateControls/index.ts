import { useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { resolveTaskModel } from '@goodboy/core';
import type { Agent, OpenQuestion, ProviderId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { clampEffort } from '../../../chat/utils/chat-constants';
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
};

const NO_AGENTS: ReadonlyArray<Agent> = [];

export const useQuestionDelegateControls = ({
  sessionId,
  question,
}: Params): QuestionDelegateControls => {
  const setAnswerIntent = useOpenQuestions((state) => state.setAnswerIntent);
  const intent = useOpenQuestions(
    (state) => state.drafts[question.id]?.answerIntent ?? PERSON_ANSWERS,
  );
  const agents = useAppStore((state) => state.sessionPhaseRuns?.[sessionId] ?? NO_AGENTS);
  const session = useAppStore(
    (state) => state.sessions?.find((candidate) => candidate.id === sessionId) ?? null,
  );
  const workspaceId = session?.workspaceId ?? null;
  const taskModels = useAppStore((state) =>
    workspaceId === null ? null : (state.workspaceOverrides?.[workspaceId]?.taskModels ?? null),
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

  const defaultRouting = useMemo((): DelegateRouting => {
    const resolved = resolveTaskModel({
      task: 'question_delegate',
      preferences: taskModels,
      workspaceDefaultProviderId: null,
      sessionDefaultProviderId: sessionProvider,
    });
    return {
      provider: resolved.providerId,
      model: resolved.model,
      effort: clampEffort(resolved.model, resolved.effort ?? 'medium'),
    };
  }, [sessionProvider, taskModels]);

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

  return {
    delegateState,
    delegateHints,
    delegateRouting,
    connectedProviders,
    onChooseDelegate,
    onCancelDelegate,
    onDelegateHints,
    onDelegateRouting,
  };
};
