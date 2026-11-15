import { useCallback, useRef, useState } from 'react';
import { formatError } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { isReportedError } from '../../../../../store/slices/notifications/reportedError';
import { AUTO_STARTING_SENTENCE } from '../../../autoStartingSentence';
import { CONFIRM_REFUSED_REASON } from '../../../CONFIRM_REFUSED_REASON';
import { currentAskAnswerPort, type AskAnswer } from '../../../askAnswerPort';

type Params = {
  readonly sessionId: SessionId;
};

type AnswerParams = {
  readonly askId: string;
  readonly answer: AskAnswer;
};

type AskFailure = Readonly<{
  askId: string;
  message: string;
}>;

export type AnswerAskModel = Readonly<{
  busyId: string | null;
  failure: AskFailure | null;
  answer: (params: AnswerParams) => Promise<void>;
}>;

export const useAnswerAsk = ({ sessionId }: Params): AnswerAskModel => {
  const loadAutoTrees = useAppStore((state) => state.loadAutoTrees);
  const answeredRef = useRef<ReadonlySet<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [failure, setFailure] = useState<AskFailure | null>(null);

  const forget = useCallback(({ askId }: Pick<AnswerParams, 'askId'>): void => {
    answeredRef.current = new Set([...answeredRef.current].filter((id) => id !== askId));
  }, []);

  const answer = useCallback(
    async ({ askId, answer: choice }: AnswerParams): Promise<void> => {
      if (answeredRef.current.has(askId)) {
        return;
      }
      answeredRef.current = new Set([...answeredRef.current, askId]);
      setBusyId(askId);
      setFailure(null);
      try {
        const port = currentAskAnswerPort();
        if (port === null) {
          throw new Error(AUTO_STARTING_SENTENCE);
        }
        const result = await port({ askId, answer: choice });
        if (result === 'refused') {
          throw new Error(CONFIRM_REFUSED_REASON);
        }
        await loadAutoTrees({ sessionId });
      } catch (cause) {
        forget({ askId });
        if (!isReportedError(cause)) {
          setFailure({ askId, message: formatError(cause) });
        }
      } finally {
        setBusyId((current) => (current === askId ? null : current));
      }
    },
    [forget, loadAutoTrees, sessionId],
  );

  return { busyId, failure, answer };
};
