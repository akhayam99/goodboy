import { useEffect, useState } from 'react';
import { EmptyLine, Button, Eyebrow, InlineConfirm } from '@goodboy/ui';
import type { HistoryBackup } from '@goodboy/types';
import { listHistoryBackups } from '../../historyEngine';
import { formatAge } from '../../../../shared/utils/time/formatAge';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly worktreePath: string;
  readonly branch: string;
  readonly hasUpstream: boolean;
  readonly revision: number;
  readonly onRestore: (backup: HistoryBackup) => void;
  readonly onClose: () => void;
};

export const HistoryBackups = ({
  worktreePath,
  branch,
  hasUpstream,
  revision,
  onRestore,
  onClose,
}: Props) => {
  const [backups, setBackups] = useState<ReadonlyArray<HistoryBackup> | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  useEffect(() => {
    let isCurrent = true;
    void listHistoryBackups({ worktreePath, branch })
      .then((found) => {
        if (isCurrent) {
          setBackups(found);
        }
      })
      .catch(() => {
        if (isCurrent) {
          setBackups([]);
        }
      });
    return () => {
      isCurrent = false;
    };
  }, [branch, revision, worktreePath]);

  return (
    <section className="flex flex-col gap-2" aria-label="Backups">
      <div className="flex items-center justify-between gap-2">
        <Eyebrow label={`Backups · ${backups?.length ?? 0}`} muted />
        <Button size="sm" variant="ghost" onClick={onClose}>
          Hide
        </Button>
      </div>
      {backups !== null && backups.length === 0 ? (
        <EmptyLine className="px-2 text-meta text-muted-foreground">
          No backups yet. Every rewrite saves one here for 30 days.
        </EmptyLine>
      ) : null}
      <ul className="flex flex-col">
        {(backups ?? []).map((backup) => (
          <li key={backup.refName} className="flex min-w-0 flex-col gap-1 rounded-md px-2 py-2">
            <div className="flex min-w-0 items-center gap-2">
              <span className="shrink-0 font-mono text-meta tabular-nums text-muted-foreground">
                {backup.sha.slice(0, 7)}
              </span>
              <span className="min-w-0 flex-1 truncate text-row text-foreground">
                {backup.subject}
              </span>
              <span className="shrink-0 text-meta text-faint-foreground">
                {formatAge({
                  from: new Date(backup.createdAt * 1000).toISOString(),
                  now: Date.now(),
                })}
              </span>
              {backup.isLegacy ? (
                <span
                  title="Made by an older Goodboy before backups named their branch, so it is shown read-only."
                  className="shrink-0 text-meta text-faint-foreground"
                >
                  Older backup, read-only
                </span>
              ) : (
                <Button size="sm" variant="ghost" onClick={() => setConfirming(backup.refName)}>
                  Restore previous history
                </Button>
              )}
            </div>
            {confirming === backup.refName ? (
              <InlineConfirm
                role="danger"
                icon={<CONCEPT_ICONS.backup size={ICON_SIZE.row} aria-hidden />}
                title="Put this history back on the branch?"
                description={
                  hasUpstream
                    ? 'The branch moves back here. It goes online only if the online copy has nothing newer than this backup; otherwise it stays here and you are told. The history you leave is kept as a backup.'
                    : 'The branch moves back here. The history you leave is kept as a backup.'
                }
                confirmLabel="Restore"
                onConfirm={() => {
                  setConfirming(null);
                  onRestore(backup);
                }}
                onCancel={() => setConfirming(null)}
              />
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
};
