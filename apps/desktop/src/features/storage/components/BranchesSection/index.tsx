import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { DeletedBranch, Project, ProjectId, SessionId } from '@goodboy/types';
import { Band, Listbox, Switch, type ListboxOption } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import type { BranchScanEntry } from '../../../../store/slices/branch-cleanup';
import { repoDeletesMergedBranches } from '../../../../store/slices/branch-cleanup/repoDeletesMergedBranches';
import { useToast } from '../../../../shared/components/Toast';
import { useSelectionKeys } from '../../../../shared/hooks/useSelectionKeys';
import { shortcutGlyphs } from '../../../../shared/keyboard/registry';
import { branchCount, deletedNotice } from '../../branches/branchCopy';
import type { BranchScope } from '../../branches/branchScopeOf';
import { storageOwnerMatchesScope } from '../../storageOwnerMatchesScope';
import {
  classifyBranch,
  isSafeVerdict,
  matchesBranchFilter,
  matchesBranchTab,
  type BranchFilter,
  type ClassifiedBranch,
} from '../../branches/classifyBranch';
import { BranchBulkBar, type SelectedBranch } from './BranchBulkBar';
import { BranchRow } from './BranchRow';

type Props = {
  readonly scope: BranchScope;
};

type ProjectGroup = {
  readonly project: Project;
  readonly entries: ReadonlyArray<ClassifiedBranch>;
  readonly scan: BranchScanEntry | undefined;
};

type DeleteTarget = {
  readonly projectId: ProjectId;
  readonly entry: ClassifiedBranch;
  readonly alsoOrigin: boolean;
};

