import { useState } from 'react';
import { ChevronLeft, RefreshCw } from 'lucide-react';
import { Button, IconButton, PopoverBody, cn } from '@goodboy/ui';
import type { BaseDivergence, Project, ProjectId, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { useToast } from '../../../../shared/components/Toast';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { formatAge } from '../../../../shared/utils/time/formatAge';
import { pullBaseSummary } from '../../pullBase/pullBaseSummary';
import { ProjectGitDetail } from '../ProjectGitPill/ProjectGitDetail';
import { RepoEntryRow } from './RepoEntryRow';
import { repoRowFactsOf } from './repoRowFactsOf';

type Entry = {
  readonly project: Project;
  readonly report: BaseDivergence | undefined;
};

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly entries: ReadonlyArray<Entry>;
  readonly failedCount: number;
};

type PullParams = {
  readonly projectIds: ReadonlyArray<ProjectId>;
};

type StatusLineParams = {
  readonly isChecking: boolean;
  readonly failedCount: number;
  readonly checkedAt: number | undefined;
};

const statusLineOf = ({ isChecking, failedCount, checkedAt }: StatusLineParams): string => {
  if (isChecking) {
    return 'Checking origin…';
  }
  if (failedCount > 0) {
    return `Couldn't reach origin for ${failedCount === 1 ? '1 repo' : `${failedCount} repos`}`;
  }
  if (checkedAt === undefined) {
    return 'Not checked yet';
  }
  return `Checked ${formatAge({ from: checkedAt, now: Date.now() })}`;
};

export const RepoEntryPanel = ({ workspaceId, entries, failedCount }: Props) => {
  const [openProjectId, setOpenProjectId] = useState<ProjectId | null>(null);
  const isChecking = useAppStore((state) => state.repoCheckInFlight[workspaceId] === true);
  const checkedAt = useAppStore((state) => state.repoCheckedAt[workspaceId]);
  const pulls = useAppStore((state) => state.repoPull);
  const openStatus = useAppStore((state) =>
    openProjectId === null ? null : (state.projectGitStatus[openProjectId] ?? null),
  );
  const checkRepoDivergence = useAppStore((state) => state.checkRepoDivergence);
  const pullRepoBases = useAppStore((state) => state.pullRepoBases);
  const { showToast } = useToast();
  const rows = entries.map((entry) => ({
    ...entry,
    facts: repoRowFactsOf({ report: entry.report, pull: pulls[entry.project.id] }),
  }));
  const pullable = rows.filter((row) => row.facts.isPullable);
  const isPulling = rows.some((row) => row.facts.isPulling);
  const openEntry = entries.find((entry) => entry.project.id === openProjectId) ?? null;

  const pull = async ({ projectIds }: PullParams): Promise<void> => {
    const outcomes = await pullRepoBases({ workspaceId, projectIds });
    if (outcomes.length === 0) {
      return;
    }
    const summary = pullBaseSummary({ outcomes });
    showToast({
      kind: summary.kind,
      title: summary.title,
      message: summary.lines.join('\n'),
      dedupeKey: 'pull-base',
    });
  };

  if (openEntry !== null) {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpenProjectId(null)}
          className="flex h-9 shrink-0 items-center gap-2 px-3 text-label transition-colors hover:bg-hover"
        >
          <ChevronLeft size={ICON_SIZE.row} aria-hidden />
          <span className="truncate">{openEntry.project.name}</span>
        </button>
        <PopoverBody>
          <ProjectGitDetail project={openEntry.project} status={openStatus} />
        </PopoverBody>
      </>
    );
  }

  return (
    <>
      <div className="flex h-12 shrink-0 items-center gap-2 px-3">
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-label text-foreground">Repositories</span>
          <span className="truncate text-meta text-muted-foreground">
            {statusLineOf({ isChecking, failedCount, checkedAt })}
          </span>
        </div>
        {failedCount > 0 ? (
          <Button
            size="sm"
            variant="ghost"
            disabled={isChecking}
            onClick={() => void checkRepoDivergence({ workspaceId, maxAgeMs: 0 })}
          >
            Retry
          </Button>
        ) : (
          <IconButton
            variant="ghost"
            icon={RefreshCw}
            iconSize={ICON_SIZE.row}
            label="Check now"
            tooltip="Check now"
            disabled={isChecking}
            onClick={() => void checkRepoDivergence({ workspaceId, maxAgeMs: 0 })}
            className={cn('shrink-0', isChecking && 'spin-border spin-border-info')}
          />
        )}
        {entries.length > 1 && pullable.length > 0 ? (
          <Button
            size="sm"
            variant="primary"
            disabled={isPulling}
            onClick={() => void pull({ projectIds: pullable.map((row) => row.project.id) })}
          >
            Pull all
          </Button>
        ) : null}
      </div>
      <PopoverBody className="gap-1 py-2">
        {rows.map((row) => (
          <RepoEntryRow
            key={row.project.id}
            project={row.project}
            base={row.report?.base ?? row.project.baseBranch ?? null}
            facts={row.facts}
            onOpen={() => setOpenProjectId(row.project.id)}
            onPull={() => void pull({ projectIds: [row.project.id] })}
          />
        ))}
      </PopoverBody>
    </>
  );
};
