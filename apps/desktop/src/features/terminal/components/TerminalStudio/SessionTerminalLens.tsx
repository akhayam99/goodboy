import { useCallback } from 'react';
import { PaneShell } from '@goodboy/ui';
import type { SessionId, WorkspaceId } from '@goodboy/types';
import type { TerminalTabId } from '../../../../shared/types/terminal';
import { useAppStore } from '../../../../store';
import {
  terminalOwnerKey,
  sessionTerminalOwner,
} from '../../../../store/slices/terminal/terminalOwner';
import { useTerminalStudioModel } from '../../hooks/useTerminalStudioModel';
import { NewTerminalMenu } from './NewTerminalMenu';
import { TerminalStudioBody } from './TerminalStudioBody';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly sessionId: SessionId;
  readonly isActive: boolean;
  readonly sessionCwd: string | null;
};

type SelectParams = {
  readonly id: TerminalTabId | null;
  readonly sessionId: SessionId | null;
};

export const SessionTerminalLens = ({ workspaceId, sessionId, isActive, sessionCwd }: Props) => {
  const activeId = useAppStore(
    (s) =>
      s.activeTerminalTab[terminalOwnerKey({ owner: sessionTerminalOwner({ sessionId }) })] ?? null,
  );
  const setActiveTerminalTab = useAppStore((s) => s.setActiveTerminalTab);
  const onSelect = useCallback(
    ({ id }: SelectParams) => {
      if (id !== null) {
        setActiveTerminalTab({ owner: sessionTerminalOwner({ sessionId }), tabId: id });
      }
    },
    [setActiveTerminalTab, sessionId],
  );
  const model = useTerminalStudioModel({
    workspaceId,
    selectedId: activeId,
    focusSessionId: sessionId,
    sessionCwd,
    onSelect,
  });

  return (
    <PaneShell
      title="Terminal"
      scroll="self"
      actions={
        <NewTerminalMenu
          targets={model.targets}
          onNew={model.openDefault}
          onOpenAt={model.openAt}
        />
      }
    >
      <TerminalStudioBody model={model} isActive={isActive} />
    </PaneShell>
  );
};
