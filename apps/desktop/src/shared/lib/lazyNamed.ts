import { lazy } from 'react';
import type { ComponentType, LazyExoticComponent } from 'react';

type Params<TModule, TProps> = {
  readonly load: () => Promise<TModule>;
  readonly pick: (module: TModule) => ComponentType<TProps>;
};

export const lazyNamed = <TModule, TProps>({
  load,
  pick,
}: Params<TModule, TProps>): LazyExoticComponent<ComponentType<TProps>> =>
  lazy(() => load().then((module) => ({ default: pick(module) })));
