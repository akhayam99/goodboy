import type { ImpactScope } from './lib';

export const IMPACT_STUDIO_EVENT = 'goodboy:open-impact-studio';

type Params = {
  readonly scope?: ImpactScope;
};

export const openImpactStudio = ({ scope }: Params) => {
  window.dispatchEvent(new CustomEvent(IMPACT_STUDIO_EVENT, { detail: { scope } }));
};
