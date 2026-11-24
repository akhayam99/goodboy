import { isAutoChildProvider } from '@goodboy/core/auto';
import { catalogModelForId } from '@goodboy/core/providers';
import type { TurnProviderOverride } from '@goodboy/types';
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
  const asked = override.selection?.key ?? override.model;
  if (asked == null) {
    return false;
  }
  const routed = catalogModelForId({ provider: route.provider, modelId: route.model });
  const picked = catalogModelForId({ provider: override.providerId, modelId: asked });
  return routed !== null && picked !== null && routed.key === picked.key;
};
