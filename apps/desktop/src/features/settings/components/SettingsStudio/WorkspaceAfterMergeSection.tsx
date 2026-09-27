import { useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { AFTER_MERGE_RULES, type AfterMergeRule, type WorkspaceId } from '@goodboy/types';
import { Collapsible, SectionHeader, SegmentedTabs } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import { DEFAULT_AFTER_MERGE_RULE } from '../../../../store/slices/branch-cleanup';
import { repoDeletesMergedBranches } from '../../../../store/slices/branch-cleanup/repoDeletesMergedBranches';
import {
  AFTER_MERGE_LABEL,
  AFTER_MERGE_NEVER,
  githubAutoDeleteNote,
  githubAutoDeleteSummary,
} from './afterMergeCopy';

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
  const [isReposOpen, setIsReposOpen] = useState(false);
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
    <section aria-label="After a pull request merges" className="flex flex-col gap-2">
      <SectionHeader
        label="After a pull request merges"
        hint="What happens to the branch, its folder and its worktree once a pull request lands."
        headingLevel={2}
      />
      <div className="flex flex-col gap-1.5">
        <SegmentedTabs
          ariaLabel="After a pull request merges"
          size="sm"
          value={rule}
          options={options}
          onChange={(next) => void choose(next)}
        />
        <p className="text-secondary text-faint-foreground">{AFTER_MERGE_NEVER}</p>
        {autoDeleting.length === 1 && (
          <p className="text-secondary text-muted-foreground">
            {githubAutoDeleteNote({ projectName: autoDeleting[0]! })}
          </p>
        )}
        {autoDeleting.length > 1 && (
          <Collapsible
            open={isReposOpen}
            onOpenChange={setIsReposOpen}
            trigger={
              <span className="text-secondary text-muted-foreground">
                {githubAutoDeleteSummary({ count: autoDeleting.length })}
              </span>
            }
          >
            <ul className="flex flex-col gap-0.5">
              {autoDeleting.map((projectName) => (
                <li key={projectName} className="text-secondary text-muted-foreground">
                  {projectName}
                </li>
              ))}
            </ul>
          </Collapsible>
        )}
      </div>
    </section>
  );
};
