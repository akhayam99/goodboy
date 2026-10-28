import type { MountId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import type { PushContinuation } from '../../../store/slices/history/types';
import { usePushFix } from '../../hooks/usePushFix';
import { PushFixStatusLine } from '../PushFixStatusLine';

type Props = {
  readonly sessionId: SessionId;
  readonly mountId: MountId;
  readonly onSettled?: PushContinuation['resume'];
};

export const PushFixStatus = ({ sessionId, mountId, onSettled }: Props) => {
  const state = usePushFix({ sessionId, mountId, ...(onSettled !== undefined && { onSettled }) });
  if (state.kind === 'none') {
    return null;
  }
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2 rounded-lg bg-subtle px-4 py-2 text-meta">
      <PushFixStatusLine
        sessionId={sessionId}
        state={state}
        onDismiss={() => useAppStore.getState().dismissPushFixOutcome({ mountId })}
      />
    </div>
  );
};
