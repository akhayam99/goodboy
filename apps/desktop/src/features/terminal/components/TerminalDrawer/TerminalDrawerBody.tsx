import { useEffect } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { DrawerFrame, IconButton } from '@goodboy/ui';
import type { SessionId, WorkspaceId } from '@goodboy/types';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { useTerminalStudioModel } from '../../hooks/useTerminalStudioModel';
import { openTerminalOnPage } from '../../openTerminalOnPage';
import { TerminalPane } from '../TerminalStudio/TerminalPane';
import { TerminalTabStrip } from '../TerminalStudio/TerminalTabStrip';
import { WorktreeChip } from '../WorktreeChip';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly sessionId: SessionId;
  readonly worktreeKey: string;
  readonly onClose: () => void;
};

const keepSelection = (): void => undefined;

export const TerminalDrawerBody = ({ workspaceId, sessionId, worktreeKey, onClose }: Props) => {
  const model = useTerminalStudioModel({
    workspaceId,
    selectedId: null,
    selectedWorktreeKey: worktreeKey,
    focusSessionId: sessionId,
    scope: 'session',
    onSelect: keepSelection,
  });
  const { worktree, selected } = model;
  const isGone = worktree === null || worktree.key !== worktreeKey || selected === null;

  useEffect(() => {
    if (isGone) {
      onClose();
    }
  }, [isGone, onClose]);

  if (isGone) {
    return null;
  }
  return (
    <DrawerFrame
      title={worktree.projectName}
      icon={CONCEPT_ICONS.terminal}
      iconClassName="text-faint-foreground"
      count={worktree.folder === null ? null : <WorktreeChip folder={worktree.folder} />}
      action={
        <IconButton
          icon={ArrowUpRight}
          label="Open on Terminal page"
          tooltip="Open on Terminal page"
          iconSize={ICON_SIZE.control}
          onClick={() => openTerminalOnPage({ terminalId: selected.id, sessionId })}
        />
      }
      onClose={onClose}
      scroll="self"
    >
      <div className="flex h-full min-h-0 flex-1 flex-col gap-2 py-2">
        <TerminalTabStrip
          label={worktree.projectName}
          tabs={model.tabs}
          selectedId={selected.id}
          busyIds={model.busyIds}
          commandOf={model.commandOf}
          onSelect={model.selectTab}
          onClose={model.closeTab}
          onRestart={model.restartTab}
          onRename={model.renameTab}
          onNew={model.newTab}
        />
        <div className="flex min-h-0 flex-1 flex-col px-2">
          <TerminalPane key={selected.id} tab={selected} isActive />
        </div>
      </div>
    </DrawerFrame>
  );
};
