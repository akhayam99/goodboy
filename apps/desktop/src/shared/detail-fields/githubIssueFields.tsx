import { FolderGit2, Tag } from 'lucide-react';
import type { GithubIssue } from '@goodboy/types';
import { RecordState } from '../components/StudioDetail/RecordState';
import { stateWord } from '../../features/inbox/stateWord';
import type { InboxState } from '../../features/inbox/types';
import type { FactRegistry } from './factTypes';

type RepoParams = {
  readonly url: string;
};

const repoOf = ({ url }: RepoParams): string => /github\.com\/([^/]+\/[^/]+)/.exec(url)?.[1] ?? '';

type StateCategoryParams = {
  readonly state: string;
};

export const githubStateCategory = ({ state }: StateCategoryParams): InboxState =>
  state.toUpperCase() === 'CLOSED' ? 'done' : 'open';

export const githubIssueFields: FactRegistry<GithubIssue> = {
  state: ({ entity }) => ({
    key: 'state',
    label: 'Status',
    icon: null,
    node: (
      <RecordState
        category={githubStateCategory({ state: entity.state })}
        label={stateWord({ value: entity.state })}
      />
    ),
  }),
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
};
