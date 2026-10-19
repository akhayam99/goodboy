import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import type { PaletteEntry } from '../../palette/types';
import type { OverviewLayout } from './overviewLayoutOf';

type SwitchParams = {
  readonly layout: OverviewLayout;
  readonly hasUndo: boolean;
};

type Params = {
  readonly switchTo: (params: SwitchParams) => Promise<boolean>;
};

export const overviewLayoutEntries = ({ switchTo }: Params): ReadonlyArray<PaletteEntry> => [
  {
    key: 'action:overview-new',
    label: 'Use the new session overview',
    kind: 'action',
    group: 'action',
    icon: CONCEPT_ICONS.overviewLayout,
    secondary: ['overview layout experiment view'],
    run: () => void switchTo({ layout: 'new', hasUndo: false }),
  },
  {
    key: 'action:overview-classic',
    label: 'Use the classic session overview',
    kind: 'action',
    group: 'action',
    icon: CONCEPT_ICONS.overviewLayout,
    secondary: ['overview layout experiment view'],
    run: () => void switchTo({ layout: 'classic', hasUndo: true }),
  },
];
