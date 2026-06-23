import { Divider } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { SessionDetailPanel } from '../../../../workspace/components/SessionDetailPanel';

type SessionTopBarProps = {
  readonly session: Session;
};

export const SessionTopBar = ({ session }: SessionTopBarProps) => {
  return (
    <>
      <div className="flex w-full items-center gap-3 bg-background pr-3">
        <div className="min-w-0 flex-1">
          <SessionDetailPanel
            session={session}
            onOpenSessionSettings={() =>
              window.dispatchEvent(new CustomEvent('goodboy:open-session-settings'))
            }
          />
        </div>
      </div>
      <Divider />
    </>
  );
};
