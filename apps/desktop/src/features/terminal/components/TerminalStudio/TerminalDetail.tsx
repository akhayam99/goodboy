import { Button, EmptyState, PAGE_MEASURE, PageColumn } from '@goodboy/ui';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import type { TerminalStudioModel } from '../../hooks/useTerminalStudioModel';
import { displayCwd } from '../../terminalTargets';
import { ChangeFolderPicker } from './ChangeFolderPicker';
import { LocationRow } from './LocationRow';
import { TerminalPane } from './TerminalPane';
import { TerminalStripActions } from './TerminalStripActions';
import { TerminalTabStrip } from './TerminalTabStrip';

type Props = {
  readonly model: TerminalStudioModel;
  readonly isActive: boolean;
};

export const TerminalDetail = ({ model, isActive }: Props) => {
  const { selected, worktree } = model;
  if (selected === null || worktree === null) {
    return (
      <PageColumn width={PAGE_MEASURE.terminal}>
        <EmptyState
          size="page"
          tone={CONCEPT_TONE.terminal}
          icon={CONCEPT_ICONS.terminal}
          title="No terminal yet"
          description="Open a terminal in your workspace folder."
          action={
            <Button size="sm" onClick={model.openDefault}>
              New terminal
            </Button>
          }
        />
      </PageColumn>
    );
  }
  const isIdle = selected.status !== 'exited' && !model.busyIds.has(selected.id);
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-1">
      <h2 className="sr-only">{`Terminal on ${worktree.projectName}`}</h2>
      {worktree.kind === 'mount' ? null : (
        <LocationRow
          cwd={displayCwd({ cwd: selected.cwd, folder: model.folder, home: model.home })}
        />
      )}
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
        onNew={model.openDefault}
        isShortcutEnabled={isActive}
        folderAction={
          <ChangeFolderPicker
            targets={model.targets}
            isIdle={isIdle}
            onChangeDirectory={model.changeDirectory}
          />
        }
        actions={<TerminalStripActions worktree={worktree} />}
      />
      <div data-terminal-body="" className="flex min-h-0 flex-1 flex-col px-3">
        <TerminalPane key={selected.id} tab={selected} isActive={isActive} />
      </div>
    </div>
  );
};
