import { useState } from 'react';
import { FolderOpen, Trash2 } from 'lucide-react';
import { Button, Eyebrow, InlineConfirm, cn, tintClasses } from '@goodboy/ui';
import { useToast } from '../../../../app/components/Toast';
import { useAppStore } from '../../../../store';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { formatBytes } from '../../../../shared/utils/formatBytes';
import { formatInteger } from '../../../../shared/utils/formatInteger';
import { pluralize } from '../../../../shared/utils/pluralize';
import { revealInFileManager } from '../../storage';

const PRUNE_CONFIRM =
  'Deletes the streamed transcript of every archived session: tool calls, streaming output, subagent activity. Final messages stay. This cannot be undone.';

const HistoryIcon = CONCEPT_ICONS.storage;

export const StorageHistory = () => {
  const stats = useAppStore((state) => state.storageStats);
  const pruneArchivedTranscripts = useAppStore((state) => state.pruneArchivedTranscripts);
  const reportError = useAppStore((state) => state.reportError);
  const { showToast } = useToast();
  const [isConfirming, setIsConfirming] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  if (stats === null) {
    return null;
  }
  const folder = stats.appDataFolder;
  const copies = stats.snapshotCount;

  const onPrune = async () => {
    setIsBusy(true);
    try {
      const deleted = await pruneArchivedTranscripts();
      setIsConfirming(false);
      showToast({
        kind: 'success',
        message: `Pruned ${formatInteger(deleted)} transcript event${deleted === 1 ? '' : 's'}`,
      });
    } catch (error) {
      void reportError({ title: "Couldn't prune archived transcripts", error });
    } finally {
      setIsBusy(false);
    }
  };

  const onReveal = () => {
    if (folder === null) {
      return;
    }
    void revealInFileManager({ path: folder }).catch((error: unknown) =>
      reportError({ title: "Couldn't show the app data folder", error }),
    );
  };

  return (
    <section id="storage-history" aria-label="History and app data" className="flex flex-col gap-1">
      <Eyebrow
        icon={<HistoryIcon size={ICON_SIZE.row} aria-hidden />}
        label="History and app data"
      />
      <div className="flex min-h-10 items-center gap-3 px-2 text-sm">
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-foreground">Archived transcripts</span>
          <span className="text-2xs text-faint-foreground">
            Streamed events of {pluralize(stats.archivedSessionCount, 'archived session')}. Final
            messages stay.
          </span>
        </div>
        <span className="text-2xs tabular-nums text-muted-foreground">
          {formatBytes({ bytes: stats.archivedTranscriptBytes })}
        </span>
        <Button
          variant="ghost"
          size="sm"
          disabled={stats.archivedTranscriptRows === 0 || isConfirming}
          onClick={() => setIsConfirming(true)}
          className={cn('text-danger hover:text-danger', tintClasses('danger').hoverBg)}
        >
          Prune
        </Button>
      </div>
      {isConfirming ? (
        <InlineConfirm
          role="danger"
          icon={<Trash2 size={ICON_SIZE.row} aria-hidden />}
          title="Prune archived transcripts?"
          description={PRUNE_CONFIRM}
          confirmLabel="Prune"
          isBusy={isBusy}
          onConfirm={onPrune}
          onCancel={() => setIsConfirming(false)}
        />
      ) : null}
      <div className="flex min-h-10 items-center gap-3 px-2 text-sm">
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-foreground">App data</span>
          <span className="text-2xs text-faint-foreground">
            Database {formatBytes({ bytes: stats.databaseBytes })}
            {copies === 0
              ? '.'
              : `, ${copies === 1 ? '1 safety copy' : `${copies} safety copies`} from updates ${formatBytes({ bytes: stats.snapshotBytes })}.`}
          </span>
        </div>
        <span className="text-2xs tabular-nums text-muted-foreground">
          {formatBytes({ bytes: stats.databaseBytes + stats.snapshotBytes })}
        </span>
        {folder === null ? null : (
          <Button variant="ghost" size="sm" onClick={onReveal}>
            <FolderOpen size={ICON_SIZE.row} aria-hidden />
            Show in Finder
          </Button>
        )}
      </div>
    </section>
  );
};
