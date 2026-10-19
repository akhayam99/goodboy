import { DrawerFrame, EmptyState } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { sessionById } from '../../../../store/slices/sessions/sessionIndex';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { LogPane } from './LogPane';

type Props = {
  readonly sessionId: SessionId;
  readonly focusEntryId: string | null;
  readonly onClose: () => void;
};

export const LogDrawer = ({ sessionId, focusEntryId, onClose }: Props) => {
  const session = useAppStore((state) => sessionById(state.sessions, sessionId) ?? null);
  return (
    <DrawerFrame title="Log" icon={CONCEPT_ICONS.timeline} onClose={onClose}>
      {session === null ? (
        <EmptyState
          size="section"
          icon={CONCEPT_ICONS.timeline}
          title="This session is no longer here"
          description="Pick another session to see its log."
        />
      ) : (
        <LogPane session={session} focusEntryId={focusEntryId} />
      )}
    </DrawerFrame>
  );
};
