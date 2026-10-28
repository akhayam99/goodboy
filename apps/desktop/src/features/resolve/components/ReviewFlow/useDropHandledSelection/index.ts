import { useEffect, useRef } from 'react';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';

type Params = {
  readonly sessionId: SessionId;
  readonly presentIds: ReadonlySet<string>;
  readonly fixableIds: ReadonlySet<string>;
  readonly acceptableIds: ReadonlySet<string>;
};

type HandledParams = {
  readonly threadId: string;
  readonly current: Omit<Params, 'sessionId'>;
};

const isHandled = ({ threadId, current }: HandledParams): boolean =>
  current.presentIds.has(threadId) &&
  !current.fixableIds.has(threadId) &&
  !current.acceptableIds.has(threadId);

export const useDropHandledSelection = ({
  sessionId,
  presentIds,
  fixableIds,
  acceptableIds,
}: Params): void => {
  const latest = useRef({ presentIds, fixableIds, acceptableIds });
  latest.current = { presentIds, fixableIds, acceptableIds };
  useEffect(
    () => () => {
      const state = useAppStore.getState();
      const stored = state.reviewSelection[sessionId] ?? [];
      const current = latest.current;
      if (!stored.some((threadId) => isHandled({ threadId, current }))) {
        return;
      }
      state.setReviewSelection({
        sessionId,
        threadIds: stored.filter((threadId) => !isHandled({ threadId, current })),
      });
    },
    [sessionId],
  );
};
