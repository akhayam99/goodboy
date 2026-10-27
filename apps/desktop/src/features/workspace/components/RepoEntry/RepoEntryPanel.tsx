import { useState } from 'react';
import { Check, RefreshCw } from 'lucide-react';
import { Button, cn, Disclosure, ICON_SIZE, IconButton, PopoverBody } from '@goodboy/ui';
import type { BaseDivergence, Project, ProjectId, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { useToast } from '../../../../shared/components/Toast';

import { openInEditor } from '../../../../shared/lib/editor';
import { resolveEditorBinary } from '../../../../shared/lib/editorSettings';
import { revealInFileManager } from '../../../../shared/lib/reveal';
import { formatAge } from '../../../../shared/utils/time/formatAge';
import { pullBaseSummary } from '../../pullBase/pullBaseSummary';
import { ProjectGitDetail } from '../ProjectGitPill/ProjectGitDetail';
import { RepoEntryRow } from './RepoEntryRow';
import { repoGroupsOf } from './repoGroupsOf';
import { repoRowFactsOf, type RepoRowFacts } from './repoRowFactsOf';
import { OPEN_APP_SETTINGS_GENERAL } from '../../../../store/slices/notifications/errorRecovery';

type Entry = {
  readonly project: Project;
  readonly report: BaseDivergence | undefined;
};

type Row = Entry & {
  readonly facts: RepoRowFacts;
};

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly entries: ReadonlyArray<Entry>;
};

type PullParams = {
  readonly projectIds: ReadonlyArray<ProjectId>;
};

type RowParams = {
  readonly row: Row;
};

type ProjectParams = {
  readonly project: Project;
};

type StatusLineParams = {
  readonly isChecking: boolean;
  readonly checkedAt: number | undefined;
};

const statusLineOf = ({ isChecking, checkedAt }: StatusLineParams): string => {
  if (isChecking) {
    return 'Checking origin…';
  }
  if (checkedAt === undefined) {
    return 'Not checked yet';
  }
  return `Checked ${formatAge({ from: checkedAt, now: Date.now() })}`;
};

export const RepoEntryPanel = ({ workspaceId, entries }: Props) => {
  const [openProjectId, setOpenProjectId] = useState<ProjectId | null>(null);
  const [isQuietOpen, setIsQuietOpen] = useState(false);
  const isChecking = useAppStore((state) => state.repoCheckInFlight[workspaceId] === true);
  const checkedAt = useAppStore((state) => state.repoCheckedAt[workspaceId]);
  const pulls = useAppStore((state) => state.repoPull);
  const openStatus = useAppStore((state) =>
    openProjectId === null ? null : (state.projectGitStatus[openProjectId] ?? null),
  );
  const editor = useAppStore((state) => resolveEditorBinary({ settings: state.settings }));
  const checkRepoDivergence = useAppStore((state) => state.checkRepoDivergence);
  const pullRepoBases = useAppStore((state) => state.pullRepoBases);
  const reportError = useAppStore((state) => state.reportError);
  const { showToast } = useToast();
  const rows: ReadonlyArray<Row> = entries.map((entry) => ({
    ...entry,
    facts: repoRowFactsOf({ report: entry.report, pull: pulls[entry.project.id] }),
  }));
  const groups = repoGroupsOf({ entries: rows });
  const pullable = rows.filter((row) => row.facts.isPullable);
  const isPulling = rows.some((row) => row.facts.isPulling);

  const recheck = (): void => {
    void checkRepoDivergence({ workspaceId, maxAgeMs: 0 });
  };

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

  const reveal = async ({ project }: ProjectParams): Promise<void> => {
    try {
      await revealInFileManager({ path: project.rootPath });
    } catch (error) {
      void reportError({ title: `Couldn't show ${project.name} in Finder`, error, workspaceId });
    }
  };

  const openEditor = async ({ project }: ProjectParams): Promise<void> => {
    try {
      await openInEditor({ path: project.rootPath, editor });
    } catch (error) {
      void reportError({
        title: `Couldn't open ${project.name} in the editor`,
        error,
        workspaceId,
        recovery: OPEN_APP_SETTINGS_GENERAL,
      });
    }
  };

  const rowOf = ({ row }: RowParams) => (
    <RepoEntryRow
      key={row.project.id}
      project={row.project}
      base={row.report?.base ?? row.project.baseBranch ?? null}
      facts={row.facts}
      isOpen={openProjectId === row.project.id}
      isChecking={isChecking}
      detail={
        <ProjectGitDetail
          project={row.project}
          status={openProjectId === row.project.id ? openStatus : null}
        />
      }
      onToggle={() =>
        setOpenProjectId((current) => (current === row.project.id ? null : row.project.id))
      }
      onPull={() => void pull({ projectIds: [row.project.id] })}
      onRetry={recheck}
      onReveal={() => void reveal({ project: row.project })}
      onOpenEditor={() => void openEditor({ project: row.project })}
    />
  );

  return (
    <>
      <div data-repo-header="" className="flex h-10 shrink-0 items-center gap-2 px-3">
        <span className="shrink-0 text-meta text-foreground">Repositories</span>
        <span className="min-w-0 flex-1 truncate text-meta text-muted-foreground">
          {statusLineOf({ isChecking, checkedAt })}
        </span>
        {pullable.length >= 2 ? (
          <Button
            size="sm"
            variant="primary"
            disabled={isPulling}
            onClick={() => void pull({ projectIds: pullable.map((row) => row.project.id) })}
          >
            Pull all
          </Button>
        ) : null}
        <IconButton
          variant="ghost"
          icon={RefreshCw}
          iconSize={ICON_SIZE.row}
          label="Check now"
          tooltip="Check now"
          disabled={isChecking}
          onClick={recheck}
          className={cn('shrink-0', isChecking && 'spin-border spin-border-info')}
        />
      </div>
      <PopoverBody className="gap-1 py-2">
        {groups.attention.map((row) => rowOf({ row }))}
        {groups.quietLine === null ? null : (
          <Disclosure
            testId="repo-quiet"
            isOpen={isQuietOpen}
            onToggle={() => setIsQuietOpen((isOpen) => !isOpen)}
            triggerClassName="h-7 text-meta text-muted-foreground"
            label={
              <span className="flex min-w-0 items-center gap-1">
                <Check size={ICON_SIZE.mark} aria-hidden className="shrink-0" />
                <span className="truncate">{groups.quietLine}</span>
              </span>
            }
          >
            {groups.quiet.map((row) => rowOf({ row }))}
          </Disclosure>
        )}
      </PopoverBody>
    </>
  );
};
