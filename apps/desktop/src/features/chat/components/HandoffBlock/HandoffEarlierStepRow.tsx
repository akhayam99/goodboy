import type { HandoffRef, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';

type Props = {
  readonly entry: Extract<HandoffRef, { kind: 'agent' }>;
  readonly sessionId: SessionId | null;
};

export const HandoffEarlierStepRow = ({ entry, sessionId }: Props) => {
  const selectAgent = useAppStore((state) => state.selectAgent);
  return (
    <button
      type="button"
      disabled={sessionId === null}
      onClick={() => {
        if (sessionId === null) {
          return;
        }
        void selectAgent(sessionId, entry.agentId);
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
