import type { ReactNode } from 'react';
import { Button, ICON_SIZE } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { CONCEPT_ICONS } from '../../../../../../shared/components/conceptIcons';
import { usePendingAction } from '../../../../../../shared/hooks/usePendingAction';
import { exploreOpen } from '../../../../../explore/explore';
import type { ChangeFile, ChangeTurn } from '../../../../../file-versions/changeTurnsOf';
import { ChangeBody } from './ChangeBody';
import { CHANGE_KINDS } from './changeKinds';
import { useChangeSides } from '../../../../../file-versions/useChangeSides';
import type { RestoreTarget } from '../../../../../file-versions/useChangesRestore';

type Props = {
  readonly sessionId: SessionId;
  readonly file: ChangeFile;
  readonly turn: ChangeTurn;
  readonly age: string;
  readonly isCode: boolean;
  readonly isBusy: boolean;
  readonly band: ReactNode;
  readonly onRestore: (target: RestoreTarget) => void;
};

export const ChangeDetail = ({
  sessionId,
  file,
  turn,
  age,
  isCode,
  isBusy,
  band,
  onRestore,
}: Props) => {
  const view = useChangeSides({ sessionId, file });
  const pending = usePendingAction({ sessionId });
  const openKey = `open:${file.key}`;
  const isRestored = file.restoreRunId !== null;
  const isOnDisk = isRestored ? file.change !== 'added' : file.change !== 'deleted';
  const base = {
    runId: file.runId,
    fileKey: file.key,
    subject: file.label,
    turnNumber: turn.number,
    isNewFile: file.change === 'added',
  };
  const restore: RestoreTarget = {
    ...base,
    id: `file:${file.key}`,
    scope: 'file',
    steps: [{ folderPath: file.folderPath, runId: file.runId, relativePaths: [file.relativePath] }],
  };
  const undo: RestoreTarget | null =
    file.restoreRunId === null
      ? null
      : {
          ...base,
          id: `undo:${file.key}`,
          scope: 'undo',
          steps: [
            {
              folderPath: file.folderPath,
              runId: file.restoreRunId,
              relativePaths: [file.relativePath],
            },
          ],
        };
  const restoreLabel =
    file.change === 'added' ? 'Remove this new file' : `Restore to before turn ${turn.number}`;

  const onOpen = () => {
    void pending.run({
      key: openKey,
      failureTitle: `Couldn't open ${file.label}`,
      task: () =>
        exploreOpen({ sessionDir: file.folderPath, relPath: file.relativePath, reveal: false }),
    });
  };

  return (
    <section aria-label={file.label} className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
      <div className="flex min-w-0 items-start gap-2">
        <div className="flex min-w-0 flex-1 flex-col">
          <h2 className="truncate text-heading text-foreground">{file.label}</h2>
          <p className="truncate text-meta text-muted-foreground">
            {CHANGE_KINDS[file.change].verb} turn {turn.number}, {age}
          </p>
        </div>
        {isOnDisk ? (
          <Button
            variant="ghost"
            size="sm"
            isBusy={pending.pendingKeys.has(openKey)}
            disabled={pending.pendingKeys.has(openKey)}
            onClick={onOpen}
          >
            <CONCEPT_ICONS.openExternal size={ICON_SIZE.row} aria-hidden />
            Open
          </Button>
        ) : null}
        {undo === null ? (
          <Button
            variant="secondary"
            size="sm"
            disabled={isBusy || file.isPruned}
            isBusy={isBusy}
            onClick={() => onRestore(restore)}
          >
            <CONCEPT_ICONS.versionRestore size={ICON_SIZE.row} aria-hidden />
            {restoreLabel}
          </Button>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            disabled={isBusy}
            isBusy={isBusy}
            onClick={() => onRestore(undo)}
          >
            Undo restore
          </Button>
        )}
      </div>
      {band}
      <ChangeBody file={file} turnNumber={turn.number} view={view} isCode={isCode} />
    </section>
  );
};
