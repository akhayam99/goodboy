import { useState } from 'react';
import { Button, ConfirmPopover, Disclosure, ICON_SIZE } from '@goodboy/ui';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { formatAge } from '../../../../shared/utils/time/formatAge';
import { formatDayMonth } from '../../../../shared/utils/time/formatDayMonth';
import { historyVersionWhy } from '../../historyVersionWhy';
import { versionCommitDiff } from '../../versionCommitDiff';
import type { HistoryVersion } from '../../hooks/useHistoryVersions';

type Props = {
  readonly version: HistoryVersion;
  readonly nowSubjects: ReadonlyArray<string>;
  readonly nowMs: number;
  readonly hasUpstream: boolean;
  readonly onReset: () => void;
};

type PluralParams = {
  readonly count: number;
  readonly word: string;
};

const plural = ({ count, word }: PluralParams): string =>
  `${count} ${word}${count === 1 ? '' : 's'}`;

export const HistoryVersionRow = ({ version, nowSubjects, nowMs, hasUpstream, onReset }: Props) => {
  const [isOpen, setIsOpen] = useState(false);
  const { backup, facts } = version;
  const commits = facts?.commits ?? [];
  const why =
    facts === null
      ? 'Before a rewrite'
      : historyVersionWhy({ facts: { ...facts, commitCount: commits.length } });
  const diff =
    facts === null
      ? null
      : versionCommitDiff({
          versionSubjects: commits.map((commit) => commit.subject),
          nowSubjects,
        });
  const age = formatAge({ from: new Date(backup.createdAt * 1000).toISOString(), now: nowMs });
  return (
    <li className="flex min-w-0 flex-col gap-2 rounded-md px-2 py-2">
      <div className="flex min-w-0 items-baseline justify-between gap-2">
        <span className="min-w-0 truncate text-row text-foreground">{why}</span>
        <span className="shrink-0 text-meta text-faint-foreground">{age}</span>
      </div>
      <div className="flex min-w-0 flex-col gap-1 text-meta text-muted-foreground">
        <span>
          {facts === null ? backup.subject : plural({ count: commits.length, word: 'commit' })}
        </span>
        {diff === null || facts === null ? null : (
          <span>
            {`Now: +${diff.added} / -${diff.removed} commits, ${plural({ count: facts.filesChangedVsNow, word: 'file' })} changed`}
          </span>
        )}
      </div>
      {commits.length === 0 ? null : (
        <Disclosure
          label={isOpen ? 'Hide commits' : 'Show commits'}
          isOpen={isOpen}
          onToggle={() => setIsOpen((isNowOpen) => !isNowOpen)}
        >
          <ul className="flex min-w-0 flex-col gap-1 px-2 py-1">
            {[...commits].reverse().map((commit) => (
              <li key={commit.sha} className="flex min-w-0 items-baseline gap-2 text-meta">
                <span className="shrink-0 text-code tabular-nums text-muted-foreground">
                  {commit.sha.slice(0, 7)}
                </span>
                <span className="min-w-0 truncate text-foreground">{commit.subject}</span>
              </li>
            ))}
          </ul>
        </Disclosure>
      )}
      {backup.isLegacy ? (
        <span className="text-meta text-faint-foreground">Older version, read-only</span>
      ) : (
        <div className="flex">
          <ConfirmPopover
            role="danger"
            icon={<CONCEPT_ICONS.backup size={ICON_SIZE.row} aria-hidden />}
            title={`Reset the branch to the version from ${formatDayMonth({ at: backup.createdAt * 1000 })}?`}
            description="Your branch goes back to that state."
            note={
              <div className="flex min-w-0 flex-col gap-1 text-muted-foreground">
                <p>The current history is backed up first, and you can undo right after.</p>
                {hasUpstream ? <p>It goes online only if nothing newer is there.</p> : null}
              </div>
            }
            confirmLabel="Reset branch"
            onConfirm={onReset}
            trigger={({ arm }) => (
              <Button size="sm" variant="danger" onClick={arm}>
                Reset branch to this version
              </Button>
            )}
          />
        </div>
      )}
    </li>
  );
};
