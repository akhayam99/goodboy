import { NAMES } from '../../../shared/utils/names';

export type HelpTab = 'guide' | 'whatsNew';

export type HelpTabEntry = {
  readonly id: HelpTab;
  readonly label: string;
};

export const HELP_TABS: ReadonlyArray<HelpTabEntry> = [
  { id: 'guide', label: NAMES.guide },
  { id: 'whatsNew', label: NAMES.whatsNew },
];
