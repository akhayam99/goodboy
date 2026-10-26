import { useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { ProviderRunId, SessionId } from '@goodboy/types';
import { Button, formatError, ICON_SIZE, Notice, type NoticeTone } from '@goodboy/ui';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { useAppStore } from '../../../../store';
import {
  historyCandidatesOf,
  historyFoldersOf,
} from '../../../../store/slices/project-mounts/inPlaceFoldersOf';
import { changeTurnsOf } from '../../../file-versions/changeTurnsOf';
import { restoreCopyOf } from '../../../file-versions/restoreCopyOf';
import { turnRestoreTargetOf } from '../../../file-versions/turnRestoreTargetOf';
import { undoTargetOf } from '../../../file-versions/undoTargetOf';
import {
  useChangesRestore,
  type RestoreOutcome,
  type RestoreTarget,
} from '../../../file-versions/useChangesRestore';
import { openLens } from '../../../session/openLens';
import { TurnChangesFile } from './TurnChangesFile';

type Props = {
  readonly sessionId: SessionId;
  readonly runId: ProviderRunId;
};

type RunParams = Readonly<{ target: RestoreTarget; isForced: boolean }>;

const NO_TITLES: Readonly<Record<string, string>> = {};
const NO_RESTORED: Readonly<Record<string, string>> = {};

const OUTCOME_TONE = {
  ask: 'warning',
  done: 'success',
  nothing: 'info',
  failed: 'danger',
} as const satisfies Record<RestoreOutcome['kind'], NoticeTone>;

export const TurnChangesCard = ({ sessionId, runId }: Props) => {
  const folders = useAppStore(useShallow((state) => historyFoldersOf({ state, sessionId })));
  const hasCandidates = useAppStore(
    (state) => historyCandidatesOf({ state, sessionId }).length > 0,
  );
  const turns = useAppStore((state) => state.sessionFolderTurns[sessionId]);
  const restored = useAppStore(
    (state) => state.sessionFolderSummary[sessionId]?.restored ?? NO_RESTORED,
  );
  const failure = useAppStore((state) => state.folderCaptureFailures[runId]);
  const loadSessionFolderTurns = useAppStore((state) => state.loadSessionFolderTurns);
  const retryFolderCapture = useAppStore((state) => state.retryFolderCapture);
  const selectSessionFileVersionPath = useAppStore((state) => state.selectSessionFileVersionPath);
  const restore = useChangesRestore({ sessionId });
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);

  useEffect(() => {
    if (!hasCandidates) {
      return;
    }
    void loadSessionFolderTurns({ sessionId });
  }, [hasCandidates, loadSessionFolderTurns, sessionId]);

  const turn = useMemo(
    () =>
      changeTurnsOf({ turns: turns ?? [], restored, titles: NO_TITLES }).find(
        (entry) => entry.runId === runId,
      ) ?? null,
    [restored, runId, turns],
  );

  if (failure !== undefined) {
    const onRetry = () => {
      setIsRetrying(true);
      setRetryError(null);
      retryFolderCapture({ runId })
        .catch((error: unknown) => setRetryError(formatError(error)))
        .finally(() => setIsRetrying(false));
    };
    return (
      <Notice
        tone="danger"
        placement="transcript"
        role="alert"
        title="Changes from this turn couldn't be saved"
        body="The text from before this turn is still kept."
        detail={retryError ?? failure.message}
        actions={
          <Button
            variant="secondary"
            size="xs"
            isBusy={isRetrying}
            disabled={isRetrying}
            onClick={onRetry}
          >
            Retry
          </Button>
        }
      />
    );
  }

  if (turn === null) {
    return null;
  }

  const folderName =
    folders.find((folder) => turn.folderPaths.includes(folder.rootPath))?.name ?? 'the folder';
  const count = turn.files.length;
  const isBusy = restore.busyId !== null;
  const isTurnRestored = turn.files.every((file) => file.restoreRunId !== null);
  const run = ({ target, isForced }: RunParams) => {
    void restore.run({ target, isForced });
  };
  const onReview = () => {
    const first = turn.files[0];
    if (first !== undefined) {
      selectSessionFileVersionPath({ sessionId, relativePath: first.key });
    }
    openLens({ sessionId, lens: 'files' });
  };
  const outcome = restore.outcome;
  const copy = outcome === null ? null : restoreCopyOf({ outcome });
  const outcomeActions = () => {
    if (outcome === null || copy === null) {
      return null;
    }
    if (outcome.kind === 'ask') {
      return (
        <>
          <Button
            variant="secondary"
            size="xs"
            disabled={isBusy}
            onClick={() => run({ target: outcome.target, isForced: true })}
          >
            {copy.confirm}
          </Button>
          <Button variant="ghost" size="xs" disabled={isBusy} onClick={restore.dismiss}>
            Cancel
          </Button>
        </>
      );
    }
    if (outcome.kind === 'done') {
      return (
        <Button
          variant="secondary"
          size="xs"
          disabled={isBusy}
          onClick={() => run({ target: undoTargetOf({ outcome }), isForced: false })}
        >
          Undo restore of turn {outcome.target.turnNumber}
        </Button>
      );
    }
    if (outcome.kind === 'failed') {
      return (
        <Button
          variant="secondary"
          size="xs"
          disabled={isBusy}
          onClick={() => run({ target: outcome.target, isForced: false })}
        >
          Retry
        </Button>
      );
    }
    return null;
  };

  return (
    <section
      aria-label={`Changes from this turn in ${folderName}`}
      className="flex min-w-0 flex-col gap-2 rounded-lg bg-subtle p-3"
    >
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <CONCEPT_ICONS.diff
          size={ICON_SIZE.control}
          aria-hidden
          className="shrink-0 text-muted-foreground"
        />
        <p className="min-w-0 flex-1 text-meta text-foreground">
          Changed {count} {count === 1 ? 'file' : 'files'} in {folderName}
          <span className="text-muted-foreground"> · saved before this turn</span>
        </p>
        <Button variant="secondary" size="xs" onClick={onReview}>
          Review changes
        </Button>
        <Button
          variant="ghost"
          size="xs"
          disabled={isBusy || isTurnRestored}
          isBusy={restore.busyId === `turn:${turn.runId}`}
          onClick={() => run({ target: turnRestoreTargetOf({ turn }), isForced: false })}
        >
          <CONCEPT_ICONS.versionRestore size={ICON_SIZE.row} aria-hidden />
          Restore turn
        </Button>
      </div>
      <ul className="flex min-w-0 flex-col gap-1">
        {turn.files.map((file) => (
          <TurnChangesFile key={file.key} sessionId={sessionId} file={file} />
        ))}
      </ul>
      {outcome === null || copy === null ? null : (
        <Notice
          tone={OUTCOME_TONE[outcome.kind]}
          placement="transcript"
          role={outcome.kind === 'ask' || outcome.kind === 'failed' ? 'alert' : 'status'}
          title={copy.title}
          body={outcome.kind === 'failed' ? outcome.message : copy.body}
          actions={outcomeActions()}
        />
      )}
    </section>
  );
};
