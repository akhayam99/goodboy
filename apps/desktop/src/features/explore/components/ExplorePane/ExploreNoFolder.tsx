import type { ReactNode } from 'react';
import { EmptyState } from '@goodboy/ui';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly action?: ReactNode;
};

export const ExploreNoFolder = ({ action }: Props) => (
  <EmptyState
    size="page"
    icon={CONCEPT_ICONS.explore}
    title="No folder to browse"
    description="Explore lists the files of a folder this session works in."
    action={action}
  />
);
