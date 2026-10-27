import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { SessionId, TurnEvent } from '@goodboy/types';
import {
  Button,
  EmptyState,
  ICON_SIZE,
  Notice,
  PageColumn,
  PaneShell,
  ScrollFade,
  SkeletonText,
} from '@goodboy/ui';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../../../shared/components/conceptIcons';
import { useNow } from '../../../../../../shared/hooks/useNow';
import { formatAdaptiveAge } from '../../../../../../shared/utils/time/formatAdaptiveAge';
import { useAppStore } from '../../../../../../store';
import { changeTurnsOf } from '../../../../../file-versions/changeTurnsOf';
import { turnRestoreTargetOf } from '../../../../../file-versions/turnRestoreTargetOf';
import { turnTitlesOf } from '../../../../../file-versions/turnTitlesOf';
import { undoTargetOf } from '../../../../../file-versions/undoTargetOf';
import { ChangeDetail } from './ChangeDetail';
import { ChangesFooter } from './ChangesFooter';
import { RestoreBand } from './RestoreBand';
import { TurnGroup } from './TurnGroup';
import { changesMetaOf } from './changesMetaOf';
import {
  useChangesRestore,
  type RestoreTarget,
} from '../../../../../file-versions/useChangesRestore';
import { useFolderChanges } from './useFolderChanges';

type Props = {
  readonly sessionId: SessionId;
};

type RunParams = Readonly<{ target: RestoreTarget; isForced: boolean }>;

const NO_EVENTS: ReadonlyArray<TurnEvent> = [];
const NO_RESTORED: Readonly<Record<string, string>> = {};
const AGE_CADENCE = 30_000;

export const ChangesPane = ({ sessionId }: Props) => {
  const { folders, turns, loadError, sizeError, reload } = useFolderChanges({ sessionId });
  const summary = useAppStore((state) => state.sessionFolderSummary[sessionId]);
  const titles = useAppStore(
    useShallow((state) =>
      turnTitlesOf({
        transcripts: (state.sessionPhaseRuns[sessionId] ?? []).map(
          (agent) => state.transcripts[agent.id] ?? NO_EVENTS,
        ),
      }),
    ),
  );
  const codeFolders = useAppStore(
    useShallow((state) =>
      folders
        .filter((folder) => state.folderPurpose[folder.id] === 'code')
        .map((folder) => folder.rootPath),
    ),
  );
  const now = useNow(AGE_CADENCE);
  const restore = useChangesRestore({ sessionId });
  const pickedKey = useAppStore((state) => state.sessionFileVersionSelectedPath[sessionId] ?? null);
  const selectSessionFileVersionPath = useAppStore((state) => state.selectSessionFileVersionPath);

  const changeTurns = useMemo(
    () => changeTurnsOf({ turns: turns ?? [], restored: summary?.restored ?? NO_RESTORED, titles }),
    [summary, titles, turns],
  );
  const files = changeTurns.flatMap((turn) => turn.files.map((file) => ({ turn, file })));
  const selected = files.find((entry) => entry.file.key === pickedKey) ?? files[0] ?? null;
  const isBusy = restore.busyId !== null;

  const run = ({ target, isForced }: RunParams) => {
    void restore.run({ target, isForced }).then(reload);
  };

  const turnTarget = selected === null ? null : turnRestoreTargetOf({ turn: selected.turn });
  const isTurnRestored =
    selected !== null && selected.turn.files.every((file) => file.restoreRunId !== null);

  const outcome = restore.outcome;
  const isBandShown =
    outcome !== null &&
    selected !== null &&
    (outcome.target.fileKey === null
      ? outcome.target.runId === selected.turn.runId
      : outcome.target.fileKey === selected.file.key);
  const band =
    outcome !== null && isBandShown ? (
      <RestoreBand
        outcome={outcome}
        isBusy={isBusy}
        onConfirm={(target) => run({ target, isForced: true })}
        onRetry={(target) => run({ target, isForced: false })}
        onDismiss={restore.dismiss}
        onUndo={() => {
          if (outcome.kind !== 'done') {
            return;
          }
          run({ target: undoTargetOf({ outcome }), isForced: false });
        }}
      />
    ) : null;

  const body = () => {
    if (turns === undefined && loadError !== null) {
      return (
        <PageColumn width="full">
          <Notice
            tone="danger"
            placement="inline"
            role="alert"
            title="Couldn't load the changes"
            body={loadError}
            actions={
              <Button variant="secondary" size="xs" onClick={reload}>
                Retry
              </Button>
            }
          />
        </PageColumn>
      );
    }
    if (turns === undefined) {
      return (
        <PageColumn width="full">
          <SkeletonText lines={5} />
        </PageColumn>
      );
    }
    if (selected === null) {
      return (
        <PageColumn width="full">
          <EmptyState
            size="section"
            tone={CONCEPT_TONE.diff}
            icon={CONCEPT_ICONS.diff}
            title="No changes yet"
            description={`Agent changes in ${folders[0]?.name ?? 'this folder'} are ready to restore.`}
          />
        </PageColumn>
      );
    }
    return (
      <PageColumn width="full" className="flex min-h-0 flex-1 flex-col gap-3 pb-5">
        {loadError === null ? null : (
          <Notice
            tone="danger"
            placement="inline"
            role="alert"
            title="Couldn't load the latest changes"
            body={loadError}
            actions={
              <Button variant="secondary" size="xs" onClick={reload}>
                Retry
              </Button>
            }
          />
        )}
        <div className="flex min-h-0 flex-1 gap-6">
          <ScrollFade className="w-72 shrink-0" fadeSize={24}>
            <div className="flex flex-col gap-6">
              {changeTurns.map((turn) => (
                <TurnGroup
                  key={turn.runId}
                  sessionId={sessionId}
                  turn={turn}
                  age={formatAdaptiveAge({ at: turn.finishedAtMs, now })}
                  selectedKey={selected.file.key}
                  onSelect={(key) => selectSessionFileVersionPath({ sessionId, relativePath: key })}
                />
              ))}
              <ChangesFooter folders={folders} turns={changeTurns} sizeError={sizeError} />
            </div>
          </ScrollFade>
          <ChangeDetail
            sessionId={sessionId}
            file={selected.file}
            turn={selected.turn}
            age={formatAdaptiveAge({ at: selected.turn.finishedAtMs, now })}
            isCode={codeFolders.includes(selected.file.folderPath)}
            isBusy={isBusy}
            band={band}
            onRestore={(target) => run({ target, isForced: false })}
          />
        </div>
      </PageColumn>
    );
  };

  return (
    <PaneShell
      title="Changes"
      width="full"
      scroll="self"
      meta={summary === undefined ? undefined : changesMetaOf({ counts: summary.counts })}
      actions={
        turnTarget === null ? undefined : (
          <Button
            variant="ghost"
            size="sm"
            disabled={isBusy || isTurnRestored}
            onClick={() => run({ target: turnTarget, isForced: false })}
          >
            <CONCEPT_ICONS.versionRestore size={ICON_SIZE.row} aria-hidden />
            Restore turn {turnTarget.turnNumber}
          </Button>
        )
      }
    >
      {body()}
    </PaneShell>
  );
};
