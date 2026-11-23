import type { Session } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { SessionOverviewPane } from '../SessionOverviewPane';
import { DeskLineNotice } from './DeskLineNotice';
import { useDeskFollowsTools } from './useDeskFollowsTools';
import { useDeskOwner } from './useDeskOwner';
import { SessionDesk } from '.';

type Props = {
  readonly session: Session;
};

export const SessionFace = ({ session }: Props) => {
  const face = useAppStore((state) => state.sessionFace[session.id] ?? 'overview');
  const line = useDeskOwner({ sessionId: session.id, isDeskShown: face === 'desk' });
  useDeskFollowsTools({ sessionId: session.id });
  if (face === 'desk') {
    return <SessionDesk session={session} />;
  }
  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col gap-3">
      {line === null ? null : (
        <div className="px-4">
          <DeskLineNotice sessionId={session.id} line={line} />
        </div>
      )}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <SessionOverviewPane session={session} />
      </div>
    </div>
  );
};
