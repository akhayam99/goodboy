import type { ReactNode } from 'react';
import { EmptyState, PageColumn } from '@goodboy/ui';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly baseBranch: string | null;
  readonly selector: ReactNode;
};

export const AllFilesEmpty = ({ baseBranch, selector }: Props) => (
  <PageColumn className="flex min-w-0 flex-col gap-3">
    <div className="flex min-w-0 items-center gap-2">{selector}</div>
    <EmptyState
      size="section"
      tone={CONCEPT_TONE.diff}
      icon={CONCEPT_ICONS.diff}
      title={`No changes against ${baseBranch ?? 'its base branch'}`}
      description="Pick a file in the list to read it."
    />
  </PageColumn>
);
