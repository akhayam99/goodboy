import { useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { GitBranch, X } from 'lucide-react';
import type { DeletedBranch, Project, ProjectId, SessionId } from '@goodboy/types';
import {
  Button,
  Eyebrow,
  IconButton,
  Notice,
  SegmentedTabs,
  type SegmentedTabOption,
} from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import type { BranchScanEntry } from '../../../../store/slices/branch-cleanup';
import { repoDeletesMergedBranches } from '../../../../store/slices/branch-cleanup/repoDeletesMergedBranches';
import type { StorageScope } from '../../../../store/slices/storage/types';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { BRANCHES_HELP, branchCount, deletedNotice } from '../../branches/branchCopy';
import { storageOwnerMatchesScope } from '../../storageOwnerMatchesScope';
import {
  classifyBranch,
  isSafeVerdict,
  matchesBranchFilter,
  matchesBranchTab,
  type BranchFilter,
  type BranchTab,
  type ClassifiedBranch,
} from '../../branches/classifyBranch';
import { BranchBulkBar, type SelectedBranch } from './BranchBulkBar';
import { BRANCH_ROW_GRID, BranchRow } from './BranchRow';

type Props = {
  readonly scope: StorageScope;
};

type ProjectGroup = {
  readonly project: Project;
  readonly entries: ReadonlyArray<ClassifiedBranch>;
  readonly scan: BranchScanEntry | undefined;
};

const FILTER_OPTIONS: ReadonlyArray<SegmentedTabOption<BranchFilter>> = [
  { value: 'goodboy', label: 'Made by Goodboy' },
  { value: 'yours', label: 'Yours' },
  { value: 'all', label: 'All local' },
];

const keyOf = (projectId: ProjectId, branch: string): string => `${projectId}:${branch}`;

const classifyScan = ({
  scan,
  now,
}: {
  readonly scan: BranchScanEntry | undefined;
  readonly now: number;
}): ReadonlyArray<ClassifiedBranch> => {
  if (scan?.status !== 'ready') {
    return [];
  }
  const goodboySessions = new Map<string, SessionId | null>(
    scan.goodboy.map((entry) => [entry.branch, entry.sessionId]),
  );
  return scan.scan.branches.map((branch) =>
    classifyBranch({ branch, goodboySessions, userEmail: scan.scan.userEmail, now }),
  );
};

export const BranchesSection = ({ scope }: Props) => {
  const projects = useAppStore(
    useShallow((state) =>
      state.projects.filter(
        (project) =>
          project.kind === 'repo' &&
          project.disconnectedAt === undefined &&
          storageOwnerMatchesScope({ ownerWorkspace: project.workspaceId, scope }),
      ),
    ),
  );
  const scans = useAppStore((state) => state.branchScans);
  const loadProjectBranches = useAppStore((state) => state.loadProjectBranches);
  const deleteBranches = useAppStore((state) => state.deleteBranches);
  const restoreDeletedBranches = useAppStore((state) => state.restoreDeletedBranches);
  const reportError = useAppStore((state) => state.reportError);
  const [filter, setFilter] = useState<BranchFilter>('goodboy');
  const [tab, setTab] = useState<BranchTab>('safe');
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [isConfirming, setIsConfirming] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [lastDeleted, setLastDeleted] = useState<ReadonlyArray<DeletedBranch>>([]);
  const [autoDeleting, setAutoDeleting] = useState<ReadonlySet<ProjectId>>(new Set());
  const [now] = useState(() => Date.now());
  const projectKey = projects.map((project) => project.id).join('|');

  useEffect(() => {
    if (projects.length === 0) {
      return;
    }
    void loadProjectBranches({ projectIds: projects.map((project) => project.id) }).catch(
      (error: unknown) => reportError({ title: "Couldn't read the branches", error }),
    );
    let isCancelled = false;
    void Promise.all(
      projects.map(async (project) => ({
        id: project.id,
        deletes: await repoDeletesMergedBranches({
          repoRoot: project.rootPath,
          workspaceId: project.workspaceId,
        }),
      })),
    ).then((results) => {
      if (!isCancelled) {
        setAutoDeleting(new Set(results.filter((r) => r.deletes === true).map((r) => r.id)));
      }
    });
    return () => {
      isCancelled = true;
    };
  }, [projectKey]);

  const groups: ReadonlyArray<ProjectGroup> = useMemo(
    () =>
      projects.map((project) => ({
        project,
        scan: scans[project.id],
        entries: classifyScan({ scan: scans[project.id], now }).filter((entry) =>
          matchesBranchFilter({ entry, filter }),
        ),
      })),
    [projects, scans, filter, now],
  );
  const everything = groups.flatMap((group) => group.entries);
  const counts = {
    safe: everything.filter((entry) => matchesBranchTab({ entry, tab: 'safe' })).length,
    needsLook: everything.filter((entry) => matchesBranchTab({ entry, tab: 'needs-look' })).length,
    all: everything.length,
  };
  const tabOptions: ReadonlyArray<SegmentedTabOption<BranchTab>> = [
    { value: 'safe', label: 'Safe to delete', badge: counts.safe },
    { value: 'needs-look', label: 'Needs a look', badge: counts.needsLook },
    { value: 'all', label: 'All', badge: counts.all },
  ];
  const visibleGroups = groups
    .map((group) => ({
      ...group,
      entries: group.entries.filter((entry) => matchesBranchTab({ entry, tab })),
    }))
    .filter((group) => group.entries.length > 0 || group.scan?.status === 'failed');
  const selectedBranches: ReadonlyArray<SelectedBranch> = groups.flatMap((group) =>
    group.entries
      .filter((entry) => selected.has(keyOf(group.project.id, entry.branch.name)))
      .map((entry) => ({
        projectId: group.project.id,
        projectName: group.project.name,
        entry,
        canDeleteOnOrigin:
          entry.isMadeByGoodboy &&
          entry.branch.location === 'on-origin' &&
          !autoDeleting.has(group.project.id),
      })),
  );
  const isLoading = projects.some((project) => scans[project.id]?.status === 'loading');
  const base = projects[0]?.baseBranch ?? 'main';
  const safeInView = visibleGroups.flatMap((group) =>
    group.entries
      .filter((entry) => isSafeVerdict(entry.verdict))
      .map((entry) => keyOf(group.project.id, entry.branch.name)),
  );

  const toggle = (key: string, isOn: boolean) => {
    setIsConfirming(false);
    setSelected((current) => {
      const next = new Set(current);
      if (isOn) {
        next.add(key);
        return next;
      }
      next.delete(key);
      return next;
    });
  };

  const armOne = (key: string) => {
    setSelected(new Set([key]));
    setIsConfirming(true);
  };

  const confirm = async ({ alsoOrigin }: { readonly alsoOrigin: boolean }) => {
    setIsBusy(true);
    try {
      const outcome = await deleteBranches({
        targets: selectedBranches.map(({ projectId, entry, canDeleteOnOrigin }) => ({
          projectId,
          branch: entry.branch.name,
          sha: entry.branch.sha,
          sessionId: entry.owner.kind === 'session' ? entry.owner.sessionId : null,
          alsoOrigin: alsoOrigin && canDeleteOnOrigin && isSafeVerdict(entry.verdict),
        })),
      });
      setLastDeleted(outcome.deleted);
      setSelected(new Set());
      setIsConfirming(false);
    } catch (error) {
      void reportError({ title: "Couldn't delete the branches", error });
    } finally {
      setIsBusy(false);
    }
  };

  const undo = async () => {
    setIsBusy(true);
    try {
      await restoreDeletedBranches({ ids: lastDeleted.map((entry) => entry.id) });
      setLastDeleted([]);
    } catch (error) {
      void reportError({ title: "Couldn't restore the branches", error });
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <section id="storage-branches" aria-label="Branches" className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <Eyebrow
          icon={<GitBranch size={ICON_SIZE.row} aria-hidden />}
          label={`Branches · ${counts.all} local`}
        />
        <SegmentedTabs
          ariaLabel="Which branches"
          size="sm"
          options={FILTER_OPTIONS}
          value={filter}
          onChange={(next) => {
            setSelected(new Set());
            setIsConfirming(false);
            setFilter(next);
          }}
        />
        <SegmentedTabs
          ariaLabel="Branch verdict"
          size="sm"
          options={tabOptions}
          value={tab}
          onChange={(next) => {
            setSelected(new Set());
            setIsConfirming(false);
            setTab(next);
          }}
          className="ml-auto"
        />
      </div>
      <p className="text-secondary text-faint-foreground">{BRANCHES_HELP(base)}</p>
      {lastDeleted.length === 0 ? null : (
        <Notice
          tone="success"
          placement="inline"
          role="status"
          title={deletedNotice(lastDeleted.length)}
          actions={
            <>
              <Button variant="ghost" size="sm" disabled={isBusy} onClick={() => void undo()}>
                Undo
              </Button>
              <IconButton
                icon={X}
                iconSize={ICON_SIZE.row}
                label="Dismiss"
                variant="ghost"
                onClick={() => setLastDeleted([])}
              />
            </>
          }
        />
      )}
      {visibleGroups.length === 0 ? (
        <p className="py-3 text-label text-muted-foreground">
          {isLoading ? 'Checking…' : 'No branch here.'}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {visibleGroups.map((group) => (
            <div key={group.project.id} className="flex flex-col">
              <div className={`${BRANCH_ROW_GRID} px-2 py-1`}>
                <span />
                <span className="text-row text-foreground">
                  {group.project.name}{' '}
                  <span className="text-label text-muted-foreground">
                    {branchCount(group.entries.length)}
                  </span>
                </span>
              </div>
              {group.scan?.status === 'failed' ? (
                <p className="px-2 text-label text-danger">{group.scan.message}</p>
              ) : (
                <ul className="flex flex-col">
                  {group.entries.map((entry) => {
                    const key = keyOf(group.project.id, entry.branch.name);
                    return (
                      <BranchRow
                        key={key}
                        entry={entry}
                        base={group.project.baseBranch ?? 'main'}
                        isSelected={selected.has(key)}
                        isBusy={isBusy}
                        onToggle={(isOn) => toggle(key, isOn)}
                        onDelete={() => armOne(key)}
                      />
                    );
                  })}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
      {selected.size === 0 && tab === 'safe' && safeInView.length > 0 ? (
        <div className="px-2 py-1.5">
          <Button
            variant="secondary"
            size="sm"
            disabled={isBusy}
            onClick={() => setSelected(new Set(safeInView))}
          >
            Select {safeInView.length} safe to delete
          </Button>
        </div>
      ) : null}
      <BranchBulkBar
        selected={selectedBranches}
        isConfirming={isConfirming}
        isBusy={isBusy}
        onClear={() => {
          setSelected(new Set());
          setIsConfirming(false);
        }}
        onArm={() => setIsConfirming(true)}
        onCancel={() => setIsConfirming(false)}
        onConfirm={(params) => void confirm(params)}
      />
    </section>
  );
};
