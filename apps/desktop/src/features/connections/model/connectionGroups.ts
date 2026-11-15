import type { ProviderId } from '@goodboy/types';
import { isProviderId } from '@goodboy/types/helpers';
import { TOOL_ORDER } from '../../integrations/toolRailEntries';
import { orderProviders } from '../../providers/orderProviders';
import type { ProviderDisplayInfo } from '../../providers/providers';
import type { ConnectionToolId } from './connectionState';
import { providerSetupVerb } from './providerSetupVerb';

export type ConnectionGroup<Id extends string> = {
  readonly tiles: ReadonlyArray<Id>;
  readonly setup: ReadonlyArray<Id>;
  readonly readyCount: number;
  readonly total: number;
};

export type ConnectionGroups = {
  readonly providers: ConnectionGroup<ProviderId>;
  readonly tools: ConnectionGroup<ConnectionToolId> | null;
};

type Params = {
  readonly providers: ReadonlyArray<Pick<ProviderDisplayInfo, 'id' | 'connection' | 'standing'>>;
  readonly connectedTools: Readonly<Record<ConnectionToolId, boolean>> | null;
};

type SplitParams<Id extends string> = {
  readonly ids: ReadonlyArray<Id>;
  readonly ready: ReadonlySet<Id>;
};

const split = <Id extends string>({ ids, ready }: SplitParams<Id>): ConnectionGroup<Id> => {
  const tiles = ids.filter((id) => ready.has(id));
  return {
    tiles,
    setup: ids.filter((id) => !ready.has(id)),
    readyCount: tiles.length,
    total: ids.length,
  };
};

export const connectionGroups = ({ providers, connectedTools }: Params): ConnectionGroups => {
  const ordered = orderProviders({ providers });
  const providerIds = ordered.map((provider) => provider.id).filter(isProviderId);
  const readyProviders = new Set(
    ordered
      .filter((provider) => providerSetupVerb({ provider }) === null)
      .map((provider) => provider.id)
      .filter(isProviderId),
  );
  return {
    providers: split({ ids: providerIds, ready: readyProviders }),
    tools:
      connectedTools === null
        ? null
        : split({
            ids: TOOL_ORDER,
            ready: new Set(TOOL_ORDER.filter((tool) => connectedTools[tool])),
          }),
  };
};
