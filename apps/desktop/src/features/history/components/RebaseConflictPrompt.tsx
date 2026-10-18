import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Button, Notice } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import {
  selectMountBaseBranch,
  selectMountForPath,
} from '../../../store/slices/project-mounts/selectors';
import { START_HINT_SCOPES } from '../../../store/slices/startHints/startHintScopes';
import { StartHint } from '../../../shared/components/StartHint';
import { START_HINT_COPY } from '../../../shared/components/startHintCopy';
import type { MountActionTarget, ResolvedAction } from '../../actions/types';
import { useActionControls } from '../../actions/useActionControls';
import { RebasePromptVerb } from './RebasePromptVerb';
import { rebaseConflictOf } from '../rebaseConflictOf';
import { rebaseConflictLineOf, rebaseConflictTitleOf } from '../rebaseConflictLine';
import { useWorktreeTree } from '../useWorktreeTree';

type Props = {
  readonly sessionId: SessionId;
  readonly worktreePath: string | null;
};

const RESOLVE_ID = 'mount.resolveRebaseWithAuto';
const TERMINAL_ID = 'mount.openTerminal';
const ABORT_ID = 'mount.abortRebaseConflict';

const HINT_LABEL = 'Hint for Auto';

type ActionByIdParams = {
  readonly actions: ReadonlyArray<ResolvedAction>;
  readonly id: string;
};

const actionById = ({ actions, id }: ActionByIdParams): ResolvedAction | undefined =>
  actions.find((action) => action.id === id);

export const RebaseConflictPrompt = ({ sessionId, worktreePath }: Props) => {
  const mount = useAppStore(
    useShallow((s) => selectMountForPath({ state: s, sessionId, path: worktreePath })),
  );
  const baseBranch = useAppStore((s) =>
    selectMountBaseBranch({ state: s, sessionId, path: worktreePath }),
  );
  const mountId = mount?.mountId ?? null;
  const run = useAppStore((s) => (mountId === null ? null : (s.historyRuns[mountId] ?? null)));
  const status = useWorktreeTree({ worktreePath, baseBranch });
  const target = useMemo<MountActionTarget | null>(
    () =>
      mountId === null ? null : { kind: 'mount', sessionId, mountId, status, remoteKind: null },
    [mountId, sessionId, status],
  );
  const controls = useActionControls({ target });
  const conflict = rebaseConflictOf({ run });
  if (conflict === null || conflict.autoAgentId !== null || mountId === null) {
    return null;
  }
  const facts = { files: conflict.files, baseBranch: conflict.baseBranch, isHook: conflict.isHook };
  return (
    <Notice
      role="alert"
      placement="inline"
      tone="warning"
      title={rebaseConflictTitleOf(facts)}
      body={<span data-rebase-conflict-count={conflict.count}>{rebaseConflictLineOf(facts)}</span>}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <RebasePromptVerb
            controls={controls}
            action={actionById({ actions: controls.actions, id: RESOLVE_ID })}
            label="Resolve with Auto"
            variant="primary"
          />
          <RebasePromptVerb
            controls={controls}
            action={actionById({ actions: controls.actions, id: TERMINAL_ID })}
            label="Open terminal here"
            variant="secondary"
          />
          <RebasePromptVerb
            controls={controls}
            action={actionById({ actions: controls.actions, id: ABORT_ID })}
            label="Abort rebase"
            variant="ghost"
          />
        </div>
      }
    >
      <div className="flex min-w-0 flex-col gap-1">
        <StartHint
          sessionId={sessionId}
          scope={START_HINT_SCOPES.rebase({ mountId })}
          label={HINT_LABEL}
          placeholder={START_HINT_COPY.rebase}
          isDisabled={controls.pendingId !== null}
        />
        {controls.failure === null ? null : (
          <div role="alert" className="flex min-w-0 items-center gap-2 text-meta text-danger">
            <span className="min-w-0 flex-1 break-words">{controls.failure.message}</span>
            <Button size="xs" variant="ghost" onClick={controls.retry}>
              Retry
            </Button>
          </div>
        )}
      </div>
    </Notice>
  );
};
