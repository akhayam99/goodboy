import { ScrollFade, UnderTrailContext } from '@goodboy/ui';
import { ActivityPage } from '../../../../../features/session/central/log/ActivityPage';
import { SessionOverviewPane } from '../../../../../features/session/components/SessionOverviewPane';
import { useAppStore } from '../../../../../store';
import { sessionById } from '../../../../../store/slices/sessions/sessionIndex';
import { SessionHead } from '../../../SessionHead';
import { COLUMN_SESSION_ID } from './centralColumnSeed';

type Props = {
  readonly isLogOpen?: boolean;
};

export const CentralColumnPane = ({ isLogOpen = false }: Props) => {
  const session = useAppStore((state) => sessionById(state.sessions, COLUMN_SESSION_ID) ?? null);
  if (session === null) {
    return null;
  }
  return (
    <div className="flex h-full flex-col gap-2 overflow-hidden bg-background text-foreground">
      <SessionHead session={session} />
      <UnderTrailContext.Provider value>
        <ScrollFade className="min-h-0 flex-1">
          {isLogOpen ? (
            <ActivityPage session={session} />
          ) : (
            <SessionOverviewPane session={session} />
          )}
        </ScrollFade>
      </UnderTrailContext.Provider>
    </div>
  );
};
