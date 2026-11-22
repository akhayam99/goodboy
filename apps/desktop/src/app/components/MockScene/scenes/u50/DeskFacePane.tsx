import { UnderTrailContext } from '@goodboy/ui';
import { SessionFace } from '../../../../../features/session/components/SessionDesk/SessionFace';
import { useAppStore } from '../../../../../store';
import { sessionById } from '../../../../../store/slices/sessions/sessionIndex';
import { SessionHead } from '../../../SessionHead';
import { COLUMN_SESSION_ID } from '../u26/centralColumnSeed';

export const DeskFacePane = () => {
  const session = useAppStore((state) => sessionById(state.sessions, COLUMN_SESSION_ID) ?? null);
  if (session === null) {
    return null;
  }
  return (
    <div className="flex h-full flex-col gap-2 overflow-hidden bg-background text-foreground">
      <SessionHead session={session} />
      <UnderTrailContext.Provider value>
        <div className="flex min-h-0 flex-1 flex-col">
          <SessionFace session={session} />
        </div>
      </UnderTrailContext.Provider>
    </div>
  );
};
