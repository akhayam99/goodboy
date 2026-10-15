import { useCallback } from 'react';
import type { SessionId, WorkspaceId } from '@goodboy/types';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { StudioShell } from '../../../../shared/components/StudioShell';
import type { TerminalTabId } from '../../../../shared/types/terminal';
import { useAppStore } from '../../../../store';
import {
  useTerminalStudioModel,
  type TerminalSelectParams,
} from '../../hooks/useTerminalStudioModel';
import { TerminalStudioBody } from './TerminalStudioBody';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly terminalId: TerminalTabId | null;
  readonly sessionId: SessionId | null;
  readonly worktree?: string | null;
  readonly onClose: () => void;
};

export const TerminalStudio = ({
  workspaceId,
  terminalId,
  sessionId,
  worktree = null,
  onClose,
}: Props) => {
  const amendStudio = useAppStore((state) => state.amendStudio);
  const setTerminalSelection = useAppStore((state) => state.setTerminalSelection);
  const onSelect = useCallback(
    ({ id, sessionId: nextSessionId, worktree: nextWorktree }: TerminalSelectParams) => {
      setTerminalSelection({
        selection: { sessionId: nextSessionId, worktree: nextWorktree, terminalId: id },
      });
      amendStudio({
        studio: {
          kind: 'terminal',
          terminalId: id,
          sessionId: nextSessionId,
          worktree: nextWorktree,
        },
      });
    },
    [amendStudio, setTerminalSelection],
  );
  const model = useTerminalStudioModel({
    workspaceId,
    selectedId: terminalId,
    selectedWorktreeKey: worktree,
    focusSessionId: sessionId,
    onSelect,
  });

  return (
    <StudioShell
      icon={CONCEPT_ICONS.terminal}
      tone={CONCEPT_TONE.terminal}
      title="Terminal"
      closeLabel="Close terminal"
      onClose={onClose}
    >
      {() => <TerminalStudioBody model={model} isActive />}
    </StudioShell>
  );
};
