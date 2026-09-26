import type { HandoffRef, SessionId } from '@goodboy/types';
import { useAppStore, agentPlace } from '../../../../store';

type Props = {
  readonly entry: Extract<HandoffRef, { kind: 'agent' }>;
  readonly sessionId: SessionId | null;
};

export const HandoffEarlierStepRow = ({ entry, sessionId }: Props) => {
  const navigate = useAppStore((state) => state.navigate);
  return (
    <button
      type="button"
      disabled={sessionId === null}
      onClick={() => {
        if (sessionId === null) {
          return;
        }
        navigate({ to: agentPlace({ sessionId, agentId: entry.agentId }) });
      }}
      className="flex min-w-0 items-center gap-2 rounded-md px-2 py-1 text-left text-label transition-colors hover:bg-hover"
    >
      <span className="shrink-0 text-foreground">{entry.label}</span>
      {entry.detail === null ? null : (
        <span className="min-w-0 flex-1 truncate text-muted-foreground">{entry.detail}</span>
      )}
    </button>
  );
};
