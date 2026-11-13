import { useActionRun, useAppStore } from '../../../../store';
import { ActionRunLine } from '../../../../shared/components/ActionRunLine';
import type { BrowserPageSend } from '../../types';

type Props = {
  readonly pageSend: BrowserPageSend;
};

const FAILURE_TITLE = "Couldn't send the page";

export const BrowserSendLine = ({ pageSend }: Props) => {
  const run = useActionRun({ key: pageSend.runKey });
  if (run === null) {
    return null;
  }
  return (
    <div className="px-4">
      <ActionRunLine
        run={run}
        failureTitle={FAILURE_TITLE}
        onRetry={pageSend.retry}
        onDismiss={() => useAppStore.getState().dismissActionRun({ key: pageSend.runKey })}
      />
    </div>
  );
};
