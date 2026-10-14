import { useState } from 'react';
import { formatError } from '@goodboy/ui';
import type { ResolveCommitStyle, ResolveLaunchMode, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { captureStartHint } from '../../../../../store/slices/startHints/captureStartHint';
import { sessionResolveStyle } from '../../../../../store/sessionReplySettings';
import { isReportedError } from '../../../../../store/slices/notifications/reportedError';
import type { AgentKindRouting } from '../../../../session/agent-kind';
import { launchChoiceOf } from '../../../launchChoice';
import { parentResolverOf } from '../../../parentResolverOf';
import { startBatch } from '../../../startBatch';
import { useFixStartedToast } from '../../../hooks/useFixStartedToast';
import { fixCommentsAgentName } from '../fixCommentsCopy';

type Params = {
  readonly sessionId: SessionId;
  readonly routing: AgentKindRouting;
  readonly threadIds: ReadonlyArray<string>;
  readonly hint: string;
  readonly hintScope?: string;
  readonly onStarted: () => void;
};

type FixLaunch = {
  readonly isStarting: boolean;
  readonly startedMode: ResolveLaunchMode | null;
  readonly error: string | null;
  readonly start: (mode: ResolveLaunchMode) => Promise<void>;
};

const storedCommitStyle = ({
  sessionId,
}: {
  readonly sessionId: SessionId;
}): ResolveCommitStyle => {
  const state = useAppStore.getState();
  const last = state.sessionResolveBatches[sessionId]?.at(-1)?.launchChoice.commitStyle ?? null;
  return last ?? sessionResolveStyle({ state, sessionId }).commitStyle;
};

export const useFixLaunch = ({
  sessionId,
  routing,
  threadIds,
  hint,
  hintScope,
  onStarted,
}: Params): FixLaunch => {
  const announceStart = useFixStartedToast();
  const [startedMode, setStartedMode] = useState<ResolveLaunchMode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const count = threadIds.length;

  const start = async (mode: ResolveLaunchMode): Promise<void> => {
    if (startedMode !== null || count === 0) {
      return;
    }
    const state = useAppStore.getState();
    const capture =
      hintScope === undefined ? null : captureStartHint({ state, sessionId, scope: hintScope });
    setStartedMode(mode);
    setError(null);
    try {
      const parentAgentId = parentResolverOf({
        attempts: state.sessionResolveAttempts[sessionId] ?? [],
        agents: state.sessionPhaseRuns[sessionId] ?? [],
        threadIds,
      });
      const started = await startBatch({
        getState: useAppStore.getState,
        sessionId,
        threadIds,
        name: fixCommentsAgentName({ count }),
        ...(parentAgentId !== undefined && { parentAgentId }),
        launchChoice: launchChoiceOf({
          routing,
          commitStyle: storedCommitStyle({ sessionId }),
          hint: capture === null ? hint : capture.text,
          mode,
        }),
      });
      if (capture !== null) {
        state.settleStartHint({ capture });
      }
      announceStart({ sessionId, started, count });
      onStarted();
    } catch (caught) {
      if (!isReportedError(caught)) {
        setError(formatError(caught));
      }
    } finally {
      setStartedMode(null);
    }
  };

  return { isStarting: startedMode !== null, startedMode, error, start };
};
