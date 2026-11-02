import { NAMES } from '../../../shared/utils/names';

export type HelpTab = 'guide' | 'whatsNew' | 'shortcuts';

export type HelpTabEntry = {
  readonly id: HelpTab;
  readonly label: string;
};

export const HELP_TABS: ReadonlyArray<HelpTabEntry> = [
  { id: 'guide', label: 'Guide' },
  { id: 'whatsNew', label: NAMES.whatsNew },
  { id: 'shortcuts', label: 'Shortcuts' },
];
