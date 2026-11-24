import { useContext } from 'react';
import { PaneBannerContext } from '@goodboy/ui';
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
  const banner = useContext(PaneBannerContext);
  useDeskFollowsTools({ sessionId: session.id });
  if (face === 'desk') {
    return <SessionDesk session={session} />;
  }
  const faceBanner =
    line === null ? (
      banner
    ) : (
      <div className="flex min-w-0 flex-col gap-3">
        <DeskLineNotice sessionId={session.id} line={line} />
        {banner}
      </div>
    );
  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col">
      <PaneBannerContext.Provider value={faceBanner}>
        <SessionOverviewPane session={session} />
      </PaneBannerContext.Provider>
    </div>
  );
};
