import type { ContextDrawerSection } from '../../../../store/slices/drawer/state';

export const CONTEXT_SECTION_LABEL: Readonly<Record<ContextDrawerSection, string>> = {
  goal: 'Goal',
  decisions: 'Decisions',
  summary: 'Summary',
  explanations: 'Explanations',
};
