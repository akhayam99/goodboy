import { Button, EmptyState, PAGE_MEASURE, PageColumn } from '@goodboy/ui';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import type { TerminalStudioModel } from '../../hooks/useTerminalStudioModel';
import { displayCwd } from '../../terminalTargets';
import { ChangeFolderPicker } from './ChangeFolderPicker';
import { DockTerminalButton } from './DockTerminalButton';
import { TerminalPane } from './TerminalPane';
import { TerminalStripActions } from './TerminalStripActions';
import { TerminalTabStrip } from './TerminalTabStrip';
import { TerminalToolbar } from './TerminalToolbar';

const NO_PORTS: ReadonlyArray<number> = [];

type Props = {
  readonly model: TerminalStudioModel;
  readonly isActive: boolean;
  readonly portsByTerminal: ReadonlyMap<string, ReadonlyArray<number>>;
};

export const TerminalDetail = ({ model, isActive, portsByTerminal }: Props) => {
  const { selected, worktree } = model;
  if (selected === null || worktree === null) {
    return (
      <div className="flex h-full min-h-0 flex-1 flex-col">
        <div data-grid-row="1" className="flex h-10 shrink-0 items-center justify-end px-3">
          <DockTerminalButton selected={null} />
        </div>
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
      </div>
    );
  }
  const isIdle = selected.status !== 'exited' && !model.busyIds.has(selected.id);
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <h2 className="sr-only">{`Terminal on ${worktree.projectName}`}</h2>
      <TerminalToolbar
        cwd={
          worktree.kind === 'mount'
            ? null
            : displayCwd({ cwd: selected.cwd, folder: model.folder, home: model.home })
        }
        ports={portsByTerminal.get(selected.id) ?? NO_PORTS}
        sessionId={worktree.sessionId}
        folderAction={
          <ChangeFolderPicker
            targets={model.targets}
            isIdle={isIdle}
            onChangeDirectory={model.changeDirectory}
          />
        }
        actions={
          <>
            <DockTerminalButton selected={selected} />
            <TerminalStripActions
              worktree={worktree}
              tab={selected}
              handoffSessionId={worktree.sessionId}
            />
          </>
        }
      />
      <div data-grid-row="2" className="shrink-0">
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
          hasPorts={false}
          sessionId={worktree.sessionId}
        />
      </div>
      <div data-terminal-body="" data-grid-row="3" className="flex min-h-0 flex-1 flex-col px-3">
        <TerminalPane
          key={selected.id}
          tab={selected}
          isActive={isActive}
          sessionId={worktree.sessionId}
          projectName={worktree.projectName}
          branch={worktree.branch}
        />
      </div>
    </div>
  );
};
