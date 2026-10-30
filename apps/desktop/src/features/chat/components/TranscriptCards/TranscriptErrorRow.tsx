import { Button, Notice } from '@goodboy/ui';
import type { AgentId, ProviderRunId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { selectOpenDrawer } from '../../../../store/slices/drawer/selectOpenDrawer';
import { formatErrorForHumans } from '../../formatErrorForHumans';
import { LimitContinueAction } from './LimitContinueAction';

type Props = {
  readonly message: string;
  readonly runId?: ProviderRunId | null;
  readonly sessionId?: SessionId | null;
  readonly agentId?: AgentId | null;
  readonly failedToolUseId?: string | null;
  readonly onRetry?: () => void;
  readonly isRetrying?: boolean;
};

export const TranscriptErrorRow = ({
  message,
  runId = null,
  sessionId = null,
  agentId = null,
  failedToolUseId = null,
  onRetry,
  isRetrying = false,
}: Props) => {
  const { body, detail } = formatErrorForHumans({ message });
  const hasLimitStop = useAppStore(
    (state) => runId !== null && state.limitStops[runId] !== undefined,
  );
  const openDrawer = useAppStore((state) => state.openDrawer);
  const isTranscriptOpen = useAppStore((state) => {
    const drawer = selectOpenDrawer(state);
    return drawer?.kind === 'transcript' && drawer.payload.agentId === agentId;
  });
  const canViewTranscript = sessionId !== null && agentId !== null && !isTranscriptOpen;

  const viewTranscript = () => {
    if (sessionId === null || agentId === null) {
      return;
    }
    openDrawer({
      kind: 'transcript',
      sessionId,
      payload: { agentId, ...(failedToolUseId !== null && { toolUseId: failedToolUseId }) },
    });
  };

  return (
    <Notice
      tone="danger"
      placement="transcript"
      title={hasLimitStop ? 'The turn stopped' : 'The turn failed'}
      body={body}
      detail={detail}
      iconTestId="transcript-error-icon"
      actions={
        (onRetry !== undefined || hasLimitStop || canViewTranscript) && (
          <>
            {onRetry !== undefined && (
              <Button
                size="sm"
                variant="secondary"
                onClick={onRetry}
                isBusy={isRetrying}
                busyLabel="Retrying"
              >
                Retry
              </Button>
            )}
            {runId !== null && <LimitContinueAction runId={runId} />}
            {canViewTranscript && (
              <Button size="sm" variant="quiet" onClick={viewTranscript}>
                View transcript
              </Button>
            )}
          </>
        )
      }
    />
  );
};