const OWNER_OPTIONS: ReadonlyArray<ListboxOption<BranchFilter>> = [
  { value: 'all', label: 'All local branches' },
  { value: 'goodboy', label: 'Made by Goodboy' },
  { value: 'yours', label: 'Yours' },
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
  const { showToast } = useToast();
  const [filter, setFilter] = useState<BranchFilter>('all');
  const [isShowingAll, setIsShowingAll] = useState(false);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [isConfirming, setIsConfirming] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
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
  const safeCount = everything.filter((entry) => isSafeVerdict(entry.verdict)).length;
  const lookCount = everything.filter((entry) => entry.verdict === 'needs-look').length;
  const tab = isShowingAll ? 'all' : 'safe';
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
  const allInView = visibleGroups.flatMap((group) =>
    group.entries.map((entry) => keyOf(group.project.id, entry.branch.name)),
  );
  const sectionRef = useRef<HTMLElement>(null);
  const clearSelection = useCallback(() => {
    setSelected(new Set());
    setIsConfirming(false);
  }, []);

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

  const undo = async (deleted: ReadonlyArray<DeletedBranch>) => {
    try {
      await restoreDeletedBranches({ ids: deleted.map((entry) => entry.id) });
      showToast({ kind: 'success', message: `Restored ${branchCount(deleted.length)}.` });
    } catch (error) {
      void reportError({ title: "Couldn't restore the branches", error });
    }
  };

  const runDelete = async (targets: ReadonlyArray<DeleteTarget>) => {
    setIsBusy(true);
    try {
      const outcome = await deleteBranches({
        targets: targets.map(({ projectId, entry, alsoOrigin }) => ({
          projectId,
          branch: entry.branch.name,
          sha: entry.branch.sha,
          sessionId: entry.owner.kind === 'session' ? entry.owner.sessionId : null,
          alsoOrigin,
        })),
      });
      setSelected(new Set());
      setIsConfirming(false);
      if (outcome.kept.length > 0) {
        showToast({ kind: 'warning', message: outcome.kept.join(' ') });
      }
      if (outcome.deleted.length > 0) {
        useAppStore.getState().undoable({
          showToast,
          message: deletedNotice(outcome.deleted.length),
          undo: async () => {
            await undo(outcome.deleted);
          },
        });
      }
    } catch (error) {
      void reportError({ title: "Couldn't delete the branches", error });
    } finally {
      setIsBusy(false);
    }
  };

  const deleteOne = ({
    group,
    entry,
  }: {
    readonly group: ProjectGroup;
    readonly entry: ClassifiedBranch;
  }) => {
    if (isSafeVerdict(entry.verdict)) {
      void runDelete([{ projectId: group.project.id, entry, alsoOrigin: false }]);
      return;
    }
    setSelected(new Set([keyOf(group.project.id, entry.branch.name)]));
    setIsConfirming(true);
  };

  const deleteSelected = ({ alsoOrigin }: { readonly alsoOrigin: boolean }) =>
    void runDelete(
      selectedBranches.map(({ projectId, entry, canDeleteOnOrigin }) => ({
        projectId,
        entry,
        alsoOrigin: alsoOrigin && canDeleteOnOrigin && isSafeVerdict(entry.verdict),
      })),
    );

  const hasUnmerged = selectedBranches.some(({ entry }) => !isSafeVerdict(entry.verdict));

  useSelectionKeys({
    containerRef: sectionRef,
    hasSelection: selected.size > 0,
    onToggle: (key) => toggle(key, !selected.has(key)),
    onSelectAll: () => {
      setIsConfirming(false);
      setSelected(new Set(allInView));
    },
    onDelete: () => {
      if (hasUnmerged) {
        setIsConfirming(true);
        return;
      }
      deleteSelected({ alsoOrigin: false });
    },
  });

  return (
    <section
      ref={sectionRef}
      id="storage-branches"
      aria-label="Branches"
      data-selecting={selected.size > 0}
      className="group/select-list flex flex-col gap-2"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-1">
        <span className="text-label text-muted-foreground">
          <span className="tabular-nums text-foreground">{safeCount}</span> safe to delete
        </span>
        {lookCount === 0 ? null : (
          <span className="text-label text-muted-foreground">
            <span className="tabular-nums text-foreground">{lookCount}</span> need a look
          </span>
        )}
        <span className="ml-auto flex items-center gap-3">
          <Listbox
            ariaLabel="Made by"
            trigger="quiet"
            size="sm"
            align="end"
            value={filter}
            options={OWNER_OPTIONS}
            onChange={(next) => {
              clearSelection();
              setFilter(next);
            }}
          />
          <Switch
            label="Show all branches"
            checked={isShowingAll}
            onChange={(next) => {
              clearSelection();
              setIsShowingAll(next);
            }}
          />
        </span>
      </div>
      <Band>
        {visibleGroups.length === 0 ? (
          <p className="px-2 py-2 text-label text-muted-foreground">
            {isLoading
              ? 'Checking…'
              : isShowingAll
                ? 'No branch matches this filter.'
                : 'Nothing safe to delete here. Show all branches to see the rest.'}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {visibleGroups.map((group, index) => (
              <div key={group.project.id} className="flex flex-col">
                <div className="grid grid-cols-[20px_minmax(0,1fr)_auto] items-baseline gap-2 px-2 py-1">
                  <span />
                  <span className="flex min-w-0 items-baseline gap-2">
                    <span className="truncate text-row text-foreground">{group.project.name}</span>
                    <span className="shrink-0 text-meta text-muted-foreground">
                      base {group.project.baseBranch ?? 'main'} ·{' '}
                      {branchCount(group.entries.length)}
                    </span>
                  </span>
                  {index === 0 ? (
                    <span className="text-meta text-faint-foreground">
                      Select with {shortcutGlyphs('selection.toggle')} or{' '}
                      {shortcutGlyphs('selection.all')}
                    </span>
                  ) : null}
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
                          selectId={key}
                          base={group.project.baseBranch ?? 'main'}
                          isSelected={selected.has(key)}
                          isBusy={isBusy}
                          onToggle={(isOn) => toggle(key, isOn)}
                          onDelete={() => deleteOne({ group, entry })}
                        />
                      );
                    })}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
      </Band>
      <BranchBulkBar
        selected={selectedBranches}
        total={allInView.length}
        isConfirming={isConfirming}
        isBusy={isBusy}
        onClear={clearSelection}
        onSelectAll={() => {
          setIsConfirming(false);
          setSelected(new Set(allInView));
        }}
        onArm={() => setIsConfirming(true)}
        onCancel={() => setIsConfirming(false)}
        onConfirm={deleteSelected}
      />
    </section>
  );
};
