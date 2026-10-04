import type { ImpactScope } from './lib';

export const IMPACT_STUDIO_EVENT = 'goodboy:open-impact-studio';

type Params = {
  readonly scope?: ImpactScope;
  readonly door?: boolean;
};

export const openImpactStudio = ({ scope, door }: Params) => {
  const detail = door === true ? { scope, door } : { scope };
  window.dispatchEvent(new CustomEvent(IMPACT_STUDIO_EVENT, { detail }));
};
