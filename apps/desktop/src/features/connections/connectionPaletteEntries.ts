import { isProviderId } from '@goodboy/types/helpers';
import { CONCEPT_ICONS } from '../../shared/components/conceptIcons';
import { integrationLabel } from '../../shared/utils/integrationLabel';
import { NAMES } from '../../shared/utils/names';
import { TOOL_ORDER } from '../integrations/toolOrder';
import type { PaletteEntry } from '../palette/types';
import { orderProviders } from '../providers/orderProviders';
import { PROVIDER_LABEL } from '../providers/providerLabel';
import type { ProviderDisplayInfo } from '../providers/providers';
import { openConnection } from './openConnection';

type Params = {
  readonly providers: ReadonlyArray<Pick<ProviderDisplayInfo, 'id'>>;
  readonly hasWorkspace: boolean;
};

export const connectionPaletteEntries = ({
  providers,
  hasWorkspace,
}: Params): ReadonlyArray<PaletteEntry> => {
  const providerEntries = orderProviders({ providers })
    .map((provider) => provider.id)
    .filter(isProviderId)
    .map((provider): PaletteEntry => ({
      key: `connection:provider:${provider}`,
      label: PROVIDER_LABEL[provider],
      kind: 'page',
      group: 'action',
      icon: CONCEPT_ICONS.providers,
      tag: 'Provider',
      secondary: [NAMES.providers, NAMES.connections],
      run: () => openConnection({ focus: { kind: 'provider', provider } }),
    }));
  if (!hasWorkspace) {
    return providerEntries;
  }
  const toolEntries = TOOL_ORDER.map((tool): PaletteEntry => ({
    key: `connection:tool:${tool}`,
    label: integrationLabel({ provider: tool }),
    kind: 'page',
    group: 'action',
    icon: CONCEPT_ICONS[tool],
    tag: 'Integration',
    secondary: ['Integrations', NAMES.connections],
    run: () => openConnection({ focus: { kind: 'tool', tool } }),
  }));
  return [...providerEntries, ...toolEntries];
};
