import { EmptyState, PageColumn } from '@goodboy/ui';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';

export const HistoryNoMount = () => (
  <PageColumn>
    <EmptyState
      size="section"
      tone={CONCEPT_TONE.history}
      icon={CONCEPT_ICONS.history}
      title="This branch isn't in the session"
      description="Pick a branch from the trail to see its commits."
    />
  </PageColumn>
);
