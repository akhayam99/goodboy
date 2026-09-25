import { PANE_RHYTHM, cn } from '@goodboy/ui';
import { ChatImageLoaderProvider } from '../../../../../features/chat/components/ChatView/ChatImageLoaderProvider';
import { TranscriptRows } from '../../../../../features/chat/components/ChatView/TranscriptRows';
import {
  CHAT_AGENT_RESOLVER_ID,
  CHAT_MOUNTS,
  CHAT_SESSION_ID,
  TRANSCRIPT_ROWS,
  noop,
} from './fixtures';

export const TranscriptFeed = () => (
  <ul
    className={cn('flex flex-col gap-2.5', PANE_RHYTHM.column)}
    aria-live="polite"
    aria-relevant="additions"
  >
    <ChatImageLoaderProvider sessionId={CHAT_SESSION_ID}>
      <TranscriptRows
        rows={TRANSCRIPT_ROWS}
        oqByTurnOrdinal={new Map()}
        sessionId={CHAT_SESSION_ID}
        selectedAgentId={CHAT_AGENT_RESOLVER_ID}
        workingDir={CHAT_MOUNTS[0]?.worktreePath ?? null}
        onRefreshAuth={noop}
        onOpenDiff={noop}
        isThinking={false}
        thinkingContext="think"
        onRetryRun={noop}
        retryingRunId={null}
      />
    </ChatImageLoaderProvider>
  </ul>
);
