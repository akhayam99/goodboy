import { PanelLeftClose, Pin } from 'lucide-react';
import { IconButton, cn } from '@goodboy/ui';
import { PANE_RHYTHM } from '../../../../../shared/components/paneRhythm';
import { WorkspaceIdentityRow } from '../../../../workspace/components/WorkspaceIdentityRow';
import { shortcutGlyphs } from '../../../../../shared/keyboard/registry';

type Props = {
  readonly onCollapse: () => void;
  readonly action?: 'collapse' | 'pin';
};

export const SidebarHeader = ({ onCollapse, action = 'collapse' }: Props) => {
  const label =
    action === 'pin'
      ? `Pin session sidebar (${shortcutGlyphs('column.toggle')})`
      : `Hide session sidebar (${shortcutGlyphs('column.toggle')})`;
  return (
    <div className={cn('flex items-center gap-1', PANE_RHYTHM.navRail.row)}>
      <div className="min-w-0 flex-1">
        {action === 'collapse' ? <WorkspaceIdentityRow /> : null}
      </div>
      <IconButton
        icon={action === 'pin' ? Pin : PanelLeftClose}
        label={label}
        onClick={onCollapse}
        className="shrink-0 border-transparent"
      />
    </div>
  );
};
