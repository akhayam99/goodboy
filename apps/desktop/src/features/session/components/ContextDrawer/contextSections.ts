import type { ContextDrawerSection } from '../../../../store/slices/drawer/state';
import { NAMES } from '../../../../shared/utils/names';

export const CONTEXT_SECTION_LABEL: Readonly<Record<ContextDrawerSection, string>> = {
  goal: NAMES.goal,
  decisions: NAMES.decisions,
  summary: 'Summary',
  explanations: 'Explanations',
};
