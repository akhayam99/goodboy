import { EmptyState } from '@goodboy/ui';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import type { WorkFilter } from '../../../../store/slices/work/state';

type Props = {
  readonly filter: WorkFilter;
};

const TITLES = {
  open: 'No open Leads',
  needsYou: 'Nothing needs you',
  working: 'No Lead is working',
  finished: 'No finished Leads',
} as const satisfies Readonly<Record<WorkFilter, string>>;

const DESCRIPTIONS = {
  open: 'A Lead you start in any session of this workspace shows here.',
  needsYou: 'A plan to review or a question to answer shows here.',
  working: 'A Lead with agents running shows here.',
  finished: 'A Lead that closed its work shows here.',
} as const satisfies Readonly<Record<WorkFilter, string>>;

export const WorkEmpty = ({ filter }: Props) => (
  <EmptyState
    icon={CONCEPT_ICONS.work}
    tone={CONCEPT_TONE.work}
    title={TITLES[filter]}
    description={DESCRIPTIONS[filter]}
    size="page"
    headingLevel={2}
  />
);
