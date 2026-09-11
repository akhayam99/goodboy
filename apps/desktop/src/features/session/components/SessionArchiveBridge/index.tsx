import { useCurrentSession } from '../../../../store';
import { useSessionArchive } from '../../../../shared/hooks/useSessionArchive';
import { useShortcut } from '../../../../shared/keyboard/useShortcut';

export const SessionArchiveBridge = () => {
  const session = useCurrentSession();
  const { archive, restore } = useSessionArchive();

  useShortcut('session.archive', () => {
    if (session === null) {
      return;
    }
    const run = session.archivedAt == null ? archive : restore;
    void run({ sessions: [session] });
  });

  return null;
};
