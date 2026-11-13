import { PanelRight } from 'lucide-react';
import { Button, ICON_SIZE } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { demoteBrowserTab } from '../../demoteBrowserTab';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { StudioTrail } from '../../../../shared/components/StudioShell/StudioTrail';
import { useOpenSession } from '../../../../shared/hooks/useOpenSession';
import { useAppStore } from '../../../../store';
import { selectSessionById } from '../../../../store/slices/sessions/selectSessionById';
import { sessionTitle } from '../../../../shared/utils/sessionTitle';

type Props = {
  readonly sessionId: SessionId;
};

export const BrowserPageTrail = ({ sessionId }: Props) => {
  const openSession = useOpenSession();
  const title = useAppStore((state) =>
    sessionTitle({ session: selectSessionById(state, sessionId) }),
  );
  return (
    <StudioTrail
      segments={[
        {
          id: 'session',
          label: title,
          icon: CONCEPT_ICONS.sessions,
          tooltip: `Back to ${title}`,
          onSelect: () => openSession({ sessionId }),
        },
        { id: 'browser', label: 'Browser', icon: CONCEPT_ICONS.browser },
      ]}
      accessory={
        <div className="flex shrink-0 flex-1 items-center justify-end">
          <Button
            variant="ghost"
            size="sm"
            title="Dock beside the session"
            onClick={() => demoteBrowserTab({ sessionId })}
          >
            <PanelRight size={ICON_SIZE.control} aria-hidden />
            Beside the session
          </Button>
        </div>
      }
    />
  );
};
