import type { WorkspaceId } from '@goodboy/types';
import { Button, ConfirmPopover, ICON_SIZE, cn } from '@goodboy/ui';
import { Trash2 } from '@goodboy/ui/icons';
import { useClearBrowserData } from '../../../hooks/useClearBrowserData';
import { actionIntentOf } from '../../../../actions/actionIntentOf';
import { SettingRow } from '../SettingRow';

const LABEL = 'Clear browser data';
const HELP = 'Cookies, storage and cache of every site in this workspace.';

type Props = {
  readonly workspaceId: WorkspaceId;
};

export const WorkspaceBrowserDataRow = ({ workspaceId }: Props) => {
  const wipe = useClearBrowserData({ workspaceId });
  return (
    <SettingRow label={LABEL} rowKey="clear-browser-data" help={HELP}>
      <span className="flex items-center gap-3">
        {wipe.text === null ? null : (
          <span
            role={wipe.phase === 'failed' ? 'alert' : 'status'}
            className={cn(
              'text-meta',
              wipe.phase === 'failed' ? 'text-danger' : 'text-muted-foreground',
            )}
          >
            {wipe.text}
          </span>
        )}
        <ConfirmPopover
          role="danger"
          icon={<Trash2 size={ICON_SIZE.row} aria-hidden />}
          title="Clear browser data for this workspace?"
          description="Signs you out of every site in this workspace."
          confirmLabel={LABEL}
          isBusy={wipe.phase === 'clearing'}
          isOpen={wipe.phase === 'confirm' || wipe.phase === 'clearing'}
          onConfirm={wipe.clear}
          onCancel={wipe.cancel}
          trigger={() => (
            <Button
              variant="ghost"
              size="sm"
              intent={actionIntentOf({ verb: LABEL })}
              onClick={wipe.ask}
            >
              {LABEL}
            </Button>
          )}
        />
      </span>
    </SettingRow>
  );
};
