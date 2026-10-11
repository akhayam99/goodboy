import { useCallback } from 'react';
import type { SessionId, WorkspaceId } from '@goodboy/types';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { StudioShell } from '../../../../shared/components/StudioShell';
import type { TerminalTabId } from '../../../../shared/types/terminal';
import { useAppStore } from '../../../../store';
import { useTerminalStudioModel } from '../../hooks/useTerminalStudioModel';
import { NewTerminalMenu } from './NewTerminalMenu';
import { TerminalStudioBody } from './TerminalStudioBody';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly terminalId: TerminalTabId | null;
  readonly sessionId: SessionId | null;
  readonly onClose: () => void;
};

type SelectParams = {
  readonly id: TerminalTabId | null;
  readonly sessionId: SessionId | null;
};

export const TerminalStudio = ({ workspaceId, terminalId, sessionId, onClose }: Props) => {
  const amendStudio = useAppStore((state) => state.amendStudio);
  const onSelect = useCallback(
    ({ id, sessionId: nextSessionId }: SelectParams) =>
      amendStudio({ studio: { kind: 'terminal', terminalId: id, sessionId: nextSessionId } }),
    [amendStudio],
  );
  const model = useTerminalStudioModel({
    workspaceId,
    selectedId: terminalId,
    focusSessionId: sessionId,
    onSelect,
  });

  return (
    <StudioShell
      icon={CONCEPT_ICONS.terminal}
      tone={CONCEPT_TONE.terminal}
      title="Terminal"
      closeLabel="Close terminal"
      headerAccessory={
        <NewTerminalMenu
          targets={model.targets}
          onNew={model.openDefault}
          onOpenAt={model.openAt}
        />
      }
      onClose={onClose}
    >
      {() => <TerminalStudioBody model={model} isActive />}
    </StudioShell>
  );
};
