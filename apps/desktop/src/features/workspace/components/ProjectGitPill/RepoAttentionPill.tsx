import type { ProjectGitStatusEntry } from '../../hooks/useProjectGitStatuses';
import { ProjectGitSummaryPill } from './ProjectGitSummaryPill';
import { repoNeedsAttention } from './repoNeedsAttention';

type Props = {
  readonly entries: ReadonlyArray<ProjectGitStatusEntry>;
};

export const RepoAttentionPill = ({ entries }: Props) => {
  const count = entries.filter(({ status }) => repoNeedsAttention({ status })).length;
  if (count === 0) {
    return null;
  }
  const words = count === 1 ? '1 repo needs attention' : `${count} repos need attention`;
  return <ProjectGitSummaryPill entries={entries} label={words} />;
};
