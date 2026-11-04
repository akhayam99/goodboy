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
  readonly rowId: string;
};

type ActParams = {
  readonly action: PendingMessageAction;
};

export const AutoPendingMessages = ({ sessionId, view, rowId }: Props) => {
  const actions = useAutoTreeActions({ sessionId });
  const line = pendingMessageLineOf({ view });
  if (line === null || view.pendingMessages.every((message) => message.rowId !== rowId)) {
    return null;
  }
  const act = ({ action }: ActParams) => {
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
      <AutoPendingMessageLine line={line} onAction={(action) => act({ action })} />
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
