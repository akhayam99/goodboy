import { Button, EmptyState } from '@goodboy/ui';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly onClear: () => void;
};

export const NoFilesMatch = ({ onClear }: Props) => (
  <div className="flex min-h-0 flex-1 items-center justify-center px-4 pb-12">
    <EmptyState
      size="section"
      tone={CONCEPT_TONE.diff}
      icon={CONCEPT_ICONS.diff}
      title="No files match"
      description="Nothing in this diff matches the current filter."
      action={
        <Button size="sm" variant="secondary" onClick={onClear}>
          Clear
        </Button>
      }
    />
  </div>
);
