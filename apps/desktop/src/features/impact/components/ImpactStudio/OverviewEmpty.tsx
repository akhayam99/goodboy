import { Plus } from 'lucide-react';
import { Button, EmptyState } from '@goodboy/ui';
import { CONCEPT_ICONS, CONCEPT_TONE, ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly onStartSession: () => void;
};

export const OverviewEmpty = ({ onStartSession }: Props) => (
  <EmptyState
    icon={CONCEPT_ICONS.impact}
    tone={CONCEPT_TONE.impact}
    title="Nothing finished yet"
    description="Finished sessions appear here: what shipped, how long it took, what it cost."
    action={
      <Button variant="secondary" size="sm" onClick={onStartSession}>
        <Plus size={ICON_SIZE.control} aria-hidden />
        New session
      </Button>
    }
    size="page"
    headingLevel={2}
  />
);
