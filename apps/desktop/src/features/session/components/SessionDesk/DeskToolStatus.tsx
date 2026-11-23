import { Button, EmptyState, Skeleton } from '@goodboy/ui';
import { SquareTerminal } from '@goodboy/ui/icons';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { NAMES } from '../../../../shared/utils/names';
import { actionButtonLookOf } from '../../../actions/actionButtonLookOf';
import { startDeskTool } from './startDeskTool';

type Props = {
  readonly sessionId: SessionId;
};

const RETRY_LOOK = actionButtonLookOf({ verb: NAMES.retry, variant: 'secondary' });

export const DeskToolStatus = ({ sessionId }: Props) => {
  const start = useAppStore((state) => state.deskToolStart[sessionId]);
  const hasTool = useAppStore((state) => state.drawerGrid.columns.length > 0);
  if (start === undefined || hasTool) {
    return null;
  }
  if (start.phase === 'preparing') {
    return (
      <div
        role="status"
        aria-label="Opening the terminal"
        aria-busy
        className="flex min-h-0 min-w-0 flex-1 flex-col"
      >
        <Skeleton className="min-h-24 w-full flex-1" />
      </div>
    );
  }
  return (
    <div role="alert" className="flex min-w-0 flex-1 flex-col">
      <EmptyState
        icon={SquareTerminal}
        title="Couldn't open the terminal"
        description={start.message}
        action={
          <Button
            size="sm"
            variant={RETRY_LOOK.variant}
            intent={RETRY_LOOK.intent}
            onClick={() => void startDeskTool({ sessionId, mountId: null })}
          >
            {NAMES.retry}
          </Button>
        }
      />
    </div>
  );
};
