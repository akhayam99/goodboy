import type { SessionId } from '@goodboy/types';
import type { PendingOpenQuestionDelivery } from './state';
import type { SetFn } from './types';

type RecordParams = {
  readonly set: SetFn;
  readonly sessionId: SessionId;
  readonly pending: PendingOpenQuestionDelivery;
};

export const recordPendingOpenQuestionDelivery = ({
  set,
  sessionId,
  pending,
}: RecordParams): void => {
  set((state) => ({
    pendingOpenQuestionDeliveries: {
      ...state.pendingOpenQuestionDeliveries,
      [sessionId]: pending,
    },
  }));
};

type ClearParams = {
  readonly set: SetFn;
  readonly sessionId: SessionId;
  readonly attemptId: string;
};

export const clearPendingOpenQuestionDelivery = ({
  set,
  sessionId,
  attemptId,
}: ClearParams): void => {
  set((state) => {
    if (state.pendingOpenQuestionDeliveries[sessionId]?.attemptId !== attemptId) {
      return {};
    }
    return {
      pendingOpenQuestionDeliveries: {
        ...state.pendingOpenQuestionDeliveries,
        [sessionId]: undefined,
      },
    };
  });
};

type FailParams = {
  readonly set: SetFn;
  readonly sessionId: SessionId;
  readonly attemptId: string;
  readonly error: string;
};

export const failPendingOpenQuestionDelivery = ({
  set,
  sessionId,
  attemptId,
  error,
}: FailParams): void => {
  set((state) => {
    const pending = state.pendingOpenQuestionDeliveries[sessionId];
    if (pending?.attemptId !== attemptId) {
      return {};
    }
    return {
      pendingOpenQuestionDeliveries: {
        ...state.pendingOpenQuestionDeliveries,
        [sessionId]: { ...pending, error },
      },
    };
  });
};
