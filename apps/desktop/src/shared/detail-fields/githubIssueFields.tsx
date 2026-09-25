import { FolderGit2, Tag } from 'lucide-react';
import type { GithubIssue } from '@goodboy/types';
import type { FactRegistry } from './factTypes';
import { timeFact } from './timeFact';

type RepoParams = {
  readonly url: string;
};

const repoOf = ({ url }: RepoParams): string => /github\.com\/([^/]+\/[^/]+)/.exec(url)?.[1] ?? '';

export const githubIssueFields: FactRegistry<GithubIssue> = {
  place: ({ entity }) => ({
    key: 'repo',
    label: 'Repository',
    icon: FolderGit2,
    node: repoOf({ url: entity.url }),
  }),
  labels: ({ entity }) =>
    entity.labels.map((label) => ({
      key: `label-${label}`,
      label: 'Label',
      icon: Tag,
      node: label,
    })),
  time: ({ entity }) => timeFact({ label: 'Updated', iso: entity.updatedAt }),
};
