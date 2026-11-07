import type { SlotKey } from '@goodboy/core/context';
import type { ContextDrawerSection } from '../../../../store/slices/drawer/state';

type ContextSlotSection = Exclude<ContextDrawerSection, 'explanations'>;

export const CONTEXT_SECTION_SLOT: Readonly<Record<ContextSlotSection, SlotKey>> = {
  goal: 'goal',
  decisions: 'decisions',
  summary: 'last_output_summary',
};
