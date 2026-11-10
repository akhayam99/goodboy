import { CHECK_STATE } from '../../../../store/slices/notifications/errorRecovery';
import { useEffect, useMemo, type KeyboardEvent } from 'react';
import { DrawerFrame } from '@goodboy/ui';
import type { SessionId, WorkspaceId } from '@goodboy/types';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { eventMatches } from '../../../../shared/keyboard/dispatcher';
import { SHORTCUTS } from '../../../../shared/keyboard/registry';
import { useShortcut } from '../../../../shared/keyboard/useShortcut';
import { isBranchlessSession } from '../../../../shared/utils/isBranchlessSession';
import { useAppStore } from '../../../../store';
import { workspaceTerminalOwner } from '../../../../store/slices/terminal/terminalOwner';
import { useTerminalStudioModel } from '../../hooks/useTerminalStudioModel';
import { openSessionFolderTerminal } from '../../openSessionFolderTerminal';
import { openSessionTerminal } from '../../openSessionTerminal';
import { openTerminalOnPage } from '../../openTerminalOnPage';
import { openWorkspaceTerminalAt } from '../../openWorkspaceTerminalAt';
import { TERMINAL_PICKER_EVENTS } from '../../terminalPickerEvents';
import type { TerminalTarget } from '../../terminalTargets';
import { allWorktrees } from '../../terminalWorktrees';
import { TerminalPane } from '../TerminalStudio/TerminalPane';
import { TerminalStripActions } from '../TerminalStudio/TerminalStripActions';
import { TerminalTabStrip } from '../TerminalStudio/TerminalTabStrip';
import { TerminalScopePicker } from './TerminalScopePicker';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly sessionId: SessionId | null;
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
  const isBranchless = useAppStore(
    (state) =>
      sessionId !== null && isBranchlessSession({ branch: state.sessionBranches[sessionId] }),
  );
  const reportError = useAppStore((state) => state.reportError);
  const { worktree, selected, groups, busyIds, targets } = model;
  const busyPaths = useMemo(
    () =>
      new Set(
        allWorktrees({ groups }).flatMap((candidate) =>
          candidate.path !== null && candidate.tabs.some((tab) => busyIds.has(tab.id))
            ? [candidate.path]
            : [],
        ),
      ),
    [groups, busyIds],
  );
  const isGone = worktree === null || worktree.key !== worktreeKey || selected === null;
  const hasPicker = targets.length > 1;

  useShortcut(
    'terminal.newHere',
    () => {
      if (hasPicker) {
        window.dispatchEvent(new CustomEvent(TERMINAL_PICKER_EVENTS.drawer));
        return;
      }
      model.newTab();
    },
    !isGone,
  );

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (!eventMatches({ event: event.nativeEvent, entry: SHORTCUTS['terminal.newTab'] })) {
      return;
    }
    event.preventDefault();
    model.newTab();
  };

  useEffect(() => {
    if (isGone) {
      onClose();
    }
  }, [isGone, onClose]);

  if (isGone) {
    return null;
  }

  const pickTarget = (target: TerminalTarget) => {
    const state = useAppStore.getState();
    const owner = sessionId ?? (target.kind === 'session' ? target.sessionId : null);
    if (owner === null) {
      openWorkspaceTerminalAt({ state, workspaceId, cwd: target.path, isFresh: false });
      return;
    }
    openSessionTerminal({
      state,
      sessionId: owner,
      cwd: target.path,
      ...(target.kind === 'workspace' && { owner: workspaceTerminalOwner({ workspaceId }) }),
    });
  };

  const pickSessionFolder = () => {
    if (sessionId === null) {
      return;
    }
    void openSessionFolderTerminal({ sessionId }).catch((error: unknown) =>
      reportError({ recovery: CHECK_STATE, title: "Couldn't open the terminal", error, sessionId }),
    );
  };

  return (
    <DrawerFrame
      title="Terminal"
      icon={CONCEPT_ICONS.terminal}
      iconClassName="text-faint-foreground"
      titleContent={
        <span className="flex w-full min-w-0 items-center overflow-hidden">
          <TerminalScopePicker
            worktree={worktree}
            targets={targets}
            isBranchless={isBranchless}
            busyPaths={busyPaths}
            onPickTarget={pickTarget}
            onPickSessionFolder={pickSessionFolder}
          />
        </span>
      }
      page={{
        label: 'Open as page',
        onOpen: () => openTerminalOnPage({ terminalId: selected.id, sessionId }),
      }}
      onClose={onClose}
      scroll="self"
    >
      <div onKeyDown={handleKeyDown} className="flex h-full min-h-0 flex-1 flex-col gap-2 py-2">
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
          onCloseLastIdle={onClose}
          sessionId={sessionId}
          actions={
            <TerminalStripActions
              worktree={worktree}
              tab={selected}
              handoffSessionId={sessionId}
              canOpenSession={false}
            />
          }
        />
        <div className="flex min-h-0 flex-1 flex-col px-2">
          <TerminalPane
            key={selected.id}
            tab={selected}
            isActive
            sessionId={sessionId}
            projectName={worktree.projectName}
            branch={worktree.branch}
          />
        </div>
      </div>
    </DrawerFrame>
  );
};
