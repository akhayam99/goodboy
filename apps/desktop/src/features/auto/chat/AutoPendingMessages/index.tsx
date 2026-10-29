import { Notice } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import type { AutoTreeView } from '../../../../store/slices/auto-view/state';
import { AutoPendingMessageLine } from '../AutoPendingMessageLine';
import { autoLimitOpenEvent } from '../autoLimitOpenEvent';
import { pendingMessageLineOf, type PendingMessageAction } from '../pendingMessageOf';
import { useAutoTreeActions } from '../useAutoTreeActions';

type Props = {
  readonly sessionId: SessionId;
  readonly view: AutoTreeView;
};

type ActParams = {
  readonly action: PendingMessageAction;
  readonly rowId: string;
};

export const AutoPendingMessages = ({ sessionId, view }: Props) => {
  const actions = useAutoTreeActions({ sessionId });
  const line = pendingMessageLineOf({ view });
  if (line === null || view.pendingMessages.length === 0) {
    return null;
  }
  const act = ({ action, rowId }: ActParams) => {
    if (action === 'sendNow') {
      void actions.sendNow({ view, rowId });
      return;
    }
    if (action === 'retry') {
      void actions.retry({ view });
      return;
    }
    window.dispatchEvent(new Event(autoLimitOpenEvent({ treeId: view.tree.id })));
  };
  return (
    <div data-auto-pending-messages="" className="flex flex-col gap-1">
      {view.pendingMessages.map((message) => (
        <AutoPendingMessageLine
          key={message.rowId}
          line={line}
          onAction={(action) => act({ action, rowId: message.rowId })}
        />
      ))}
      {actions.failure === null ? null : (
        <Notice
          tone="danger"
          placement="inline"
          role="alert"
          title={actions.failure.title}
          body={actions.failure.message}
        />
      )}
    </div>
  );
};
