import { Settings } from 'lucide-react';
import { Button } from '@goodboy/ui';
import type { WorkspaceId } from '@goodboy/types';
import { useAppStore, useWorkspaces } from '../../../../store';
import { DEFAULT_AFTER_MERGE_RULE } from '../../../../store/slices/branch-cleanup';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { AFTER_MERGE_SHORT_LABEL } from '../../../settings/components/SettingsStudio/afterMergeCopy';
import { openSettings } from '../../../settings/openSettings';

type Props = {
  readonly workspaceId: WorkspaceId;
};

export const AfterMergeRuleLine = ({ workspaceId }: Props) => {
  const rule = useAppStore(
    (state) => state.workspaceOverrides[workspaceId]?.afterMerge ?? DEFAULT_AFTER_MERGE_RULE,
  );
  const name = useWorkspaces().find((workspace) => workspace.id === workspaceId)?.name ?? null;
  if (name === null) {
    return null;
  }
  return (
    <div className="flex min-h-10 items-center gap-3 px-2 text-body">
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-foreground">After a merge</span>
        <span className="text-secondary text-faint-foreground">
          What {name} does with a branch once its pull request merges.
        </span>
      </div>
      <span className="text-secondary text-muted-foreground">{AFTER_MERGE_SHORT_LABEL[rule]}</span>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => openSettings({ scope: 'workspace', section: 'general' })}
      >
        <Settings size={ICON_SIZE.row} aria-hidden />
        Change
      </Button>
    </div>
  );
};
