import { Tooltip, TruncatedText, cn } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import type { AgentId } from '@goodboy/types';
import { runObjectKey, runTitleAnchorKey } from '../../../actions/runObjectKey';
import { useObjectMenuTrigger } from '../../../actions/useObjectMenuTrigger';
import { useRenameRequest } from '../../../../shared/hooks/useRenameRequest';
import { useRunTitleRename } from '../../hooks/useRunTitleRename';
import type { RunView } from '../AgentTree/useRunView';

type Props = {
  readonly session: Session;
  readonly view: RunView;
  readonly stepAgentId: AgentId | null;
};

export const RunTitle = ({ session, view, stepAgentId }: Props) => {
  const sessionId = session.id;
  const runId = view.run.id;
  const anchorKey = runTitleAnchorKey({ runId });
  const menu = useObjectMenuTrigger({
    target: { kind: 'workflowRun', sessionId, runId, stepAgentId },
    anchorKey,
    viewing: { kind: 'workflowRun', id: runId },
  });
  const rename = useRunTitleRename({
    sessionId,
    workflowRunId: runId,
    currentTitle: view.name,
  });
  useRenameRequest({
    objectKey: runObjectKey({ runId }),
    anchorKeys: [anchorKey, `workflow-run:${runId}`],
    onRename: rename.start,
  });

  if (rename.editing) {
    return (
      <Tooltip content={rename.error ?? undefined}>
        <input
          autoFocus
          value={rename.draft}
          maxLength={rename.maxLength}
          aria-label="Rename run"
          aria-invalid={rename.error !== null}
          onChange={(event) => rename.setDraft(event.target.value)}
          onKeyDown={rename.onKeyDown}
          onBlur={rename.onBlur}
          className={cn(
            'w-full min-w-0 rounded-md bg-background px-2 py-0.5 text-title text-foreground outline-none ring-1',
            rename.error !== null ? 'ring-danger' : 'ring-primary',
          )}
        />
      </Tooltip>
    );
  }

  return (
    <TruncatedText
      className="min-w-0 truncate"
      onDoubleClick={rename.start}
      onContextMenu={menu.onContextMenu}
      onKeyDown={menu.onKeyDown}
    >
      {view.name}
    </TruncatedText>
  );
};
