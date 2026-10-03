import { PROVIDER_IDS, type ProviderId } from '@goodboy/types';
import type { GroupRoute } from '../../../../timeline/groupTotals';

export const groupRouteGlyphs = ({
  routes,
}: {
  readonly routes: ReadonlyArray<GroupRoute>;
}): ReadonlyArray<ProviderId> => [
  ...new Set(
    routes.flatMap((route) => {
      const provider = PROVIDER_IDS.find((id) => id === route.provider);
      return provider === undefined ? [] : [provider];
    }),
  ),
];
