import { isAutoChildProvider } from '@goodboy/core/auto';
import type { TurnProviderOverride } from '@goodboy/types';
import { pickedTurnExecution } from '../pickedTurnExecution';
import type { ChildTurn } from './resolveChildTurn';

type Params = Readonly<{
  route: ChildTurn['route'];
  role: ChildTurn['role'];
  override: TurnProviderOverride;
}>;

export const isOnChildRoute = ({ route, role, override }: Params): boolean => {
  if (
    override.providerId !== route.provider ||
    !isAutoChildProvider({ provider: route.provider, role })
  ) {
    return false;
  }
  const routed = pickedTurnExecution({
    override: { providerId: route.provider, model: route.model },
  });
  const asked = pickedTurnExecution({ override });
  return routed.kind !== 'unspecified' && asked.kind !== 'unspecified' && routed.id === asked.id;
};
