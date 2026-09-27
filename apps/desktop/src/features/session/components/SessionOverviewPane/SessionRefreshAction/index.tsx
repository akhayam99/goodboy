import type { SessionId } from '@goodboy/types';
import { IconButton } from '@goodboy/ui';
import { useAppStore } from '../../../../../store';
import { withShortcutHint } from '../../../../../shared/keyboard/registry';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../../shared/components/conceptIcons';
import { useSessionRefresh } from '../../../hooks/useSessionRefresh';

type Props = {
  readonly sessionId: SessionId;
};

export const SessionRefreshAction = ({ sessionId }: Props) => {
  const refresh = useSessionRefresh();
  const isRefreshing = useAppStore((s) => s.sessionSyncing[sessionId] === true);
  const tooltip = withShortcutHint({ label: 'Refresh', shortcut: 'session.refresh' });

  return (
    <IconButton
      variant="ghost"
      icon={CONCEPT_ICONS.refresh}
      iconSize={ICON_SIZE.row}
      label={isRefreshing ? 'Refreshing' : 'Refresh'}
      tooltip={tooltip}
      busy={isRefreshing}
      aria-busy={isRefreshing}
      onClick={() => {
        if (!isRefreshing) {
          void refresh({ sessionId });
        }
      }}
      className="size-6 shrink-0"
    />
  );
};
