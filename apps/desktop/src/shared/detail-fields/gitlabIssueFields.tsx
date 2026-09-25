import { FolderGit2, Tag } from 'lucide-react';
import type { GitlabIssue } from '../../features/integrations/gitlab/client';
import type { FactRegistry } from './factTypes';
import { timeFact } from './timeFact';

type ProjectParams = {
  readonly reference: string;
};

const projectOf = ({ reference }: ProjectParams): string => reference.split('#')[0] ?? '';

export const gitlabIssueFields: FactRegistry<GitlabIssue> = {
  place: ({ entity }) => {
    const project = projectOf({ reference: entity.references.full });
    const milestone = entity.milestone?.title ?? null;
    return {
      key: 'place',
      label: 'Project and milestone',
      icon: FolderGit2,
      node: milestone == null ? project : `${project} › ${milestone}`,
    };
  },
  labels: ({ entity }) =>
    entity.labels.map((label) => ({
      key: `label-${label}`,
      label: 'Label',
      icon: Tag,
      node: label,
    })),
  time: ({ entity }) => timeFact({ label: 'Updated', iso: entity.updatedAt }),
};
