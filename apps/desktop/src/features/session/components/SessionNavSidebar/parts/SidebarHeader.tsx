import { PanelLeftClose } from 'lucide-react';
import { IconButton, cn } from '@goodboy/ui';
import { PANE_RHYTHM } from '../../../../../shared/components/paneRhythm';
import { WorkspaceIdentityRow } from '../../../../workspace/components/WorkspaceIdentityRow';
import { shortcutGlyphs } from '../../../../../shared/keyboard/registry';

type Props = {
  readonly onCollapse: () => void;
};

export const SidebarHeader = ({ onCollapse }: Props) => {
  const collapseLabel = `Hide session sidebar (${shortcutGlyphs('column.toggle')})`;
  return (
    <div className={cn('flex items-center gap-1', PANE_RHYTHM.navRail.row)}>
      <div className="min-w-0 flex-1">
        <WorkspaceIdentityRow />
      </div>
      <IconButton
        icon={PanelLeftClose}
        label={collapseLabel}
        onClick={onCollapse}
        className="shrink-0 border-transparent"
      />
    </div>
  );
};
