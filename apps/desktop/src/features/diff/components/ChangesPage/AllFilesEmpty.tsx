import { EmptyState } from '@goodboy/ui';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly baseBranch: string | null;
};

export const AllFilesEmpty = ({ baseBranch }: Props) => (
  <div className="flex min-h-0 flex-1 items-center justify-center px-4 pb-12">
    <EmptyState
      size="section"
      tone={CONCEPT_TONE.diff}
      icon={CONCEPT_ICONS.diff}
      title={`No changes against ${baseBranch ?? 'its base branch'}`}
      description="Pick a file in the list to read it."
    />
  </div>
);
