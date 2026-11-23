import { PaneSwap, UnderTrailContext } from '@goodboy/ui';
import { SessionDesk } from '../../../../../features/session/components/SessionDesk';
import { SessionOverviewPane } from '../../../../../features/session/components/SessionOverviewPane';
import { useAppStore } from '../../../../../store';
import { sessionById } from '../../../../../store/slices/sessions/sessionIndex';
import { SessionHead } from '../../../SessionHead';
import { COLUMN_SESSION_ID } from '../u26/centralColumnSeed';

export const DeskMotionPane = () => {
  const session = useAppStore((state) => sessionById(state.sessions, COLUMN_SESSION_ID) ?? null);
  const face = useAppStore((state) => state.sessionFace[COLUMN_SESSION_ID] ?? 'overview');
  if (session === null) {
    return null;
  }
  return (
    <div className="flex h-full flex-col gap-2 overflow-hidden bg-background text-foreground">
      <SessionHead session={session} />
      <UnderTrailContext.Provider value>
        <div className="relative flex min-h-0 flex-1 flex-col">
          <PaneSwap
            activeKey={face}
            motion="face"
            layers={[
              { key: 'overview', content: <SessionOverviewPane session={session} /> },
              { key: 'desk', content: <SessionDesk session={session} /> },
            ]}
          />
        </div>
      </UnderTrailContext.Provider>
    </div>
  );
};
