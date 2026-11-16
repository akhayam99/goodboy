import { useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { AFTER_MERGE_RULES, type AfterMergeRule, type WorkspaceId } from '@goodboy/types';
import { Band, Collapsible, SegmentedTabs } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import { DEFAULT_AFTER_MERGE_RULE } from '../../../../store/slices/branch-cleanup';
import { repoDeletesMergedBranches } from '../../../../store/slices/branch-cleanup/repoDeletesMergedBranches';
import { useWorkspaceOverrideSave } from '../../hooks/useWorkspaceOverrideSave';
import { WorkspaceFieldRow } from './WorkspaceFieldRow';
import {
  AFTER_MERGE_LABEL,
  AFTER_MERGE_NEVER,
  githubAutoDeleteNote,
  githubAutoDeleteSummary,
} from '../../../../shared/utils/afterMergeCopy';

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
  const save = useWorkspaceOverrideSave<AfterMergeRule>({
    workspaceId,
    field: 'afterMerge',
    saved: rule,
    patchOf: ({ value }) => ({ afterMerge: value }),
  });
  const [isReposOpen, setIsReposOpen] = useState(false);
  const autoDeleting = useGithubAutoDeleteRepos({ workspaceId, repos });
  const isOriginRedundant = repos.length > 0 && autoDeleting.length === repos.length;

  const options = useMemo(
    () =>
      AFTER_MERGE_RULES.map((value) => ({
        value,
        label: AFTER_MERGE_LABEL[value],
        disabled: value === 'local-and-origin' && isOriginRedundant,
      })),
    [isOriginRedundant],
  );

  return (
    <Band
      inset="content"
      label="After merge"
      hint="Once its pull request merges."
      headingLevel={2}
      ariaLabel="After merge"
    >
      <WorkspaceFieldRow
        workspaceId={workspaceId}
        field="afterMerge"
        layout="stacked"
        help={AFTER_MERGE_NEVER}
      >
        <SegmentedTabs
          ariaLabel="Folder and branch"
          size="sm"
          value={save.value}
          options={options}
          onChange={(next) => void save.save({ value: next })}
        />
      </WorkspaceFieldRow>
      {autoDeleting.length === 1 && (
        <p className="text-meta text-muted-foreground">
          {githubAutoDeleteNote({ projectName: autoDeleting[0]! })}
        </p>
      )}
      {autoDeleting.length > 1 && (
        <Collapsible
          open={isReposOpen}
          onOpenChange={setIsReposOpen}
          trigger={
            <span className="text-meta text-muted-foreground">
              {githubAutoDeleteSummary({ count: autoDeleting.length })}
            </span>
          }
        >
          <ul className="flex flex-col gap-0.5">
            {autoDeleting.map((projectName) => (
              <li key={projectName} className="text-meta text-muted-foreground">
                {projectName}
              </li>
            ))}
          </ul>
        </Collapsible>
      )}
    </Band>
  );
};
