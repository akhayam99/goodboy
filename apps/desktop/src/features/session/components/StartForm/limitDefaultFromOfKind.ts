import type { LimitDefaultFrom } from '../../../auto/limitDefaultFrom';
import type { StartFormKind } from './startFormKinds';

type Params = {
  readonly kind: StartFormKind | null;
};

export const limitDefaultFromOfKind = ({ kind }: Params): LimitDefaultFrom =>
  kind === 'orchestrated' || kind === 'preset' ? 'run' : 'auto';
