import { Plus } from 'lucide-react';
import { EmptyState } from '@goodboy/ui';
import {
  CONCEPT_ICONS,
  CONCEPT_TONE,
  ICON_SIZE,
} from '../../../../../shared/components/conceptIcons';

type Props = {
  readonly disabled: boolean;
  readonly onAddStep: () => void;
};

export const CustomStepsEmptyState = ({ disabled, onAddStep }: Props) => (
  <EmptyState
    bordered
    tone={CONCEPT_TONE.workflows}
    icon={CONCEPT_ICONS.workflows}
    size="inline"
    className="items-start px-4 py-5 text-left"
    title="No steps yet"
    description="Generate a plan from the description above, or write the first step yourself and keep going from there."
    action={
      <button
        type="button"
        onClick={onAddStep}
        disabled={disabled}
        className="inline-flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/5 px-2.5 py-1 text-xs text-primary transition-colors hover:border-primary hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Plus size={ICON_SIZE.row} aria-hidden /> Add step
      </button>
    }
  />
);
