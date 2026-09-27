import { useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { AFTER_MERGE_RULES, type AfterMergeRule, type WorkspaceId } from '@goodboy/types';
import { SegmentedTabs } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import { DEFAULT_AFTER_MERGE_RULE } from '../../../../store/slices/branch-cleanup';
import { repoDeletesMergedBranches } from '../../../../store/slices/branch-cleanup/repoDeletesMergedBranches';
import { AFTER_MERGE_LABEL, AFTER_MERGE_NEVER, githubAutoDeleteNote } from './afterMergeCopy';

type Props = {
  readonly workspaceId: WorkspaceId;
};

type RepoProject = {
  readonly name: string;
  readonly rootPath: string;
};

const useGithubAutoDeleteRepos = ({
  workspaceId,
  repos,
}: {
  readonly workspaceId: WorkspaceId;
  readonly repos: ReadonlyArray<RepoProject>;
}): ReadonlyArray<string> => {
  const [autoDeleting, setAutoDeleting] = useState<ReadonlyArray<string>>([]);
  const key = repos.map((repo) => repo.rootPath).join('|');

  useEffect(() => {
    let isCancelled = false;
    void Promise.all(
      repos.map(async (repo) => ({
        name: repo.name,
        deletes: await repoDeletesMergedBranches({ repoRoot: repo.rootPath, workspaceId }),
      })),
    ).then((results) => {
      if (isCancelled) {
        return;
      }
      setAutoDeleting(results.filter((result) => result.deletes === true).map((r) => r.name));
    });
    return () => {
      isCancelled = true;
    };
  }, [key, workspaceId]);

  return autoDeleting;
};

export const WorkspaceAfterMergeSection = ({ workspaceId }: Props) => {
  const rule = useAppStore(
    (state) => state.workspaceOverrides[workspaceId]?.afterMerge ?? DEFAULT_AFTER_MERGE_RULE,
  );
  const repoProjects = useAppStore(
    useShallow((state) =>
      state.projects.filter(
        (project) => project.workspaceId === workspaceId && project.kind === 'repo',
      ),
    ),
  );
  const repos = useMemo(
    () => repoProjects.map((project) => ({ name: project.name, rootPath: project.rootPath })),
    [repoProjects],
  );
  const patchWorkspaceOverrides = useAppStore((state) => state.patchWorkspaceOverrides);
  const reportError = useAppStore((state) => state.reportError);
  const [isBusy, setIsBusy] = useState(false);
  const autoDeleting = useGithubAutoDeleteRepos({ workspaceId, repos });
  const isOriginRedundant = repos.length > 0 && autoDeleting.length === repos.length;

  const options = useMemo(
    () =>
      AFTER_MERGE_RULES.map((value) => ({
        value,
        label: AFTER_MERGE_LABEL[value],
        disabled: isBusy || (value === 'local-and-origin' && isOriginRedundant),
      })),
    [isBusy, isOriginRedundant],
  );

  const choose = async (next: AfterMergeRule) => {
    setIsBusy(true);
    try {
      await patchWorkspaceOverrides({ workspaceId, patch: { afterMerge: next } });
    } catch (error) {
      void reportError({ title: "Couldn't save what happens after a merge", error, workspaceId });
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-row text-foreground">After a pull request merges</span>
      <SegmentedTabs
        ariaLabel="After a pull request merges"
        size="sm"
        value={rule}
        options={options}
        onChange={(next) => void choose(next)}
      />
      <p className="text-secondary text-faint-foreground">{AFTER_MERGE_NEVER}</p>
      {autoDeleting.map((projectName) => (
        <p key={projectName} className="text-secondary text-muted-foreground">
          {githubAutoDeleteNote({ projectName })}
        </p>
      ))}
    </div>
  );
};
