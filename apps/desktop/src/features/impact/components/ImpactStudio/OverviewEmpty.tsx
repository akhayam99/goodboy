import { Plus } from '@goodboy/ui/icons';
import { Button, EmptyState, ICON_SIZE } from '@goodboy/ui';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly onStartSession: () => void;
};

export const OverviewEmpty = ({ onStartSession }: Props) => (
  <EmptyState
    icon={CONCEPT_ICONS.impact}
    tone={CONCEPT_TONE.impact}
    title="No finished sessions yet"
    description="Each finished session shows what shipped, how long it took and its cost."
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
