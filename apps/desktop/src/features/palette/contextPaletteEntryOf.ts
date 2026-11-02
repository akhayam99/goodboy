import type { SessionId } from '@goodboy/types';
import { CONCEPT_ICONS } from '../../shared/components/conceptIcons';
import { SHORTCUTS } from '../../shared/keyboard/registry';
import { formerNamesOf } from '../../shared/utils/names';
import type { PaletteEntry } from './types';

type TargetParams = { readonly sessionId: SessionId };

type Params = TargetParams & {
  readonly toggle: (params: TargetParams) => void;
};

export const contextPaletteEntryOf = ({ sessionId, toggle }: Params): PaletteEntry => ({
  key: 'action:context',
  label: SHORTCUTS['lens.context'].label,
  kind: 'page',
  group: 'action',
  icon: CONCEPT_ICONS.context,
  shortcut: 'lens.context',
  secondary: formerNamesOf(SHORTCUTS['lens.context'].label),
  run: () => toggle({ sessionId }),
});
