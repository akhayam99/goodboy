import { useCallback } from 'react';
import type { AgentId, OpenQuestionId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { openQuestion } from '../../../session/openQuestion';

type Params = {
  readonly sessionId: SessionId;
};

type OpenParams = {
  readonly question: {
    readonly id: OpenQuestionId;
    readonly createdByAgentId?: AgentId | null;
  };
};

export const useOpenAgentQuestion = ({ sessionId }: Params) =>
  useCallback(
    ({ question }: OpenParams) =>
      openQuestion({ state: useAppStore.getState(), sessionId, questionId: question.id }),
    [sessionId],
  );
