import { isAutoChildProvider } from '@goodboy/core/auto';
import type { TurnProviderOverride } from '@goodboy/types';
import { pickedTurnExecution } from '../pickedTurnExecution';
import type { ChildTurn } from './resolveChildTurn';

type Params = Readonly<{
  route: ChildTurn['route'];
  override: TurnProviderOverride;
}>;

export const isOnChildRoute = ({ route, override }: Params): boolean => {
  if (
    override.providerId !== route.provider ||
    !isAutoChildProvider({ provider: route.provider })
  ) {
    return false;
  }
  const routed = pickedTurnExecution({
    override: { providerId: route.provider, model: route.model },
  });
  const asked = pickedTurnExecution({ override });
  return routed.kind !== 'unspecified' && asked.kind !== 'unspecified' && routed.id === asked.id;
};
