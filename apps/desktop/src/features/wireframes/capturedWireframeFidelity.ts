import type { WireframeFidelity } from './wireframeFidelity';

export const WIREFRAME_FIDELITY_DOWNGRADE_NOTE =
  'fidelity forced to low: this wireframe was asked for high fidelity, but no design source survived for this agent, so no theme here is backed by anything read from the repository';

export type CapturedWireframeFidelity = Readonly<{
  fidelity: WireframeFidelity;
  note: string | null;
}>;

type Params = Readonly<{
  requested: WireframeFidelity | null;
  hasDesignSource: boolean;
}>;

export const capturedWireframeFidelity = ({
  requested,
  hasDesignSource,
}: Params): CapturedWireframeFidelity => {
  if (requested !== 'high') {
    return { fidelity: 'low', note: null };
  }
  if (hasDesignSource) {
    return { fidelity: 'high', note: null };
  }
  return { fidelity: 'low', note: WIREFRAME_FIDELITY_DOWNGRADE_NOTE };
};
